import { EventEmitter } from 'node:events'
import Timer from 'rtimer'
import { debugLog } from '../utils/debug-utils.js'

class User extends EventEmitter {
  constructor (client, id) {
    super()
    this._client = client
    this._id = id
    this._haveRequestedTexture = false
    this._haveRequestedComment = false
  }

  /**
   * Updates a single field if the message contains it.
   * @private
   */
  _updateField (msg, msgKey, changeKey, privateKey) {
    if (msg[msgKey] != null) {
      this[privateKey] = msg[msgKey]
      return { [changeKey]: msg[msgKey] }
    }
    return {}
  }

  /**
   * Updates boolean flags with optional invalidation side effects.
   * @private
   */
  _updateWithInvalidation (msg, msgKey, changeKey, privateKey, shouldInvalidate) {
    if (msg[msgKey] != null) {
      this[privateKey] = msg[msgKey]
      if (shouldInvalidate) {
        shouldInvalidate.call(this)
      }
      return { [changeKey]: msg[msgKey] }
    }
    return {}
  }

  _update (msg) {
    const changes = {}
    
    // Simple field updates (using camelCase field names from protobufjs)
    Object.assign(changes,
      this._updateField(msg, 'name', 'username', '_username'),
      this._updateField(msg, 'userId', 'uniqueId', '_uniqueId'),
      this._updateField(msg, 'mute', 'mute', '_mute'),
      this._updateField(msg, 'deaf', 'deaf', '_deaf'),
      this._updateField(msg, 'suppress', 'suppress', '_suppress'),
      this._updateField(msg, 'selfMute', 'selfMute', '_selfMute'),
      this._updateField(msg, 'selfDeaf', 'selfDeaf', '_selfDeaf'),
      this._updateField(msg, 'texture', 'texture', '_texture'),
      this._updateField(msg, 'comment', 'comment', '_comment'),
      this._updateField(msg, 'prioritySpeaker', 'prioritySpeaker', '_prioritySpeaker'),
      this._updateField(msg, 'recording', 'recording', '_recording'),
      this._updateField(msg, 'hash', 'certHash', '_certHash')
    )

    // Hash updates with invalidation
    Object.assign(changes,
      this._updateWithInvalidation(msg, 'textureHash', 'textureHash', '_textureHash', 
        () => { this._haveRequestedTexture = false }),
      this._updateWithInvalidation(msg, 'commentHash', 'commentHash', '_commentHash',
        () => { this._haveRequestedComment = false })
    )

    // SERVER-STATE-SYNC: Synchronize UI with server's authoritative state
    // When server sends UserState update, it's the SINGLE SOURCE OF TRUTH
    if (this === this._client.self && (changes.selfMute !== undefined || changes.selfDeaf !== undefined)) {
      // Emit server state change for UI sync
      this.emit('server-state-sync', {
        selfMute: this._selfMute,
        selfDeaf: this._selfDeaf
      });
    }

    // Channel update (special case with side effects)
    const newChannelId = msg.channelId;
    if (newChannelId != null) {
      if (this.channel) {
        const index = this.channel.users.indexOf(this)
        if (index !== -1) {
          this.channel.users.splice(index, 1)
        }
      }
      this._channelId = newChannelId
      if (this.channel) {
        this.channel.users.push(this)
      }
      changes.channel = this.channel
    }

    this.emit('update', this._client._userById[msg.actor], changes)
  }

  _remove (actor, reason, ban) {
    if (this.channel) {
      const index = this.channel.users.indexOf(this)
      if (index !== -1) {
        this.channel.users.splice(index, 1)
      }
    }
    this.emit('remove', actor, reason, ban)
  }

  /**
   * Creates a codec stream for voice decoding.
   * Note: codecs are always provided in browser environment (set in worker.js)
   * @private
   */
  _createVoiceCodecStream () {
    debugLog('[MUMBLE-USER]', 'Creating decoder stream with codecs')
    return this._client._codecs.createDecoderStream(this)
  }

