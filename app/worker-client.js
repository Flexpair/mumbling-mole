import MumbleClient from "./mumble-client/index.js";
import EventEmitter from "node:events";
import { Writable, PassThrough } from "node:stream";
import toArrayBuffer from "./utils/to-arraybuffer-lite.js";

function createWorker() {
  try {
    return new Worker('./worker.js', { type: 'classic' });
  } catch (e) {
    console.error('[worker] failed to construct worker', e);
    throw e;
  }
}

/**
 * Creates proxy MumbleClients to a real ones running on a web worker.
 * Only stuff which we need in mumble-web is proxied, i.e. this is not a generic solution.
 */
class WorkerBasedMumbleConnector {
  constructor() {
  try {
    this._worker = createWorker();
  } catch (e) {
    console.error('[worker] constructor-level failure creating worker', e);
    throw e;
  }
    this._worker.addEventListener("message", this._onMessage.bind(this));
    this._worker.addEventListener("error", (e) => {
      console.error("[worker] error event:", e.message, e.filename, e.lineno);
    });
    this._reqId = 1;
    this._requests = {};
    this._clients = {};
    this._nextVoiceId = 1;
    this._voiceStreams = {};
  }

  _postMessage(msg, transfer) {
    try {
      this._worker.postMessage(msg, transfer);
    } catch (err) {
      console.error("Failed to postMessage", msg);
      throw err;
    }
  }

  _call(id, method, payload, transfer) {
    let reqId = this._reqId++;
    this._postMessage(
      {
        clientId: id.client,
        channelId: id.channelId,
        userId: id.userId,
        method: method,
        reqId: reqId,
        payload: payload,
      },
      transfer
    );
    return reqId;
  }

  _query(id, method, payload, transfer) {
    let reqId = this._call(id, method, payload, transfer);
    return new Promise((resolve, reject) => {
      this._requests[reqId] = [resolve, reject];
    });
  }

  _addCall(proxy, name, id) {
    proxy[name] = (...args) => {
      this._call(id, name, args);
    };
  }

  async connect(host, args) {
    const id = await this._query({}, "_connect", { host: host, args: args });
    return this._client(id);
  }

  _client(id) {
    let client = this._clients[id];
    if (!client) {
      client = new WorkerBasedMumbleClient(this, id);
      this._clients[id] = client;
    }
    return client;
  }

  _onMessage(ev) {
    let data = ev.data;
    
    if (data.reqId !== null && data.reqId !== undefined) {
      this._handleRpcResponse(data);
    } else if (data.clientId !== null && data.clientId !== undefined) {
      this._handleEventDispatch(data);
    } else if (data.voiceId !== null && data.voiceId !== undefined) {
      this._handleVoiceData(data);
    }
  }

  _handleRpcResponse(data) {
    let { reqId, result, error } = data;
    let request = this._requests[reqId];
    
    // Request might not exist if _call was used instead of _query/_callPromise
    if (!request) {
      return; // Silently ignore responses for non-promise calls
    }
    
    let [resolve, reject] = request;
    delete this._requests[reqId];
    if (error) {
      reject(error);
    } else {
      resolve(result);
    }
  }

  _handleEventDispatch(data) {
    let client = this._client(data.clientId);

    let target;
    if (data.userId !== null && data.userId !== undefined) {
      target = client._user(data.userId);
    } else if (data.channelId !== null && data.channelId !== undefined) {
      target = client._channel(data.channelId);
    } else {
      target = client;
    }

    if (data.event) {
      target._dispatchEvent(data.event, data.value);
    } else if (data.prop) {
      target._setProp(data.prop, data.value);
    }
  }

  _handleVoiceData(data) {
    let stream = this._voiceStreams[data.voiceId];
    let buffer = data.buffer;
    if (buffer) {
      stream.write({
        target: data.target,
        buffer: Buffer.from(buffer),
      });
    } else {
      delete this._voiceStreams[data.voiceId];
      stream.end();
    }
  }
}

class WorkerBasedMumbleClient extends EventEmitter {
  constructor(connector, clientId) {
    super();
    this._connector = connector;
    this._id = clientId;
    this._users = {};
    this._channels = {};

    let id = { client: clientId };
    connector._addCall(this, "setSelfDeaf", id);
    connector._addCall(this, "setSelfMute", id);
    connector._addCall(this, "setAudioQuality", id);

    connector._addCall(this, "disconnect", id);
    let _disconnect = this.disconnect;
    this.disconnect = () => {
      _disconnect.call(this);
      delete connector._clients[id];
    };

    connector._addCall(this, "createVoiceStream", id);
    let _createVoiceStream = this.createVoiceStream;
    this.createVoiceStream = function () {
      let voiceId = connector._nextVoiceId++;

      let args = Array.from(arguments);
      args.unshift(voiceId);
      _createVoiceStream.call(this, ...args);

      return new Writable({
        write(chunk, encoding, callback) {
          chunk = toArrayBuffer(chunk);
          connector._postMessage({
            voiceId: voiceId,
            chunk: chunk,
          });
          callback();
        },
        final(callback) {
          connector._postMessage({
            voiceId: voiceId,
          });
          callback();
        },
      });
    };

    // Dummy client used for bandwidth calculations
    this._dummyClient = new MumbleClient({ username: "dummy" });
    let defineDummyMethod = (name) => {
      this[name] = function (...args) {
        return this._dummyClient[name](...args);
      };
    };
    defineDummyMethod("getMaxBitrate");
    defineDummyMethod("getActualBitrate");
    let _setAudioQuality = this.setAudioQuality;
    this.setAudioQuality = function (...args) {
      this._dummyClient.setAudioQuality(...args);
      _setAudioQuality.call(this, ...args);
    };
  }

