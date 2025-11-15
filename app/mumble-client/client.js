import mumbleStreams from '../mumble-streams/index.js'
import duplexer from 'reduplexer'
import { EventEmitter } from 'node:events'
import through2 from 'through2'
import Promise from 'promise'
import DropStream from 'drop-stream'
import { getOSName, getOSVersion } from './utils.js'
import User from './user.js'
import Channel from './channel.js'
import removeValue from 'remove-value'
import Stats from 'stats-incremental'

const DenyType = mumbleStreams.data.messages.PermissionDenied.DenyType

/*
 * @typedef {'Opus'} Codec
 */

/**
 * Number of the voice target when outgoing (0 for normal talking, 1-31 for
 * a voice target).
 * String describing the source when incoming.
 * @typedef {number|'normal'|'shout'|'whisper'} VoiceTarget
 */

/**
 * @typedef {object} VoiceData
 * @property {VoiceTarget} target - Target of the audio
 * @property {Codec} codec - The codec of the audio packet
 * @property {Buffer} frame - Encoded audio frame, null indicates a lost frame
 * @property {?Position} position - Position of audio source
 */

/**
 * Interleaved 32-bit float PCM frames in [-1; 1] range with sample rate of 48k.
 * @typedef {object} PCMData
 * @property {VoiceTarget} target - Target of the audio
 * @property {Float32Array} pcm - The pcm data
 * @property {number} numberOfChannels - Number of channels
 * @property {?Position} position - Position of audio source
 * @property {?number} bitrate - Target bitrate hint for encoder, see for default {@link MumbleClient#setAudioQuality}
 */

/**
 * Transforms {@link VoiceData} to {@link PCMData}.
 * Should ignore any unknown codecs.
 *
 * @interface DecoderStream
 * @extends stream.Transform
 */

/**
 * Transforms {@link PCMData} to {@link VoiceData}.
 *
 * @interface EncoderStream
 * @extends stream.Transform
 */

/**
 * @interface Codecs
 * @property {number[]} celt - List of celt versions supported by this implementation
 * @property {boolean} opus - Whether this implementation supports the Opus codec
 */

/**
 * Returns the duration of encoded voice data without actually decoding it.
 *
 * @function Codecs#getDuration
 * @param {Codec} codec - The codec
 * @param {Buffer} buffer - The encoded data
 * @return {number} The duration in milliseconds (has to be a multiple of 10)
 */

/**
 * Creates a new decoder stream for a transmission of the specified user.
 * This method is called for every single transmission (whenever a user starts
 * speaking), as such it must not be expensive.
 *
 * @function Codecs#createDecoderStream
 * @param {User} user - The user
 * @return {DecoderStream} The decoder stream
 */

/**
 * Creates a new encoder stream for a outgoing transmission.
 * This method is called for every single transmission (whenever the user
 * starts speaking), as such it must not be expensive.
 *
 * @function Codecs#createEncoderStream
 * @param {Codec} codec - The codec
 * @return {EncoderStream} The endecoder stream
 */

/**
 * Single use Mumble client.
 */
class MumbleClient extends EventEmitter {
  /**
   * A mumble client.
   * This object may only be connected to one server and cannot be reused.
   *
   * @param {object} options - Options
   * @param {string} options.username - User name of the client
   * @param {string} [options.password] - Server password to use
   * @param {string[]} [options.tokens] - Array of access tokens to use
   * @param {string} [options.clientSoftware] - Client software name/version
   * @param {string} [options.osName] - Client operating system name
   * @param {string} [options.osVersion] - Client operating system version
   * @param {Codecs} [options.codecs] - Codecs used for voice
   * @param {number} [options.userVoiceTimeout] - Milliseconds after which an
   *  inactive voice transmissions is timed out
   * @param {number} [options.maxInFlightDataPings] - Amount of data pings without response
   *  after which the connection is considered timed out
   * @param {number} [options.dataPingInterval] - Interval of data pings (in ms)
   */
  constructor (options) {
    super()

    if (!options.username) {
      throw new Error('No username given')
    }

    this._options = options || {}
    this._username = options.username
    this._password = options.password
    this._tokens = options.tokens
    this._codecs = options.codecs

    this._dataPingInterval = options.dataPingInterval || 5000
    this._maxInFlightDataPings = options.maxInFlightDataPings || 2
    this._dataStats = new Stats()
    this._voiceStats = new Stats()

    this._userById = {}
    this._channelById = {}

    this.users = []
    this.channels = []

    this._dataEncoder = new mumbleStreams.data.Encoder()
    this._dataDecoder = new mumbleStreams.data.Decoder()
    this._voiceEncoder = new mumbleStreams.voice.Encoder('server')
    this._voiceDecoder = new mumbleStreams.voice.Decoder('server')
    this._data = duplexer(this._dataEncoder, this._dataDecoder, {
      objectMode: true
    })
    this._voice = duplexer(this._voiceEncoder, this._voiceDecoder, {
      objectMode: true
    })

    this._data.on('data', this._onData.bind(this))
    this._voice.on('data', this._onVoice.bind(this))
    this._voiceEncoder.on('data', data => {
      // TODO This should only be the fallback option
      this._data.write({
        name: 'UDPTunnel',
        payload: data
      })
    })
    this._voiceDecoder.on('unknown_codec', codecId =>
      this.emit('unknown_codec', codecId)
    )
    this._data.on('end', this.disconnect.bind(this))

    this._registerErrorHandler(
      this._data,
      this._voice,
      this._dataEncoder,
      this._dataDecoder,
      this._voiceEncoder,
      this._voiceDecoder
    )

    this._disconnected = false
  }

