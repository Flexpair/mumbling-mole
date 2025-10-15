"use strict";

function _typeof(o) { "@babel/helpers - typeof"; return _typeof = "function" == typeof Symbol && "symbol" == typeof Symbol.iterator ? function (o) { return typeof o; } : function (o) { return o && "function" == typeof Symbol && o.constructor === Symbol && o !== Symbol.prototype ? "symbol" : typeof o; }, _typeof(o); }
Object.defineProperty(exports, "__esModule", {
  value: true
});
exports["default"] = void 0;
var _events = require("events");
var _removeValue = _interopRequireDefault(require("remove-value"));
function _interopRequireDefault(e) { return e && e.__esModule ? e : { "default": e }; }
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
var Channel = /*#__PURE__*/function (_EventEmitter) {
  function Channel(client, id) {
    var _this;
    _classCallCheck(this, Channel);
    _this = _callSuper(this, Channel);
    _this._client = client;
    _this._id = id;
    _this._links = [];
    _this.users = [];
    _this.children = [];
    _this._haveRequestedDescription = false;
    return _this;
  }
  _inherits(Channel, _EventEmitter);
  return _createClass(Channel, [{
    key: "_remove",
    value: function _remove() {
      if (this.parent) {
        (0, _removeValue["default"])(this.parent.children, this);
      }
      this.emit('remove');
    }
  }, {
    key: "_update",
    value: function _update(msg) {
      var _this2 = this;
      var changes = {};
      if (msg.name != null) {
        changes.name = this._name = msg.name;
      }
      if (msg.description != null) {
        changes.description = this._description = msg.description;
      }
      if (msg.description_hash != null) {
        changes.descriptionHash = this._descriptionHash = msg.description_hash;
        this._haveRequestedDescription = false; // invalidate previous request
      }
      if (msg.temporary != null) {
        changes.temporary = this._temporary = msg.temporary;
      }
      if (msg.position != null) {
        changes.position = this._position = msg.position;
      }
      if (msg.max_users != null) {
        changes.maxUsers = this._maxUsers = msg.max_users;
      }
      if (msg.links) {
        this._links = msg.links;
        changes.links = this.links;
      }
      if (msg.links_remove) {
        this._links = this._links.filter(function (e) {
          return !msg.links_remove.includes(e);
        });
        changes.links = this.links;
      }
      if (msg.links_add) {
        msg.links_add.filter(function (e) {
          return !_this2._links.includes(e);
        }).forEach(function (e) {
          return _this2._links.push(e);
        });
        changes.links = this.links;
      }
      if (msg.parent != null) {
        if (this.parent) {
          (0, _removeValue["default"])(this.parent.children, this);
        }
        this._parentId = msg.parent;
        if (this.parent) {
          this.parent.children.push(this);
        }
        changes.parent = this.parent;
      }
      this.emit('update', changes);
    }
  }, {
    key: "setName",
    value: function setName(name) {
      this._client._send({
        name: 'ChannelState',
        payload: {
          channel_id: this._id,
          name: name
        }
      });
    }
  }, {
    key: "setParent",
    value: function setParent(parent) {
      this._client._send({
        name: 'ChannelState',
        payload: {
          channel_id: this._id,
          parent: parent._id
        }
      });
    }
  }, {
    key: "setTemporary",
    value: function setTemporary(temporary) {
      this._client._send({
        name: 'ChannelState',
        payload: {
          channel_id: this._id,
          temporary: temporary
        }
      });
    }
  }, {
    key: "setDescription",
    value: function setDescription(description) {
      this._client._send({
        name: 'ChannelState',
        payload: {
          channel_id: this._id,
          description: description
        }
      });
    }
  }, {
    key: "setPosition",
    value: function setPosition(position) {
      this._client._send({
        name: 'ChannelState',
        payload: {
          channel_id: this._id,
          position: position
        }
      });
    }
  }, {
    key: "setLinks",
    value: function setLinks(links) {
      this._client._send({
        name: 'ChannelState',
        payload: {
          channel_id: this._id,
          links: links.map(function (c) {
            return c._id;
          })
        }
      });
    }
  }, {
    key: "setMaxUsers",
    value: function setMaxUsers(maxUsers) {
      this._client._send({
        name: 'ChannelState',
        payload: {
          channel_id: this._id,
          max_users: maxUsers
        }
      });
    }
  }, {
    key: "sendMessage",
    value: function sendMessage(message) {
      this._client._send({
        name: 'TextMessage',
        payload: {
          channel_id: [this._id],
          message: message
        }
      });
    }
  }, {
    key: "sendTreeMessage",
    value: function sendTreeMessage(message) {
      this._client._send({
        name: 'TextMessage',
        payload: {
          tree_id: [this._id],
          message: message
        }
      });
    }
  }, {
    key: "requestDescription",
    value: function requestDescription() {
      if (this._haveRequestedDescription) return;
      this._client._send({
        name: 'RequestBlob',
        payload: {
          channel_description: this._id
        }
      });
      this._haveRequestedDescription = true;
    }
  }, {
    key: "id",
    get: function get() {
      return this._id;
    }
  }, {
    key: "name",
    get: function get() {
      return this._name;
    },
    set: function set(to) {
      throw new Error('Cannot set name. Use #setName(name) instead.');
    }
  }, {
    key: "parent",
    get: function get() {
      return this._client._channelById[this._parentId];
    },
    set: function set(to) {
      throw new Error('Cannot set parent. Use #setParent(channel) instead.');
    }
  }, {
    key: "description",
    get: function get() {
      return this._description;
    },
    set: function set(to) {
      throw new Error('Cannot set description. Use #setDescription(desc) instead.');
    }
  }, {
    key: "descriptionHash",
    get: function get() {
      return this._descriptionHash;
    },
    set: function set(to) {
      throw new Error('Cannot set descriptionHash.');
    }
  }, {
    key: "temporary",
    get: function get() {
      return this._temporary;
    },
    set: function set(to) {
      throw new Error('Cannot set temporary. Use #setTemporary(tmp) instead.');
    }
  }, {
    key: "position",
    get: function get() {
      return this._position;
    },
    set: function set(to) {
      throw new Error('Cannot set position.');
    }
  }, {
    key: "maxUsers",
    get: function get() {
      return this._maxUsers;
    },
    set: function set(to) {
      throw new Error('Cannot set maxUsers.');
    }
  }, {
    key: "links",
    get: function get() {
      var _this3 = this;
      return this._links.map(function (id) {
        return _this3._client._channelById[id];
      });
    },
    set: function set(to) {
      throw new Error('Cannot set links. Use #setLinks(links) instead.');
    }
  }]);
}(_events.EventEmitter);
var _default = exports["default"] = Channel;