  /**
   * Sets up voice stream lifecycle handlers and timeout.
   * @private
   */
  _setupVoiceStream (stream) {
    stream.once('close', () => {
      debugLog('[MUMBLE-USER]', 'Voice stream closed for user:', this._username)
      this._voice = null
    })
    
    this._voiceTimeout = new Timer(() => {
      if (this._voice != null) {
        this._voice.end()
        this._voice = null
      }
    }, this._client._options.userVoiceTimeout || 200).set()
    
    debugLog('[MUMBLE-USER]', 'Emitting "voice" event with stream')
    this.emit('voice', stream)
  }

  _getOrCreateVoiceStream () {
    if (this._voice) {
      debugLog('[MUMBLE-USER]', 'Voice stream already exists, reusing existing stream')
      return this._voice
    }

    // New transmission
    debugLog('[MUMBLE-USER]', 'Creating new voice stream for user:', this._username, 'id:', this._id)
    
    this._voice = this._createVoiceCodecStream()
    this._setupVoiceStream(this._voice)
    
    return this._voice
  }

  /**
   * Calculates the duration of audio frames.
   * Note: codecs are always provided in browser environment (set in worker.js)
   * @private
   */
  _getDuration (codec, frames) {
    let duration = 0
    for (const frame of frames) {
      duration += this._client._codecs.getDuration(codec, frame)
    }
    return duration
  }

  /**
   * Handles packet loss by inserting empty frames for lost packets.
   * @param {number} seqNum - Current sequence number
   * @param {number} duration - Duration of current packet
   * @param {string} codec - Codec type
   * @param {number} target - Target destination
   * @param {*} position - Position data
   */
  _handlePacketLoss (seqNum, duration, codec, target, position) {
    // Check if this is a late packet
    if (this._lastVoiceSeqId > seqNum) {
      return false // Packet is late, should be dropped
    }

    // Calculate lost packets
    const expectedSeqNum = this._lastVoiceSeqId + 1
    if (seqNum > expectedSeqNum) {
      let lost = seqNum - this._lastVoiceSeqId - 1
      // Cap at 10 lost frames, the audio will sound broken at that point anyway
      if (lost > 10) {
        lost = 10
      }
      this._insertEmptyFrames(lost, codec, target, position)
    }
    
    return true // Packet is valid
  }

  /**
   * Inserts empty frames to account for packet loss.
   */
  _insertEmptyFrames (count, codec, target, position) {
    for (let i = 0; i < count; i++) {
      this._getOrCreateVoiceStream().write({
        target: target,
        codec: codec,
        frame: null,
        position: position
      })
    }
  }

  /**
   * Writes a single frame to the voice stream.
   */
  _writeFrame (frame, codec, target, position) {
    const writeData = {
      target: target,
      codec: codec,
      frame: frame,
      position: position
    }
    debugLog('[MUMBLE-USER]', 'Writing frame to voice stream, frame length:', frame?.length || 'null')
    this._getOrCreateVoiceStream().write(writeData)
  }

  /**
   * Ends the voice transmission and cleans up the stream.
   */
  _endVoiceTransmission () {
    if (this._voice) {
      this._voiceTimeout.clear()
      this._voiceTimeout = null
      this._voice.end()
      this._voice = null
    }
  }

  /**
   * This method filters and inserts empty frames as needed to account
   * for packet loss and then writes to the {@link #_voice} stream.
   * If this is a new transmission it emits the 'voice' event and if
   * the transmission has ended it closes the stream.
   */
  _onVoice (seqNum, codec, target, frames, position, end) {
    debugLog('[MUMBLE-USER]', '_onVoice called - seqNum:', seqNum, 'codec:', codec, 'frames:', frames.length, 'end:', end)

    if (frames.length > 0) {
      const duration = this._getDuration(codec, frames)
      
      // Handle packet loss for ongoing transmissions
      if (this._voice != null) {
        const isValid = this._handlePacketLoss(seqNum, duration, codec, target, position)
        if (!isValid) {
          return
        }
      }

      // Write all frames to the stream
      for (const frame of frames) {
        this._writeFrame(frame, codec, target, position)
      }

      this._voiceTimeout.set()
      this._lastVoiceSeqId = seqNum + duration / 10 - 1
    }

    if (end) {
      this._endVoiceTransmission()
    }
  }