  _registerErrorHandler () {
    for (const obj of arguments) {
      obj.on('error', this._error.bind(this))
    }
  }

  _error (reason) {
    this.emit('error', reason)
    this.disconnect()
  }

  _send (msg) {
    console.log('[CLIENT._send] Writing message to data stream:', JSON.stringify(msg));
    try {
      this._data.write(msg);
      console.log('[CLIENT._send] Message written successfully');
    } catch (e) {
      console.error('[CLIENT._send] Error writing message:', e);
    }
  }

  /**
   * Connects this client to a duplex stream that is used for the data channel.
   * The provided duplex stream is expected to be valid and usable.
   * Calling this method will begin the initialization of the connection.
   *
   * @param stream - The stream used for the data channel.
   * @param callback - Optional callback that is invoked when the connection has been established.
   */
  connectDataStream (stream, callback) {
    if (this._dataStream) throw new Error('Already connected!')
    this._dataStream = stream

    // Connect the supplied stream to the data channel encoder and decoder
    this._registerErrorHandler(stream)
    this._dataEncoder.pipe(stream).pipe(this._dataDecoder)

    // Send the initial two packets
    this._send({
      name: 'Version',
      payload: {
        version: mumbleStreams.version.toUInt8(),
        release: this._options.clientSoftware || 'Node.js mumble-client',
        os: this._options.osName || getOSName(),
        os_version: this._options.osVersion || getOSVersion()
      }
    })
    this._send({
      name: 'Authenticate',
      payload: {
        username: this._username,
        password: this._password,
        tokens: this._tokens,
        celt_versions: (this._codecs || { celt: [] }).celt,
        opus: (this._codecs || { opus: false }).opus
      }
    })

    return new Promise((resolve, reject) => {
      this.once('connected', () => resolve(this))
      this.once('reject', reject)
      this.once('error', reject)
    }).nodeify(callback)
  }

  /**
   * Connects this client to a duplex stream that is used for the voice channel.
   * The provided duplex stream is expected to be valid and usable.
   * The stream may be unreliable. That is, it may lose packets or deliver them
   * out of order.
   * It must however gurantee that packets arrive unmodified and/or are dropped
   * when corrupted.
   * It is also responsible for any encryption that is necessary.
   *
   * Connecting a voice channel is entirely optional. If no voice channel
   * is connected, all voice data is tunneled through the data channel.
   *
   * @param stream - The stream used for the data channel.
   * @returns {undefined}
   */
  connectVoiceStream (stream) {
    // Connect the stream to the voice channel encoder and decoder
    this._registerErrorHandler(stream)
    this._voiceEncoder.pipe(stream).pipe(this._voiceDecoder)

    // TODO: Ping packet
  }

