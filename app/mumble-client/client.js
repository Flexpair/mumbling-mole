/* global Buffer, console, setInterval, clearInterval, process */
import mumbleStreams from '../mumble-streams/index.js'
import { calcEnforcableBandwidth, getMaxBitrate, getPreferredBitrate, getActualBitrate } from '../utils/AudioBandwidthCalculator.js'
import { handlePermissionDenied } from './handlers/PermissionDeniedHandler.js'
import duplexer from '../utils/duplexer-lite.js'
import { EventEmitter } from 'node:events'
import through2 from '../utils/through2-lite.js'
import { getOSName, getOSVersion } from './utils.js'
import { handleTextMessage } from './handlers/MessageHandler.js'
import { handleChannelState, handleChannelRemove } from './handlers/ChannelHandler.js'
import { handleUserState, handleUserRemove } from './handlers/UserHandler.js'
import { handleServerSync, handlePing } from './handlers/NetworkStatsHandler.js'
import { handleServerConfig, handleCodecVersion, handleCryptSetup, handlePermissionQuery, handleUserStats, handleSuggestConfig } from './handlers/ServerConfigHandler.js'
import Stats from '../utils/stats-lite.js'
import { debugLog } from '../utils/debug-utils.js'

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
 * @param {import('./user.js').default} user - The user
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
    const isTextMessage = msg.name === 'TextMessage';
    const writeSucceeded = this._data.write(msg);
    
    if (isTextMessage) {
      // Emit event immediately if stream returned true (not buffering)
      // Only register drain listener if not already waiting
      // This prevents memory leak from accumulating listeners during rapid sends
      if (!writeSucceeded && !this._waitingForDrain) {
        this._waitingForDrain = true;
        this._data.once('drain', () => {
          this._waitingForDrain = false;
          this.emit('messageSent', msg.payload.message);
        });
      } else if (writeSucceeded) {
        this.emit('messageSent', msg.payload.message);
      }
    }
  }

  /**
   * Connects this client to a duplex stream that is used for the data channel.
   * The provided duplex stream is expected to be valid and usable.
   * Calling this method will begin the initialization of the connection.
   *
   * @param stream - The stream used for the data channel.
   * @returns {Promise} Promise that resolves when the connection has been established.
   */
  connectDataStream (stream) {
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
        celt_versions: [],
        opus: (this._codecs || { opus: false }).opus
      }
    })

    return new Promise((resolve, reject) => {
      this.once('connected', () => resolve(this))
      this.once('reject', reject)
      this.once('error', reject)
    })
  }

  /**
   * Creates a voice stream for audio transmission.
   * Note: codecs are always provided in browser environment (set in worker.js)
   */
  createVoiceStream (target = 0, numberOfChannels = 1) {
    const transformVoiceChunk = (chunk, encoding, callback) => {
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
        const nextChunk = {
          target: target,
          pcm: chunk.pcm,
          numberOfChannels: numberOfChannels
        };
        const hasPosition = Number.isFinite(chunk.x) && Number.isFinite(chunk.y) && Number.isFinite(chunk.z);
        if (hasPosition) {
          nextChunk.position = { x: chunk.x, y: chunk.y, z: chunk.z };
        }
        chunk = nextChunk;
      }
      const samples =
        this._samplesPerPacket || chunk.pcm.length / numberOfChannels
      chunk.bitrate = this.getActualBitrate(samples, chunk.position !== null)
      callback(null, chunk)
    }

    const voiceStream = through2.obj(transformVoiceChunk)
    const codec = 'Opus'
    let seqNum = 0

    const onEncoderData = data => {
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
    }

    const onEncoderEnd = () => {
      this._voice.write({
        seqNum: seqNum,
        codec: codec,
        mode: target,
        frames: [],
        end: true
      })
    }

    voiceStream
      .pipe(this._codecs.createEncoderStream(codec))
      .on('data', onEncoderData)
      .on('end', onEncoderEnd)
    return voiceStream
  }

  /**
   * Method called when new voice packets arrive.
   * Forwards the packet to the source user.
   */
  _onVoice (chunk) {
    debugLog('[MUMBLE-CLIENT]', '_onVoice called - source:', chunk.source, 'target:', chunk.target, 'codec:', chunk.codec, 'frames:', chunk.frames?.length)
    const user = this._userById[chunk.source]
    if (!user) {
      debugLog('[MUMBLE-CLIENT]', 'WARNING: User not found for source ID:', chunk.source, 'Available users:', Object.keys(this._userById))
      return;
    }
    debugLog('[MUMBLE-CLIENT]', 'Found user:', user.name, 'Forwarding voice data')
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
    switch (chunk.name) {
      case 'UDPTunnel': this._onUDPTunnel(chunk.payload); break;
      case 'Version': this._onVersion(chunk.payload); break;
      case 'ServerSync': this._onServerSync(chunk.payload); break;
      case 'Ping': this._onPing(chunk.payload); break;
      case 'ServerConfig': this._onServerConfig(chunk.payload); break;
      case 'CodecVersion': this._onCodecVersion(chunk.payload); break;
      case 'CryptSetup': this._onCryptSetup(chunk.payload); break;
      case 'PermissionQuery': this._onPermissionQuery(chunk.payload); break;
      case 'UserStats': this._onUserStats(chunk.payload); break;
      case 'SuggestConfig': this._onSuggestConfig(chunk.payload); break;
      case 'Reject': this._onReject(chunk.payload); break;
      case 'PermissionDenied': this._onPermissionDenied(chunk.payload); break;
      case 'TextMessage': this._onTextMessage(chunk.payload); break;
      case 'ChannelState': this._onChannelState(chunk.payload); break;
      case 'ChannelRemove': this._onChannelRemove(chunk.payload); break;
      case 'UserState': this._onUserState(chunk.payload); break;
      case 'UserRemove': this._onUserRemove(chunk.payload); break;
      default:
        console.warn('Unhandled data packet:', chunk)
    }
  }

  _onUDPTunnel (payload) {
    // Forward tunneled udp packets to the voice pipeline
    debugLog('[MUMBLE-CLIENT]', 'UDPTunnel packet received, length:', payload.length)
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
    handleServerSync(this, payload);
  }

  _onPing (payload) {
    handlePing(this, payload);
  }

  // Handlers for server-sent informational packets
  // These packets don't require action but we log their contents for debugging
  
  _onServerConfig (payload) {
    handleServerConfig(this, payload);
  }

  _onCodecVersion (payload) {
    handleCodecVersion(this, payload);
  }

  _onCryptSetup (payload) {
    handleCryptSetup(this, payload);
  }

  _onPermissionQuery (payload) {
    handlePermissionQuery(this, payload);
  }

  _onUserStats (payload) {
    handleUserStats(this, payload);
  }

  _onSuggestConfig (payload) {
    handleSuggestConfig(this, payload);
  }


  _onReject (payload) {
    // We got rejected from the server for some reason.
    this.emit('reject', payload)
    this.disconnect()
  }

  _onPermissionDenied (payload) {
    handlePermissionDenied(this, payload);
  }

  _onTextMessage (payload) {
    handleTextMessage(this, payload);
  }

  _onChannelState (payload) {
    handleChannelState(this, payload);
  }

  _onChannelRemove (payload) {
    handleChannelRemove(this, payload);
  }

  _onUserState (payload) {
    handleUserState(this, payload);
  }

  _onUserRemove (payload) {
    handleUserRemove(this, payload);
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
    return getActualBitrate(this._preferredBitrate, this.maxBandwidth, samplesPerPacket, sendPosition)
  }

  /**
   * Returns the preferred bitrate set by {@link setAudioQuality} or
   * {@link getMaxBitrate} if not set.
   */
  getPreferredBitrate (samplesPerPacket, sendPosition) {
    return getPreferredBitrate(this._preferredBitrate, this.maxBandwidth, samplesPerPacket, sendPosition)
  }

  /**
   * Calculate the maximum bitrate possible given the current server bandwidth limit.
   */
  getMaxBitrate (samplesPerPacket, sendPosition) {
    return getMaxBitrate(this.maxBandwidth, samplesPerPacket, sendPosition)
  }

  /**
   * Calculate the bandwidth used if IP/UDP packets were used to transmit audio.
   * This matches the value used by Mumble servers to enforce bandwidth limits.
   * @returns {number} bits per second
   */
  static calcEnforcableBandwidth (bitrate, samplesPerPacket, sendPosition) {
    return calcEnforcableBandwidth(bitrate, samplesPerPacket, sendPosition)
  }

  /**
   * Find a channel by name.
   * If no such channel exists, return null.
   *
   * @param {string} name - The full name of the channel
   * @returns {?import('./channel.js').default}
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
    if ((typeof process !== 'undefined' && process.env?.NODE_ENV !== 'production') || globalThis.MUMBLE_DEBUG) {
      console.log('[CLIENT-STATE-SEND] Sending selfMute to server:', mute);
    }
    const message = {
      name: 'UserState',
      payload: {
        session: this.self._id
      }
    }
    // protobufjs converts camelCase to snake_case on the wire automatically
    if (mute) {
      message.payload.selfMute = true
    } else {
      message.payload.selfMute = false
    }
    this._send(message)
  }

  setSelfDeaf (deaf) {
    if ((typeof process !== 'undefined' && process.env?.NODE_ENV !== 'production') || globalThis.MUMBLE_DEBUG) {
      console.log('[CLIENT-STATE-SEND] Sending selfDeaf to server:', deaf, deaf ? '(auto-mute)' : '(preserve mute)');
    }
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
      // When undeafening, do NOT change mute status - preserve user's choice
      // Only send selfDeaf=false to server, let mute state remain as-is
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
    return !this._disconnected && this._dataStream !== null
  }

  get dataStats () {
    return this._dataStats.getAll()
  }

  get voiceStats () {
    return this._voiceStats.getAll()
  }
}

export default MumbleClient