  setMute (mute) {
    const message = {
      name: 'UserState',
      payload: {
        session: this._id,
        mute: mute
      }
    }
    if (!mute) message.payload.deaf = false
    this._client._send(message)
  }

  setDeaf (deaf) {
    const message = {
      name: 'UserState',
      payload: {
        session: this._id,
        deaf: deaf
      }
    }
    if (deaf) message.payload.mute = true
    this._client._send(message)
  }

  clearComment () {
    this._client._send({
      name: 'UserState',
      payload: {
        session: this._id,
        comment: ''
      }
    })
  }

  clearTexture () {
    this._client._send({
      name: 'UserState',
      payload: {
        session: this._id,
        texture: ''
      }
    })
  }

  requestComment () {
    if (this._haveRequestedComment) return
    this._client._send({
      name: 'RequestBlob',
      payload: {
        session_comment: this._id
      }
    })
    this._haveRequestedComment = true
  }

  requestTexture () {
    if (this._haveRequestedTexture) return
    this._client._send({
      name: 'RequestBlob',
      payload: {
        session_texture: this._id
      }
    })
    this._haveRequestedTexture = true
  }

  register () {
    this._client._send({
      name: 'UserState',
      payload: {
        session: this._id,
        userId: 0
      }
    })
  }

  sendMessage (message) {
    this._client._send({
      name: 'TextMessage',
      payload: {
        session: this._id,
        message: message
      }
    })
  }

  setChannel (channel) {
    this._client._send({
      name: 'UserState',
      payload: {
        session: this._id,
        channelId: channel._id
      }
    })
  }

  get id () {
    return this._id
  }

  get username () {
    return this._username
  }

  set username (to) {
    throw new Error('Cannot set username.')
  }

  get uniqueId () {
    return this._uniqueId
  }

  set uniqueId (to) {
    throw new Error('Cannot set uniqueId. Maybe try #register()?')
  }

  get mute () {
    return this._mute
  }

  set mute (to) {
    throw new Error('Cannot set mute. Use #setMute(mute) instead.')
  }

  get deaf () {
    return this._deaf
  }

  set deaf (to) {
    throw new Error('Cannot set deaf. Use #setDeaf(deaf) instead.')
  }

  get selfMute () {
    return this._selfMute
  }

  set selfMute (to) {
    throw new Error(
      'Cannot set selfMute. Use Client#setSelfMute(mute) instead.'
    )
  }

  get selfDeaf () {
    return this._selfDeaf
  }

  set selfDeaf (to) {
    throw new Error(
      'Cannot set selfDeaf. Use Client#setSelfDeaf(deaf) instead.'
    )
  }

  get suppress () {
    return this._suppress
  }

  set suppress (to) {
    throw new Error('Cannot set suppress.')
  }

  get texture () {
    return this._texture
  }

  set texture (to) {
    throw new Error(
      'Cannot set texture. Use Client#setSelfTexture(texture) or #clearTexture() instead.'
    )
  }

  get textureHash () {
    return this._textureHash
  }

  set textureHash (to) {
    throw new Error('Cannot set textureHash.')
  }

  get comment () {
    return this._comment
  }

  set comment (to) {
    throw new Error(
      'Cannot set comment. Use Client#setSelfTexture(texture) or #clearComment() instead.'
    )
  }

  get commentHash () {
    return this._commentHash
  }

  set commentHash (to) {
    throw new Error('Cannot set commentHash.')
  }

  get prioritySpeaker () {
    return this._prioritySpeaker
  }

  set prioritySpeaker (to) {
    throw new Error(
      'Cannot set prioritySpeaker. Use #setPrioritySpeaker(prioSpeaker) instead.'
    )
  }

  get recording () {
    return this._recording
  }

  set recording (to) {
    throw new Error(
      'Cannot set recording. Use Client#setSelfRecording(recording) instead.'
    )
  }

  get certHash () {
    return this._certHash
  }

  set certHash (to) {
    throw new Error('Cannot set certHash.')
  }

  get channel () {
    return this._channelId == null
      ? null
      : this._client._channelById[this._channelId]
  }

  set channel (to) {
    throw new Error('Cannot set channel. Use #setChannel(channel) instead.')
  }
}

export default User