  createVoiceStream (target = 0, numberOfChannels = 1) {
    if (!this._codecs) {
      return DropStream.obj()
    }
    const voiceStream = through2.obj((chunk, encoding, callback) => {
      if (chunk instanceof Buffer) {
        chunk = new Float32Array(
          chunk.buffer,
          chunk.byteOffset,
          chunk.byteLength / 4
        )
      }
      if (chunk instanceof Float32Array) {
        chunk = {
          target: target,
          pcm: chunk,
          numberOfChannels: numberOfChannels
        }
      } else {
        chunk = {
          target: target,
          pcm: chunk.pcm,
          numberOfChannels: numberOfChannels,
          position: { x: chunk.x, y: chunk.y, z: chunk.z }
        }
      }
      const samples =
        this._samplesPerPacket || chunk.pcm.length / numberOfChannels
      chunk.bitrate = this.getActualBitrate(samples, chunk.position != null)
      callback(null, chunk)
    })
    const codec = 'Opus'
    let seqNum = 0
    voiceStream
      .pipe(this._codecs.createEncoderStream(codec))
      .on('data', data => {
        const duration = this._codecs.getDuration(codec, data.frame) / 10
        this._voice.write({
          seqNum: seqNum,
          codec: codec,
          mode: target,
          frames: [data.frame],
          position: data.position,
          end: false
        })
        seqNum += duration
      })
      .on('end', () => {
        this._voice.write({
          seqNum: seqNum,
          codec: codec,
          mode: target,
          frames: [],
          end: true
        })
      })
    return voiceStream
  }

  /**
   * Method called when new voice packets arrive.
   * Forwards the packet to the source user.
   */
  _onVoice (chunk) {
    if (globalThis.window?.MUMBLE_DEBUG_AUDIO) {
      console.log('[MUMBLE-CLIENT-DEBUG] _onVoice called - source:', chunk.source, 'target:', chunk.target, 'codec:', chunk.codec, 'frames:', chunk.frames?.length);
    }
    const user = this._userById[chunk.source]
    if (!user) {
      if (globalThis.window?.MUMBLE_DEBUG_AUDIO) {
        console.warn('[MUMBLE-CLIENT-DEBUG] WARNING: User not found for source ID:', chunk.source, 'Available users:', Object.keys(this._userById));
      }
      return;
    }
    if (globalThis.window?.MUMBLE_DEBUG_AUDIO) {
      console.log('[MUMBLE-CLIENT-DEBUG] Found user:', user.name, 'Forwarding voice data');
    }
    user._onVoice(
      chunk.seqNum,
      chunk.codec,
      chunk.target,
      chunk.frames,
      chunk.position,
      chunk.end
    )
  }

  /**
   * Method called when new data packets arrive.
   * If there is a method named '_onPacketName', the data is forwarded to
   * that method, otherwise it is logged as unhandled.
   *
   * @param {object} chunk - The data packet
   */
  _onData (chunk) {
    if (this['_on' + chunk.name]) {
      this['_on' + chunk.name](chunk.payload)
    } else {
      console.warn('Unhandled data packet:', chunk)
    }
  }

  _onUDPTunnel (payload) {
    // Forward tunneled udp packets to the voice pipeline
    if (globalThis.window?.MUMBLE_DEBUG_AUDIO) {
      console.log('[MUMBLE-CLIENT-DEBUG] UDPTunnel packet received, length:', payload.length);
    }
    this._voiceDecoder.write(payload)
  }

  _onVersion (payload) {
    this.serverVersion = {
      major: payload.version >> 16,
      minor: (payload.version >> 8) & 0xff,
      patch: Math.trunc(payload.version) & 0xff,
      release: payload.release,
      os: payload.os,
      osVersion: payload.os_version || payload.osVersion
    }
    this.emit('serverVersion', this.serverVersion);
  }

  _onServerSync (payload) {
    // This packet finishes the initialization phase
    // Handle both snake_case (max_bandwidth) and camelCase (maxBandwidth)
    const maxBandwidth = payload.max_bandwidth || payload.maxBandwidth
    this.self = this._userById[payload.session]
    this.maxBandwidth = maxBandwidth
    this.welcomeMessage = payload.welcome_text || payload.welcomeText
    
    // Emit maxBandwidth change
    if (maxBandwidth !== undefined) {
      this.emit('maxBandwidthChange', maxBandwidth)
    }

    // Make sure we send regular ping packets to not get disconnected
    this._pinger = setInterval(() => {
      if (this._inFlightDataPings >= this._maxInFlightDataPings) {
        this._error('timeout')
        return
      }
      const dataStats = this._dataStats.getAll()
      const voiceStats = this._voiceStats.getAll()
      const timestamp = Date.now()
      const payload = {
        timestamp: timestamp
      }
      if (dataStats) {
        payload.tcp_packets = dataStats.n
        payload.tcp_ping_avg = dataStats.mean
        payload.tcp_ping_var = dataStats.variance
      }
      if (voiceStats) {
        payload.udp_packets = voiceStats.n
        payload.udp_ping_avg = voiceStats.mean
        payload.udp_ping_var = voiceStats.variance
      }
      this._send({
        name: 'Ping',
        payload: payload
      })
      this._inFlightDataPings++
    }, this._dataPingInterval)

    // We are now connected
    this.emit('connected')
  }