  _user(id) {
    let user = this._users[id];
    if (!user) {
      user = new WorkerBasedMumbleUser(this._connector, this, id);
      this._users[id] = user;
      
      this.emit('newUser', user);
    }
    return user;
  }

  _channel(id) {
    // If id is explicitly undefined, return undefined (user has no channel yet)
    // Note: 0 is a valid channel ID (root channel), so we only check for undefined
    if (id === undefined) {
      return undefined;
    }
    
    let channel = this._channels[id];
    if (!channel) {
      channel = new WorkerBasedMumbleChannel(this._connector, this, id);
      this._channels[id] = channel;
      
      this.emit('newChannel', channel);
    }
    return channel;
  }

  _dispatchEvent(name, args) {
    if (name === "newChannel") {
      args[0] = this._channel(args[0]);
    } else if (name === "newUser") {
      args[0] = this._user(args[0]);
    } else if (name === "message") {
      args[0] = this._user(args[0]);
      args[2] = args[2].map((id) => this._user(id));
      args[3] = args[3].map((id) => this._channel(id));
      args[4] = args[4].map((id) => this._channel(id));
    }
    this.emit(name, ...args);
  }

  _setProp(name, value) {
    if (name === "root") {
      name = "_rootId";
    }
    if (name === "self") {
      name = "_selfId";
      
      // USER-MIGRATION: Handle race condition where voice events arrive before self ID is assigned
      // When connecting, server initially assigns undefined ID, then later sends real ID
      // Voice event handlers may be attached to _users[undefined] before we get the real ID
      if (this._users[undefined] && value !== undefined) {
        const undefinedUser = this._users[undefined];
        undefinedUser._id = value;
        this._users[value] = undefinedUser;
        // Delete undefined key (intentional - user created before ID assigned from server)
        delete this._users[undefined];
      }
    }
    if (name === "maxBandwidth") {
      this._dummyClient.maxBandwidth = value;
    }
    this[name] = value;
  }

  get root() {
    // Root channel ID is always 0, use as default if _rootId not yet set
    const rootId = this._rootId === undefined ? 0 : this._rootId;
    return this._channel(rootId);
  }

  get channels() {
    return Object.values(this._channels);
  }

  get users() {
    return Object.values(this._users);
  }

  get self() {
    return this._user(this._selfId);
  }
}

class WorkerBasedMumbleChannel extends EventEmitter {
  constructor(connector, client, channelId) {
    super();
    this._connector = connector;
    this._client = client;
    this._id = channelId;

    let id = { client: client._id, channelId: channelId };
    connector._addCall(this, "sendMessage", id);
  }

  _dispatchEvent(name, args) {
    if (name === "update") {
      let [props] = args;
      for (const [key, value] of Object.entries(props)) {
        this._setProp(key, value);
      }
      if (props.parent != null) {
        props.parent = this.parent;
      }
      if (props.links != null) {
        props.links = this.links;
      }
      args = [props];
    } else if (name === "remove") {
      delete this._client._channels[this._id];
    }
    this.emit(name, ...args);
  }

  _setProp(name, value) {
    if (name === "parent") {
      name = "_parentId";
    }
    if (name === "links") {
      value = value.map((id) => this._client._channel(id));
    }
    this[name] = value;
  }

  get id() {
    return this._id;
  }

  get parent() {
    if (this._parentId !== null && this._parentId !== undefined) {
      return this._client._channel(this._parentId);
    }
    return undefined;
  }

  get children() {
    return Object.values(this._client._channels).filter(
      (it) => it.parent === this
    );
  }
}

class WorkerBasedMumbleUser extends EventEmitter {
  constructor(connector, client, userId) {
    super();
    this._connector = connector;
    this._client = client;
    this._id = userId;

    let id = { client: client._id, userId: userId };
    connector._addCall(this, "setMute", id);
    connector._addCall(this, "setDeaf", id);
    connector._addCall(this, "sendMessage", id);
    this.setChannel = (channel) => {
      connector._call(id, "setChannel", channel._id);
    };
  }

  _dispatchEvent(name, args) {
    if (name === "update") {
      let [actor, props] = args;
      for (const [key, value] of Object.entries(props)) {
        this._setProp(key, value);
      }
      if (props.channel !== null && props.channel !== undefined) {
        props.channel = this.channel;
      }
      args = [this._client._user(actor), props];
    } else if (name === "voice") {
      let [id] = args;
      let stream = new PassThrough({
        objectMode: true,
      });
      this._connector._voiceStreams[id] = stream;
      args = [stream];
    } else if (name === "remove") {
      delete this._client._users[this._id];
    }
    this.emit(name, ...args);
  }

  _setProp(name, value) {
    if (name === "channel") {
      name = "_channelId";
    }
    this[name] = value;
  }

  get id() {
    return this._id;
  }

  get channel() {
    return this._client._channels[this._channelId];
  }
}
export default WorkerBasedMumbleConnector;
