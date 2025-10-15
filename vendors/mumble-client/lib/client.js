"use strict";

function _typeof(o) { "@babel/helpers - typeof"; return _typeof = "function" == typeof Symbol && "symbol" == typeof Symbol.iterator ? function (o) { return typeof o; } : function (o) { return o && "function" == typeof Symbol && o.constructor === Symbol && o !== Symbol.prototype ? "symbol" : typeof o; }, _typeof(o); }
Object.defineProperty(exports, "__esModule", {
  value: true
});
exports["default"] = void 0;
var _mumbleStreams = _interopRequireDefault(require("mumble-streams"));
var _reduplexer = _interopRequireDefault(require("reduplexer"));
var _events = require("events");
var _through = _interopRequireDefault(require("through2"));
var _promise = _interopRequireDefault(require("promise"));
var _dropStream = _interopRequireDefault(require("drop-stream"));
var _utils = require("./utils.js");
var _user2 = _interopRequireDefault(require("./user"));
var _channel = _interopRequireDefault(require("./channel"));
var _removeValue = _interopRequireDefault(require("remove-value"));
var _statsIncremental = _interopRequireDefault(require("stats-incremental"));
function _interopRequireDefault(e) { return e && e.__esModule ? e : { "default": e }; }
function _createForOfIteratorHelper(r, e) { var t = "undefined" != typeof Symbol && r[Symbol.iterator] || r["@@iterator"]; if (!t) { if (Array.isArray(r) || (t = _unsupportedIterableToArray(r)) || e && r && "number" == typeof r.length) { t && (r = t); var _n = 0, F = function F() {}; return { s: F, n: function n() { return _n >= r.length ? { done: !0 } : { done: !1, value: r[_n++] }; }, e: function e(r) { throw r; }, f: F }; } throw new TypeError("Invalid attempt to iterate non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method."); } var o, a = !0, u = !1; return { s: function s() { t = t.call(r); }, n: function n() { var r = t.next(); return a = r.done, r; }, e: function e(r) { u = !0, o = r; }, f: function f() { try { a || null == t["return"] || t["return"](); } finally { if (u) throw o; } } }; }
function _unsupportedIterableToArray(r, a) { if (r) { if ("string" == typeof r) return _arrayLikeToArray(r, a); var t = {}.toString.call(r).slice(8, -1); return "Object" === t && r.constructor && (t = r.constructor.name), "Map" === t || "Set" === t ? Array.from(r) : "Arguments" === t || /^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(t) ? _arrayLikeToArray(r, a) : void 0; } }
function _arrayLikeToArray(r, a) { (null == a || a > r.length) && (a = r.length); for (var e = 0, n = Array(a); e < a; e++) n[e] = r[e]; return n; }
function _classCallCheck(a, n) { if (!(a instanceof n)) throw new TypeError("Cannot call a class as a function"); }
function _defineProperties(e, r) { for (var t = 0; t < r.length; t++) { var o = r[t]; o.enumerable = o.enumerable || !1, o.configurable = !0, "value" in o && (o.writable = !0), Object.defineProperty(e, _toPropertyKey(o.key), o); } }
function _createClass(e, r, t) { return r && _defineProperties(e.prototype, r), t && _defineProperties(e, t), Object.defineProperty(e, "prototype", { writable: !1 }), e; }
function _toPropertyKey(t) { var i = _toPrimitive(t, "string"); return "symbol" == _typeof(i) ? i : i + ""; }
function _toPrimitive(t, r) { if ("object" != _typeof(t) || !t) return t; var e = t[Symbol.toPrimitive]; if (void 0 !== e) { var i = e.call(t, r || "default"); if ("object" != _typeof(i)) return i; throw new TypeError("@@toPrimitive must return a primitive value."); } return ("string" === r ? String : Number)(t); }
function _callSuper(t, o, e) { return o = _getPrototypeOf(o), _possibleConstructorReturn(t, _isNativeReflectConstruct() ? Reflect.construct(o, e || [], _getPrototypeOf(t).constructor) : o.apply(t, e)); }
function _possibleConstructorReturn(t, e) { if (e && ("object" == _typeof(e) || "function" == typeof e)) return e; if (void 0 !== e) throw new TypeError("Derived constructors may only return object or undefined"); return _assertThisInitialized(t); }
function _assertThisInitialized(e) { if (void 0 === e) throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); return e; }
function _isNativeReflectConstruct() { try { var t = !Boolean.prototype.valueOf.call(Reflect.construct(Boolean, [], function () {})); } catch (t) {} return (_isNativeReflectConstruct = function _isNativeReflectConstruct() { return !!t; })(); }
function _getPrototypeOf(t) { return _getPrototypeOf = Object.setPrototypeOf ? Object.getPrototypeOf.bind() : function (t) { return t.__proto__ || Object.getPrototypeOf(t); }, _getPrototypeOf(t); }
function _inherits(t, e) { if ("function" != typeof e && null !== e) throw new TypeError("Super expression must either be null or a function"); t.prototype = Object.create(e && e.prototype, { constructor: { value: t, writable: !0, configurable: !0 } }), Object.defineProperty(t, "prototype", { writable: !1 }), e && _setPrototypeOf(t, e); }
function _setPrototypeOf(t, e) { return _setPrototypeOf = Object.setPrototypeOf ? Object.setPrototypeOf.bind() : function (t, e) { return t.__proto__ = e, t; }, _setPrototypeOf(t, e); }
var DenyType = _mumbleStreams["default"].data.messages.PermissionDenied.DenyType;

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
var MumbleClient = /*#__PURE__*/function (_EventEmitter) {
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
  function MumbleClient(options) {
    var _this;
    _classCallCheck(this, MumbleClient);
    _this = _callSuper(this, MumbleClient);
    if (!options.username) {
      throw new Error('No username given');
    }
    _this._options = options || {};
    _this._username = options.username;
    _this._password = options.password;
    _this._tokens = options.tokens;
    _this._codecs = options.codecs;
    _this._dataPingInterval = options.dataPingInterval || 5000;
    _this._maxInFlightDataPings = options.maxInFlightDataPings || 2;
    _this._dataStats = new _statsIncremental["default"]();
    _this._voiceStats = new _statsIncremental["default"]();
    _this._userById = {};
    _this._channelById = {};
    _this.users = [];
    _this.channels = [];
    _this._dataEncoder = new _mumbleStreams["default"].data.Encoder();
    _this._dataDecoder = new _mumbleStreams["default"].data.Decoder();
    _this._voiceEncoder = new _mumbleStreams["default"].voice.Encoder('server');
    _this._voiceDecoder = new _mumbleStreams["default"].voice.Decoder('server');
    _this._data = (0, _reduplexer["default"])(_this._dataEncoder, _this._dataDecoder, {
      objectMode: true
    });
    _this._voice = (0, _reduplexer["default"])(_this._voiceEncoder, _this._voiceDecoder, {
      objectMode: true
    });
    _this._data.on('data', _this._onData.bind(_this));
    _this._voice.on('data', _this._onVoice.bind(_this));
    _this._voiceEncoder.on('data', function (data) {
      // TODO This should only be the fallback option
      _this._data.write({
        name: 'UDPTunnel',
        payload: data
      });
    });
    _this._voiceDecoder.on('unknown_codec', function (codecId) {
      return _this.emit('unknown_codec', codecId);
    });
    _this._data.on('end', _this.disconnect.bind(_this));
    _this._registerErrorHandler(_this._data, _this._voice, _this._dataEncoder, _this._dataDecoder, _this._voiceEncoder, _this._voiceDecoder);
    _this._disconnected = false;
    return _this;
  }
  _inherits(MumbleClient, _EventEmitter);
  return _createClass(MumbleClient, [{
    key: "_registerErrorHandler",
    value: function _registerErrorHandler() {
      var _iterator = _createForOfIteratorHelper(arguments),
        _step;
      try {
        for (_iterator.s(); !(_step = _iterator.n()).done;) {
          var obj = _step.value;
          obj.on('error', this._error.bind(this));
        }
      } catch (err) {
        _iterator.e(err);
      } finally {
        _iterator.f();
      }
    }
  }, {
    key: "_error",
    value: function _error(reason) {
      this.emit('error', reason);
      this.disconnect();
    }
  }, {
    key: "_send",
    value: function _send(msg) {
      this._data.write(msg);
    }

    /**
     * Connects this client to a duplex stream that is used for the data channel.
     * The provided duplex stream is expected to be valid and usable.
     * Calling this method will begin the initialization of the connection.
     *
     * @param stream - The stream used for the data channel.
     * @param callback - Optional callback that is invoked when the connection has been established.
     */
  }, {
    key: "connectDataStream",
    value: function connectDataStream(stream, callback) {
      var _this2 = this;
      if (this._dataStream) throw Error('Already connected!');
      this._dataStream = stream;

      // Connect the supplied stream to the data channel encoder and decoder
      this._registerErrorHandler(stream);
      this._dataEncoder.pipe(stream).pipe(this._dataDecoder);

      // Send the initial two packets
      this._send({
        name: 'Version',
        payload: {
          version: _mumbleStreams["default"].version.toUInt8(),
          release: this._options.clientSoftware || 'Node.js mumble-client',
          os: this._options.osName || (0, _utils.getOSName)(),
          os_version: this._options.osVersion || (0, _utils.getOSVersion)()
        }
      });
      this._send({
        name: 'Authenticate',
        payload: {
          username: this._username,
          password: this._password,
          tokens: this._tokens,
          celt_versions: (this._codecs || {
            celt: []
          }).celt,
          opus: (this._codecs || {
            opus: false
          }).opus
        }
      });
      return new _promise["default"](function (resolve, reject) {
        _this2.once('connected', function () {
          return resolve(_this2);
        });
        _this2.once('reject', reject);
        _this2.once('error', reject);
      }).nodeify(callback);
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
  }, {
    key: "connectVoiceStream",
    value: function connectVoiceStream(stream) {
      // Connect the stream to the voice channel encoder and decoder
      this._registerErrorHandler(stream);
      this._voiceEncoder.pipe(stream).pipe(this._voiceDecoder);

      // TODO: Ping packet
    }
  }, {
    key: "createVoiceStream",
    value: function createVoiceStream() {
      var _this3 = this;
      var target = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : 0;
      var numberOfChannels = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : 1;
      if (!this._codecs) {
        return _dropStream["default"].obj();
      }
      var voiceStream = _through["default"].obj(function (chunk, encoding, callback) {
        if (chunk instanceof Buffer) {
          chunk = new Float32Array(chunk.buffer, chunk.byteOffset, chunk.byteLength / 4);
        }
        if (chunk instanceof Float32Array) {
          chunk = {
            target: target,
            pcm: chunk,
            numberOfChannels: numberOfChannels
          };
        } else {
          chunk = {
            target: target,
            pcm: chunk.pcm,
            numberOfChannels: numberOfChannels,
            position: {
              x: chunk.x,
              y: chunk.y,
              z: chunk.z
            }
          };
        }
        var samples = _this3._samplesPerPacket || chunk.pcm.length / numberOfChannels;
        chunk.bitrate = _this3.getActualBitrate(samples, chunk.position != null);
        callback(null, chunk);
      });
      var codec = 'Opus'; // TODO
      var seqNum = 0;
      voiceStream.pipe(this._codecs.createEncoderStream(codec)).on('data', function (data) {
        var duration = _this3._codecs.getDuration(codec, data.frame) / 10;
        _this3._voice.write({
          seqNum: seqNum,
          codec: codec,
          mode: target,
          frames: [data.frame],
          position: data.position,
          end: false
        });
        seqNum += duration;
      }).on('end', function () {
        _this3._voice.write({
          seqNum: seqNum,
          codec: codec,
          mode: target,
          frames: [],
          end: true
        });
      });
      return voiceStream;
    }

    /**
     * Method called when new voice packets arrive.
     * Forwards the packet to the source user.
     */
  }, {
    key: "_onVoice",
    value: function _onVoice(chunk) {
      var user = this._userById[chunk.source];
      user._onVoice(chunk.seqNum, chunk.codec, chunk.target, chunk.frames, chunk.position, chunk.end);
    }

    /**
     * Method called when new data packets arrive.
     * If there is a method named '_onPacketName', the data is forwarded to
     * that method, otherwise it is logged as unhandled.
     *
     * @param {object} chunk - The data packet
     */
  }, {
    key: "_onData",
    value: function _onData(chunk) {
      if (this['_on' + chunk.name]) {
        this['_on' + chunk.name](chunk.payload);
      } else {
        console.warn('Unhandled data packet:', chunk);
      }
    }
  }, {
    key: "_onUDPTunnel",
    value: function _onUDPTunnel(payload) {
      // Forward tunneled udp packets to the voice pipeline
      this._voiceDecoder.write(payload);
    }
  }, {
    key: "_onVersion",
    value: function _onVersion(payload) {
      this.serverVersion = {
        major: payload.version >> 16,
        minor: payload.version >> 8 & 0xff,
        patch: payload.version >> 0 & 0xff,
        release: payload.release,
        os: payload.os,
        osVersion: payload.os_version || payload.osVersion
      };
      this.emit('serverVersion', this.serverVersion);
    }
  }, {
    key: "_onServerSync",
    value: function _onServerSync(payload) {
      var _this4 = this;
      // This packet finishes the initialization phase
      // Handle both snake_case (max_bandwidth) and camelCase (maxBandwidth)
      var maxBandwidth = payload.max_bandwidth || payload.maxBandwidth;
      this.self = this._userById[payload.session];
      this.maxBandwidth = maxBandwidth;
      this.welcomeMessage = payload.welcome_text || payload.welcomeText;

      // Emit maxBandwidth change
      if (maxBandwidth !== undefined) {
        this.emit('maxBandwidthChange', maxBandwidth);
      }

      // Make sure we send regular ping packets to not get disconnected
      this._pinger = setInterval(function () {
        if (_this4._inFlightDataPings >= _this4._maxInFlightDataPings) {
          _this4._error('timeout');
          return;
        }
        var dataStats = _this4._dataStats.getAll();
        var voiceStats = _this4._voiceStats.getAll();
        var timestamp = new Date().getTime();
        var payload = {
          timestamp: timestamp
        };
        if (dataStats) {
          payload.tcp_packets = dataStats.n;
          payload.tcp_ping_avg = dataStats.mean;
          payload.tcp_ping_var = dataStats.variance;
        }
        if (voiceStats) {
          payload.udp_packets = voiceStats.n;
          payload.udp_ping_avg = voiceStats.mean;
          payload.udp_ping_var = voiceStats.variance;
        }
        _this4._send({
          name: 'Ping',
          payload: payload
        });
        _this4._inFlightDataPings++;
      }, this._dataPingInterval);

      // We are now connected
      this.emit('connected');
    }
  }, {
    key: "_onPing",
    value: function _onPing(payload) {
      var _payload$timestamp;
      if (this._inFlightDataPings <= 0) {
        console.warn('Got unexpected ping message:', payload);
        return;
      }
      this._inFlightDataPings--;
      var now = new Date().getTime();
      // Handle both Long objects and plain numbers
      var timestamp = (_payload$timestamp = payload.timestamp) !== null && _payload$timestamp !== void 0 && _payload$timestamp.toNumber ? payload.timestamp.toNumber() : payload.timestamp;
      var duration = now - timestamp;
      this._dataStats.update(duration);
      this.emit('dataPing', duration);
    }

    // Handlers for server-sent informational packets
    // These packets don't require action but we log their contents for debugging
  }, {
    key: "_onServerConfig",
    value: function _onServerConfig(payload) {
      // Server configuration (max message length, max bandwidth, etc.)
      console.log('[ServerConfig]', {
        maxBandwidth: payload.max_bandwidth || payload.maxBandwidth,
        maxMessageLength: payload.message_length || payload.messageLength,
        maxImageLength: payload.image_message_length || payload.imageMessageLength,
        maxUsers: payload.max_users || payload.maxUsers,
        welcomeText: payload.welcome_text || payload.welcomeText,
        allowHtml: payload.allow_html || payload.allowHtml,
        recordingAllowed: payload.recording_allowed || payload.recordingAllowed
      });
    }
  }, {
    key: "_onCodecVersion",
    value: function _onCodecVersion(payload) {
      // Server codec capabilities announcement
      console.log('[CodecVersion]', {
        alpha: payload.alpha,
        beta: payload.beta,
        preferAlpha: payload.prefer_alpha || payload.preferAlpha,
        opus: payload.opus
      });
    }
  }, {
    key: "_onCryptSetup",
    value: function _onCryptSetup(payload) {
      // UDP encryption setup (not used by WebSocket-based client)
      // Only log if client/server nonce present (indicates encryption handshake)
      if (payload.client_nonce || payload.server_nonce || payload.key) {
        console.log('[CryptSetup] UDP encryption keys exchanged (not used by WebSocket client)');
      }
    }
  }, {
    key: "_onPermissionQuery",
    value: function _onPermissionQuery(payload) {
      // Server response to permission queries
      console.log('[PermissionQuery]', {
        channelId: payload.channel_id || payload.channelId,
        permissions: payload.permissions,
        flush: payload.flush
      });
    }
  }, {
    key: "_onUserStats",
    value: function _onUserStats(payload) {
      var _payload$certificates;
      // Detailed user statistics (bandwidth, packets, etc.)
      var session = payload.session;
      var user = this._userById[session];
      console.log('[UserStats]', {
        user: user ? user.name : "session ".concat(session),
        version: payload.version,
        certificates: ((_payload$certificates = payload.certificates) === null || _payload$certificates === void 0 ? void 0 : _payload$certificates.length) || 0,
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
      });
    }
  }, {
    key: "_onSuggestConfig",
    value: function _onSuggestConfig(payload) {
      // Server suggestions for client configuration
      console.log('[SuggestConfig]', {
        version: payload.version,
        positional: payload.positional,
        pushToTalk: payload.push_to_talk || payload.pushToTalk
      });
    }
  }, {
    key: "_onReject",
    value: function _onReject(payload) {
      // We got rejected from the server for some reason.
      this.emit('reject', payload);
      this.disconnect();
    }
  }, {
    key: "_onPermissionDenied",
    value: function _onPermissionDenied(payload) {
      if (payload.type === DenyType.Text) {
        this.emit('denied', 'Text', null, null, payload.reason);
      } else if (payload.type === DenyType.Permission) {
        var user = this._userById[payload.session];
        var channel = this._channelById[payload.channel_id];
        this.emit('denied', 'Permission', user, channel, payload.permission);
      } else if (payload.type === DenyType.SuperUser) {
        this.emit('denied', 'SuperUser', null, null, null);
      } else if (payload.type === DenyType.ChannelName) {
        this.emit('denied', 'ChannelName', null, null, payload.name);
      } else if (payload.type === DenyType.TextTooLong) {
        this.emit('denied', 'TextTooLong', null, null, null);
      } else if (payload.type === DenyType.TemporaryChannel) {
        this.emit('denied', 'TemporaryChannel', null, null, null);
      } else if (payload.type === DenyType.MissingCertificate) {
        var _user = this._userById[payload.session];
        this.emit('denied', 'MissingCertificate', _user, null, null);
      } else if (payload.type === DenyType.UserName) {
        this.emit('denied', 'UserName', null, null, payload.name);
      } else if (payload.type === DenyType.ChannelFull) {
        this.emit('denied', 'ChannelFull', null, null, null);
      } else if (payload.type === DenyType.NestingLimit) {
        this.emit('denied', 'NestingLimit', null, null, null);
      } else {
        throw Error('Invalid DenyType: ' + payload.type);
      }
    }
  }, {
    key: "_onTextMessage",
    value: function _onTextMessage(payload) {
      var _this5 = this;
      this.emit('message', this._userById[payload.actor], payload.message, payload.session.map(function (id) {
        return _this5._userById[id];
      }), payload.channel_id.map(function (id) {
        return _this5._channelById[id];
      }), payload.tree_id.map(function (id) {
        return _this5._channelById[id];
      }));
    }
  }, {
    key: "_onChannelState",
    value: function _onChannelState(payload) {
      var _this6 = this;
      var channel = this._channelById[payload.channel_id];
      if (!channel) {
        channel = new _channel["default"](this, payload.channel_id);
        this._channelById[channel._id] = channel;
        this.channels.push(channel);
        this.emit('newChannel', channel);
      }
      ;
      (payload.links_remove || []).forEach(function (otherId) {
        var otherChannel = _this6._channelById[otherId];
        if (otherChannel && otherChannel.links.indexOf(channel) !== -1) {
          otherChannel._update({
            links_remove: [payload.channel_id]
          });
        }
      });
      channel._update(payload);
    }
  }, {
    key: "_onChannelRemove",
    value: function _onChannelRemove(payload) {
      var channel = this._channelById[payload.channel_id];
      if (channel) {
        channel._remove();
        delete this._channelById[channel._id];
        (0, _removeValue["default"])(this.channels, channel);
      }
    }
  }, {
    key: "_onUserState",
    value: function _onUserState(payload) {
      var user = this._userById[payload.session];
      if (!user) {
        user = new _user2["default"](this, payload.session);
        this._userById[user._id] = user;
        this.users.push(user);
        this.emit('newUser', user);

        // For some reason, the mumble protocol does not send the initial
        // channel of a client if it is the root channel
        payload.channel_id = payload.channel_id || 0;
      }
      user._update(payload);
    }
  }, {
    key: "_onUserRemove",
    value: function _onUserRemove(payload) {
      var user = this._userById[payload.session];
      if (user) {
        user._remove(this._userById[payload.actor], payload.reason, payload.ban);
        delete this._userById[user._id];
        (0, _removeValue["default"])(this.users, user);
      }
    }

    /**
     * Disconnect from the remote server.
     * Once disconnected, this client may not be used again.
     * Does nothing when not connected.
     */
  }, {
    key: "disconnect",
    value: function disconnect() {
      if (this._disconnected) {
        return;
      }
      this._disconnected = true;
      this._voice.end();
      this._data.end();
      clearInterval(this._pinger);
      this.emit('disconnected');
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
  }, {
    key: "setAudioQuality",
    value: function setAudioQuality(bitrate, samplesPerPacket) {
      this._preferredBitrate = bitrate;
      this._samplesPerPacket = samplesPerPacket;
    }

    /**
     * Calculate the actual bitrate taking into account maximum and preferred bitrate.
     */
  }, {
    key: "getActualBitrate",
    value: function getActualBitrate(samplesPerPacket, sendPosition) {
      var bitrate = this.getPreferredBitrate(samplesPerPacket, sendPosition);

      // If server doesn't send max_bandwidth, use preferred bitrate
      if (this.maxBandwidth === undefined) {
        return bitrate;
      }
      var bandwidth = MumbleClient.calcEnforcableBandwidth(bitrate, samplesPerPacket, sendPosition);
      if (bandwidth <= this.maxBandwidth) {
        return bitrate;
      } else {
        return this.getMaxBitrate(samplesPerPacket, sendPosition);
      }
    }

    /**
     * Returns the preferred bitrate set by {@link setAudioQuality} or
     * {@link getMaxBitrate} if not set.
     */
  }, {
    key: "getPreferredBitrate",
    value: function getPreferredBitrate(samplesPerPacket, sendPosition) {
      if (this._preferredBitrate) {
        return this._preferredBitrate;
      }
      // If server doesn't send max_bandwidth, use a reasonable default (40000 bps = 40 kbit/s)
      if (this.maxBandwidth === undefined) {
        return 40000;
      }
      return this.getMaxBitrate(samplesPerPacket, sendPosition);
    }

    /**
     * Calculate the maximum bitrate possible given the current server bandwidth limit.
     */
  }, {
    key: "getMaxBitrate",
    value: function getMaxBitrate(samplesPerPacket, sendPosition) {
      var overhead = MumbleClient.calcEnforcableBandwidth(0, samplesPerPacket, sendPosition);
      return this.maxBandwidth - overhead;
    }

    /**
     * Calculate the bandwidth used if IP/UDP packets were used to transmit audio.
     * This matches the value used by Mumble servers to enforce bandwidth limits.
     * @returns {number} bits per second
     */
  }, {
    key: "getChannel",
    value:
    /**
     * Find a channel by name.
     * If no such channel exists, return null.
     *
     * @param {string} name - The full name of the channel
     * @returns {?Channel}
     */
    function getChannel(name) {
      var _iterator2 = _createForOfIteratorHelper(this.channels),
        _step2;
      try {
        for (_iterator2.s(); !(_step2 = _iterator2.n()).done;) {
          var channel = _step2.value;
          if (channel.name === name) {
            return channel;
          }
        }
      } catch (err) {
        _iterator2.e(err);
      } finally {
        _iterator2.f();
      }
      return null;
    }
  }, {
    key: "setSelfMute",
    value: function setSelfMute(mute) {
      var message = {
        name: 'UserState',
        payload: {
          session: this.self._id,
          self_mute: mute
        }
      };
      if (!mute) message.payload.self_deaf = false;
      this._send(message);
    }
  }, {
    key: "setSelfDeaf",
    value: function setSelfDeaf(deaf) {
      var message = {
        name: 'UserState',
        payload: {
          session: this.self._id,
          self_deaf: deaf
        }
      };
      if (deaf) message.payload.self_mute = true;
      this._send(message);
    }
  }, {
    key: "setSelfTexture",
    value: function setSelfTexture(texture) {
      this._send({
        name: 'UserState',
        payload: {
          session: this.self._id,
          texture: texture
        }
      });
    }
  }, {
    key: "setSelfComment",
    value: function setSelfComment(comment) {
      this._send({
        name: 'UserState',
        payload: {
          session: this.self._id,
          comment: comment
        }
      });
    }
  }, {
    key: "setPluginContext",
    value: function setPluginContext(context) {
      this._send({
        name: 'UserState',
        payload: {
          session: this.self._id,
          plugin_context: context
        }
      });
    }
  }, {
    key: "setPluginIdentity",
    value: function setPluginIdentity(identity) {
      this._send({
        name: 'UserState',
        payload: {
          session: this.self._id,
          plugin_identity: identity
        }
      });
    }
  }, {
    key: "setRecording",
    value: function setRecording(recording) {
      this._send({
        name: 'UserState',
        payload: {
          session: this.self._id,
          recording: recording
        }
      });
    }
  }, {
    key: "getChannelById",
    value: function getChannelById(id) {
      return this._channelById[id];
    }
  }, {
    key: "getUserById",
    value: function getUserById(id) {
      return this._userById[id];
    }
  }, {
    key: "root",
    get: function get() {
      return this._channelById[0];
    }
  }, {
    key: "connected",
    get: function get() {
      return !this._disconnected && this._dataStream != null;
    }
  }, {
    key: "dataStats",
    get: function get() {
      return this._dataStats.getAll();
    }
  }, {
    key: "voiceStats",
    get: function get() {
      return this._voiceStats.getAll();
    }
  }], [{
    key: "calcEnforcableBandwidth",
    value: function calcEnforcableBandwidth(bitrate, samplesPerPacket, sendPosition) {
      // IP + UDP + Crypt + Header + SeqNum (VarInt) + Codec Header + Optional Position
      // Codec Header depends on codec:
      //  - Opus is always 4 (just the length as VarInt)
      //  - CELT/Speex depends on frames (10ms) per packet (1 byte each)
      var codecHeaderBytes = Math.max(4, samplesPerPacket / 480);
      var packetBytes = 20 + 8 + 4 + 1 + 4 + codecHeaderBytes + (sendPosition ? 12 : 0);
      var packetsPerSecond = 48000 / samplesPerPacket;
      return Math.round(packetBytes * 8 * packetsPerSecond + bitrate);
    }
  }]);
}(_events.EventEmitter);
var _default = exports["default"] = MumbleClient;