  _onPing (payload) {
    if (this._inFlightDataPings <= 0) {
      console.warn('Got unexpected ping message:', payload)
      return
    }
    this._inFlightDataPings--

    const now = Date.now()
    // Handle both Long objects and plain numbers
    const timestamp = payload.timestamp?.toNumber ? payload.timestamp.toNumber() : payload.timestamp
    const duration = now - timestamp
    this._dataStats.update(duration)
    this.emit('dataPing', duration)
  }

  // Handlers for server-sent informational packets
  // These packets don't require action but we log their contents for debugging
  
  _onServerConfig (payload) {
    // Server configuration (max message length, max bandwidth, etc.)
    console.log('[ServerConfig]', {
      maxBandwidth: payload.max_bandwidth || payload.maxBandwidth,
      maxMessageLength: payload.message_length || payload.messageLength,
      maxImageLength: payload.image_message_length || payload.imageMessageLength,
      maxUsers: payload.max_users || payload.maxUsers,
      welcomeText: payload.welcome_text || payload.welcomeText,
      allowHtml: payload.allow_html || payload.allowHtml,
      recordingAllowed: payload.recording_allowed || payload.recordingAllowed
    })
  }

  _onCodecVersion (payload) {
    // Server codec capabilities announcement
    console.log('[CodecVersion]', {
      alpha: payload.alpha,
      beta: payload.beta,
      preferAlpha: payload.prefer_alpha || payload.preferAlpha,
      opus: payload.opus
    })
  }

  _onCryptSetup (payload) {
    // UDP encryption setup (not used by WebSocket-based client)
    // Only log if client/server nonce present (indicates encryption handshake)
    if (payload.client_nonce || payload.server_nonce || payload.key) {
      console.log('[CryptSetup] UDP encryption keys exchanged (not used by WebSocket client)')
    }
  }

  _onPermissionQuery (payload) {
    // Server response to permission queries
    console.log('[PermissionQuery]', {
      channelId: payload.channel_id || payload.channelId,
      permissions: payload.permissions,
      flush: payload.flush
    })
  }

  _onUserStats (payload) {
    // Detailed user statistics (bandwidth, packets, etc.)
    const session = payload.session
    const user = this._userById[session]
    console.log('[UserStats]', {
      user: user ? user.name : `session ${session}`,
      version: payload.version,
      certificates: payload.certificates?.length || 0,
      fromClient: payload.from_client || payload.fromClient,
      fromServer: payload.from_server || payload.fromServer,
      udpPackets: payload.udp_packets || payload.udpPackets,
      tcpPackets: payload.tcp_packets || payload.tcpPackets,
      udpPingAvg: payload.udp_ping_avg || payload.udpPingAvg,
      tcpPingAvg: payload.tcp_ping_avg || payload.tcpPingAvg,
      onlineSeconds: payload.onlinesecs || payload.onlineSeconds,
      idleSeconds: payload.idlesecs || payload.idleSeconds,
      bandwidth: payload.bandwidth,
      celtVersions: payload.celt_versions || payload.celtVersions,
      opus: payload.opus,
      strongCertificate: payload.strong_certificate || payload.strongCertificate
    })
  }

  _onSuggestConfig (payload) {
    // Server suggestions for client configuration
    console.log('[SuggestConfig]', {
      version: payload.version,
      positional: payload.positional,
      pushToTalk: payload.push_to_talk || payload.pushToTalk
    })
  }


  _onReject (payload) {
    // We got rejected from the server for some reason.
    this.emit('reject', payload)
    this.disconnect()
  }

  _onPermissionDenied (payload) {
    if (payload.type === DenyType.Text) {
      this.emit('denied', 'Text', null, null, payload.reason)
    } else if (payload.type === DenyType.Permission) {
      const channelId = payload.channelId ?? payload.channel_id;
      const user = this._userById[payload.session]
      const channel = this._channelById[channelId]
      this.emit('denied', 'Permission', user, channel, payload.permission)
    } else if (payload.type === DenyType.SuperUser) {
      this.emit('denied', 'SuperUser', null, null, null)
    } else if (payload.type === DenyType.ChannelName) {
      this.emit('denied', 'ChannelName', null, null, payload.name)
    } else if (payload.type === DenyType.TextTooLong) {
      this.emit('denied', 'TextTooLong', null, null, null)
    } else if (payload.type === DenyType.TemporaryChannel) {
      this.emit('denied', 'TemporaryChannel', null, null, null)
    } else if (payload.type === DenyType.MissingCertificate) {
      const user = this._userById[payload.session]
      this.emit('denied', 'MissingCertificate', user, null, null)
    } else if (payload.type === DenyType.UserName) {
      this.emit('denied', 'UserName', null, null, payload.name)
    } else if (payload.type === DenyType.ChannelFull) {
      this.emit('denied', 'ChannelFull', null, null, null)
    } else if (payload.type === DenyType.NestingLimit) {
      this.emit('denied', 'NestingLimit', null, null, null)
    } else {
      throw new Error('Invalid DenyType: ' + payload.type)
    }
  }

  _onTextMessage (payload) {
    const channelIds = payload.channelId ?? payload.channel_id ?? [];
    const treeIds = payload.treeId ?? payload.tree_id ?? [];
    this.emit(
      'message',
      this._userById[payload.actor],
      payload.message,
      payload.session.map(id => this._userById[id]),
      channelIds.map(id => this._channelById[id]),
      treeIds.map(id => this._channelById[id])
    )
  }

  _onChannelState (payload) {
    const channelId = payload.channelId ?? payload.channel_id;
    let channel = this._channelById[channelId]
    if (!channel) {
      channel = new Channel(this, channelId)
      this._channelById[channel._id] = channel
      this.channels.push(channel)
      this.emit('newChannel', channel)
    }
    for (const otherId of (payload.links_remove || [])) {
      const otherChannel = this._channelById[otherId]
      if (otherChannel?.links.includes(channel)) {
        otherChannel._update({
          links_remove: [channelId]
        })
      }
    }
    channel._update(payload)
  }

  _onChannelRemove (payload) {
    const channelId = payload.channelId ?? payload.channel_id;
    const channel = this._channelById[channelId]
    if (channel) {
      channel._remove()
      delete this._channelById[channel._id]
      removeValue(this.channels, channel)
    }
  }

  _onUserState (payload) {
    let user = this._userById[payload.session]
    if (!user) {
      user = new User(this, payload.session)
      this._userById[user._id] = user
      this.users.push(user)
      this.emit('newUser', user)

      // For some reason, the mumble protocol does not send the initial
      // channel of a client if it is the root channel
      payload.channelId = payload.channelId ?? payload.channel_id ?? 0
    }
    user._update(payload)
  }

  _onUserRemove (payload) {
    const user = this._userById[payload.session]
    if (user) {
      user._remove(this._userById[payload.actor], payload.reason, payload.ban)
      delete this._userById[user._id]
      removeValue(this.users, user)
    }
  }

  /**
   * Disconnect from the remote server.
   * Once disconnected, this client may not be used again.
   * Does nothing when not connected.
   */
  disconnect () {
    if (this._disconnected) {
      return
    }
    this._disconnected = true
    this._voice.end()
    this._data.end()
    clearInterval(this._pinger)

    this.emit('disconnected')
  }

  /**
   * Set preferred audio bitrate and samples per packet.
   *
   * The {@link PCMData} passed to the stream returned by {@link createVoiceStream} must
   * contain the appropriate amount of samples per channel for bandwidth control to
   * function as expected.
   *
   * If this method is never called or false is passed as one of the values, then the
   * samplesPerPacket are determined by inspecting the {@link PCMData} passed and the
   * bitrate is calculated from the maximum bitrate advertised by the server.
   *
   * @param {number} bitrate - Preferred audio bitrate, sensible values are 8k to 96k
   * @param {number} samplesPerPacket - Amount of samples per packet, valid values depend on the codec used but all should support 10ms (i.e. 480), 20ms, 40ms and 60ms
   */
  setAudioQuality (bitrate, samplesPerPacket) {
    this._preferredBitrate = bitrate
    this._samplesPerPacket = samplesPerPacket
  }

  /**
   * Calculate the actual bitrate taking into account maximum and preferred bitrate.
   */
  getActualBitrate (samplesPerPacket, sendPosition) {
    const bitrate = this.getPreferredBitrate(samplesPerPacket, sendPosition)
    
    // If server doesn't send max_bandwidth, use preferred bitrate
    if (this.maxBandwidth === undefined) {
      return bitrate
    }
    
    const bandwidth = MumbleClient.calcEnforcableBandwidth(
      bitrate,
      samplesPerPacket,
      sendPosition
    )
    if (bandwidth <= this.maxBandwidth) {
      return bitrate
    } else {
      return this.getMaxBitrate(samplesPerPacket, sendPosition)
    }
  }

  /**
   * Returns the preferred bitrate set by {@link setAudioQuality} or
   * {@link getMaxBitrate} if not set.
   */
  getPreferredBitrate (samplesPerPacket, sendPosition) {
    if (this._preferredBitrate) {
      return this._preferredBitrate
    }
    // If server doesn't send max_bandwidth, use a reasonable default (40000 bps = 40 kbit/s)
    if (this.maxBandwidth === undefined) {
      return 40000
    }
    return this.getMaxBitrate(samplesPerPacket, sendPosition)
  }

  /**
   * Calculate the maximum bitrate possible given the current server bandwidth limit.
   */
  getMaxBitrate (samplesPerPacket, sendPosition) {
    const overhead = MumbleClient.calcEnforcableBandwidth(
      0,
      samplesPerPacket,
      sendPosition
    )
    return this.maxBandwidth - overhead
  }

  /**
   * Calculate the bandwidth used if IP/UDP packets were used to transmit audio.
   * This matches the value used by Mumble servers to enforce bandwidth limits.
   * @returns {number} bits per second
   */
  static calcEnforcableBandwidth (bitrate, samplesPerPacket, sendPosition) {
    // IP + UDP + Crypt + Header + SeqNum (VarInt) + Codec Header + Optional Position
    // Codec Header depends on codec:
    //  - Opus is always 4 (just the length as VarInt)
    //  - CELT/Speex depends on frames (10ms) per packet (1 byte each)
    const codecHeaderBytes = Math.max(4, samplesPerPacket / 480)
    const packetBytes =
      20 + 8 + 4 + 1 + 4 + codecHeaderBytes + (sendPosition ? 12 : 0)
    const packetsPerSecond = 48000 / samplesPerPacket
    return Math.round(packetBytes * 8 * packetsPerSecond + bitrate)
  }

  /**
   * Find a channel by name.
   * If no such channel exists, return null.
   *
   * @param {string} name - The full name of the channel
   * @returns {?Channel}
   */
  getChannel (name) {
    for (const channel of this.channels) {
      if (channel.name === name) {
        return channel
      }
    }
    return null
  }

  setSelfMute (mute) {
    const message = {
      name: 'UserState',
      payload: {
        session: this.self._id
      }
    }
    // Protobuf.js converts snake_case proto fields to camelCase in JavaScript
    // So we must use selfMute (not self_mute) even though the .proto file has self_mute
    if (mute) {
      message.payload.selfMute = true
    } else {
      message.payload.selfMute = false
    }
    this._send(message)
  }

  setSelfDeaf (deaf) {
    const message = {
      name: 'UserState',
      payload: {
        session: this.self._id
      }
    }
    // Protobuf.js converts snake_case proto fields to camelCase in JavaScript
    if (deaf) {
      message.payload.selfDeaf = true
      // When deafening, also mute (standard Mumble behavior)
      message.payload.selfMute = true
    } else {
      message.payload.selfDeaf = false
      message.payload.selfMute = false
    }
    this._send(message)
  }

  setSelfTexture (texture) {
    this._send({
      name: 'UserState',
      payload: {
        session: this.self._id,
        texture: texture
      }
    })
  }

  setSelfComment (comment) {
    this._send({
      name: 'UserState',
      payload: {
        session: this.self._id,
        comment: comment
      }
    })
  }

  setPluginContext (context) {
    this._send({
      name: 'UserState',
      payload: {
        session: this.self._id,
        plugin_context: context
      }
    })
  }

  setPluginIdentity (identity) {
    this._send({
      name: 'UserState',
      payload: {
        session: this.self._id,
        plugin_identity: identity
      }
    })
  }

  setRecording (recording) {
    this._send({
      name: 'UserState',
      payload: {
        session: this.self._id,
        recording: recording
      }
    })
  }

  getChannelById (id) {
    return this._channelById[id]
  }

  getUserById (id) {
    return this._userById[id]
  }

  get root () {
    return this._channelById[0]
  }

  get connected () {
    return !this._disconnected && this._dataStream != null
  }

  get dataStats () {
    return this._dataStats.getAll()
  }

  get voiceStats () {
    return this._voiceStats.getAll()
  }
}

export default MumbleClient
