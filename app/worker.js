import { Transform, PassThrough } from "node:stream";
import mumbleConnect from "./mumble-websocket.js";
import toArrayBuffer from "to-arraybuffer";
import chunker from "stream-chunker";

let nextClientId = 1;
let nextVoiceId = 1;
let voiceStreams = [];
let clients = [];

function postMessage(msg, transfer) {
  try {
    globalThis.postMessage(msg, transfer);
  } catch (err) {
    console.error("Failed to postMessage", msg);
    throw err;
  }
}

function resolve(reqId, value, transfer) {
  postMessage(
    {
      reqId: reqId,
      result: value,
    },
    transfer
  );
}

function reject(reqId, value, transfer) {
  console.error(value);
  
  // Handle non-cloneable Event objects (like WebSocket errors)
  if (value instanceof Event) {
    value = {
      message: 'Connection failed',
      type: value.type,
      isTrusted: value.isTrusted
    };
  }

  let jsonValue;
  try {
    jsonValue = structuredClone(value);
  } catch (e) {
    // Fallback for other non-cloneable objects
    jsonValue = {
      message: value.message || 'Unknown error',
      name: value.name || 'Error',
      stack: value.stack
    };
  }

  if (jsonValue && jsonValue.$type) {
    jsonValue.$type = { name: jsonValue.$type.name };
  }
  postMessage(
    {
      reqId: reqId,
      error: jsonValue,
    },
    transfer
  );
}

function registerEventProxy(id, obj, event, transform) {
  obj.on(event, function (_) {
    postMessage({
      clientId: id.client,
      channelId: id.channel,
      userId: id.user,
      event: event,
      value: transform
        ? transform(...arguments)
        : Array.from(arguments),
    });
  });
}

function pushProp(id, obj, prop, transform) {
  let value = obj[prop];
  postMessage({
    clientId: id.client,
    channelId: id.channel,
    userId: id.user,
    prop: prop,
    value: transform ? transform(value) : value,
  });
}

function setupOutboundVoice(voiceId, samplesPerPacket, stream) {
  let resampler = new PassThrough();

  let buffer2Float32Array = new Transform({
    transform(data, _, callback) {
      callback(
        null,
        new Float32Array(data.buffer, data.byteOffset, data.byteLength / 4)
      );
    },
    readableObjectMode: true,
  });

  resampler
    .pipe(chunker(4 * samplesPerPacket))
    .pipe(buffer2Float32Array)
    .pipe(stream);

  voiceStreams[voiceId] = resampler;
}

function setupChannel(id, channel, visited = new Set()) {
  // Prevent infinite recursion from circular references
  if (visited.has(channel.id)) {
    return channel.id;
  }
  visited.add(channel.id);
  
  id = { ...id, channel: channel.id };

  registerEventProxy(id, channel, "update", (props) => {
    if (props.parent) {
      props.parent = props.parent.id;
    }
    if (props.links) {
      props.links = props.links.map((it) => it.id);
    }
    return [props];
  });
  registerEventProxy(id, channel, "remove");

  pushProp(id, channel, "parent", (it) => (it ? it.id : it));
  pushProp(id, channel, "links", (it) => it.map((it) => it.id));
  let props = ["position", "name", "description"];
  for (let prop of props) {
    pushProp(id, channel, prop);
  }

  for (let child of channel.children) {
    setupChannel(id, child, visited);
  }

  return channel.id;
}

function setupUserVoiceStream(id, stream) {
  let voiceId = nextVoiceId++;

  let target;

  // We want to do as little on the UI thread as possible, so do resampling here as well
  let resampler = new PassThrough();

  // Pipe stream into resampler
  stream
    .on("data", (data) => {
      // store target so we can pass it on after resampling
      target = data.target;
      resampler.write(Buffer.from(data.pcm.buffer));
    })
    .on("end", () => {
      resampler.end();
    });

  // Pipe resampler into output stream on UI thread
  resampler
    .on("data", (data) => {
      data = toArrayBuffer(data); // postMessage can't transfer node's Buffer
      postMessage(
        {
          voiceId: voiceId,
          target: target,
          buffer: data,
        },
        [data]
      );
    })
    .on("end", () => {
      postMessage({
        voiceId: voiceId,
      });
    });

  return [voiceId];
}

function setupUser(id, user) {
  id = { ...id, user: user.id };

  registerEventProxy(id, user, "update", (actor, props) => {
    if (actor) {
      actor = actor.id;
    }
    if (props.channel != null) {
      props.channel = props.channel.id;
    }
    return [actor, props];
  });
  registerEventProxy(id, user, "voice", (stream) => setupUserVoiceStream(id, stream));
  registerEventProxy(id, user, "remove");

  pushProp(id, user, "channel", (it) => (it ? it.id : it));
  let props = [
    "uniqueId",
    "username",
    "mute",
    "deaf",
    "suppress",
    "selfMute",
    "selfDeaf",
  ];
  for (let prop of props) {
    pushProp(id, user, prop);
  }

  return user.id;
}

// Extract message transform functions for better readability
function transformMessageEvent(sender, message, users, channels, trees) {
  return [
    sender.id,
    message,
    users.map((it) => it.id),
    channels.map((it) => it.id),
    trees.map((it) => it.id),
  ];
}

// Extract root channel detection logic
function findRootChannel(channels) {
  if (!channels || typeof channels !== 'object') {
    return null;
  }
  
  const channelEntries = Object.entries(channels);
  const rootCandidates = channelEntries.filter(
    ([id, ch]) => !ch.parent || ch.parent === null || ch.parent === undefined
  );
  
  if (rootCandidates.length > 0) {
    const [, rootChannel] = rootCandidates[0];
    return rootChannel;
  }
  
  return null;
}

// Client state initialization manager - handles deferred initialization of client state
class ClientInitializer {
  constructor(id, client, ROOT_CHECK_INTERVAL_MS, ROOT_CHECK_MAX_COUNT, ROOT_CHECK_TIMEOUT_SECONDS) {
    this.id = id;
    this.client = client;
    this.initialized = false;
    this.tempRootChannel = null;
    this.rootCheckInterval = null;
    this.ROOT_CHECK_INTERVAL_MS = ROOT_CHECK_INTERVAL_MS;
    this.ROOT_CHECK_MAX_COUNT = ROOT_CHECK_MAX_COUNT;
    this.ROOT_CHECK_TIMEOUT_SECONDS = ROOT_CHECK_TIMEOUT_SECONDS;
  }

  initialize() {
    if (this.initialized) {
      return;
    }
    
    let rootChannel = this.client.root;
    if (!rootChannel && this.tempRootChannel) {
      rootChannel = this.tempRootChannel;
    }
    
    if (!rootChannel) {
      return;
    }

    this.initialized = true;

    setupChannel(this.id, rootChannel);
    for (let user of this.client.users) {
      setupUser(this.id, user);
    }

    pushProp(this.id, this.client, "root", () => rootChannel.id);
    pushProp(this.id, this.client, "self", (it) => it.id);
    pushProp(this.id, this.client, "serverVersion");
    pushProp(this.id, this.client, "maxBandwidth");

    this.cleanup();
  }

  cleanup() {
    // Only remove listeners if they were attached
    if (this.boundInitialize) {
      this.client.removeListener("newChannel", this.boundInitialize);
      this.client.removeListener("connected", this.boundInitialize);
    }
    
    if (this.rootCheckInterval) {
      clearInterval(this.rootCheckInterval);
      this.rootCheckInterval = null;
    }
    
    this.tempRootChannel = null;
  }

  startPeriodicCheck() {
    let checkCount = 0;
    
    this.rootCheckInterval = setInterval(() => {
      checkCount++;
      
      const rootChannel = findRootChannel(this.client.channels);
      if (rootChannel) {
        clearInterval(this.rootCheckInterval);
        this.rootCheckInterval = null;
        this.tempRootChannel = rootChannel;
        this.initialize();
        return;
      }
      
      if (this.client.root || checkCount > this.ROOT_CHECK_MAX_COUNT) {
        clearInterval(this.rootCheckInterval);
        this.rootCheckInterval = null;
        if (this.client.root) {
          this.initialize();
        } else {
          console.warn(
            `[WORKER] Failed to initialize: root channel not found after ${this.ROOT_CHECK_TIMEOUT_SECONDS}s`
          );
        }
      }
    }, this.ROOT_CHECK_INTERVAL_MS);
  }

  attachEventListeners() {
    this.boundInitialize = () => this.initialize();
    this.client.on("newChannel", this.boundInitialize);
    this.client.on("connected", this.boundInitialize);
  }
}

function setupClient(id, client) {
  const ROOT_CHECK_INTERVAL_MS = 500;
  const ROOT_CHECK_MAX_COUNT = 20;
  const ROOT_CHECK_TIMEOUT_SECONDS = (ROOT_CHECK_MAX_COUNT * ROOT_CHECK_INTERVAL_MS) / 1000;
  
  id = { client: id };

  // Register event proxies with extracted transform functions
  registerEventProxy(id, client, "error");
  registerEventProxy(id, client, "denied", (it) => [it]);
  registerEventProxy(id, client, "newChannel", (it) => [setupChannel(id, it)]);
  registerEventProxy(id, client, "newUser", (it) => [setupUser(id, it)]);
  registerEventProxy(id, client, "messageSent", (messageText) => [messageText]);
  registerEventProxy(id, client, "message", transformMessageEvent);
  
  // STATS-MONITORING: Push data statistics when ping responses arrive
  client.on("dataPing", () => {
    pushProp(id, client, "dataStats");
  });
  registerEventProxy(id, client, "dataPing");
  
  client.on("connected", () => {
    pushProp(id, client, "maxBandwidth");
  });
  client.on("maxBandwidthChange", () => {
    pushProp(id, client, "maxBandwidth");
  });
  client.on("serverVersion", () => {
    pushProp(id, client, "serverVersion");
  });

  // Initialize client state with extracted class
  const initializer = new ClientInitializer(
    id,
    client,
    ROOT_CHECK_INTERVAL_MS,
    ROOT_CHECK_MAX_COUNT,
    ROOT_CHECK_TIMEOUT_SECONDS
  );
  
  client.on("disconnect", () => {
    initializer.cleanup();
  });

  initializer.initialize();
  
  if (!initializer.initialized) {
    // Three-strategy root channel initialization to handle various server behaviors:
    // 1. newChannel event (primary) - most servers send this first
    // 2. connected event (backup) - fires when root arrives after connection
    // 3. Periodic check (fallback) - handles servers with unusual timing/event delivery
    initializer.attachEventListeners();
    initializer.startPeriodicCheck();
  }
}

function handleConnect(reqId, payload) {
  payload.args.codecs = require("./audio/codecs-browser.js");
  mumbleConnect(payload.host, payload.args)
    .then((client) => {
      let id = nextClientId++;
      clients[id] = client;
      setupClient(id, client);
      // Push maxBandwidth and serverVersion immediately after setup since events may have already fired
      const idObj = { client: id };
      if (client.maxBandwidth !== undefined) {
        pushProp(idObj, client, "maxBandwidth");
      }
      if (client.serverVersion !== undefined) {
        pushProp(idObj, client, "serverVersion");
      }
      return id;
    })
    .then(
      (id) => {
        resolve(reqId, id);
      },
      (err) => {
        reject(reqId, err);
      }
    );
}

// Whitelist of allowed RPC methods to prevent arbitrary method invocation
const ALLOWED_CLIENT_METHODS = new Set([
  'setSelfMute', 'setSelfDeaf', 'setAudioQuality', 'disconnect', 'createVoiceStream'
]);
const ALLOWED_USER_METHODS = new Set([
  'setMute', 'setDeaf', 'sendMessage', 'setChannel'
]);
const ALLOWED_CHANNEL_METHODS = new Set([
  'sendMessage', 'join', 'link'
]);

function handleClientMessage(data) {
  const { clientId, userId, channelId, method, payload } = data;
  let client = clients[clientId];



  let target;
  let allowedMethods;
  let args = payload; // Local variable for potentially modified arguments
  
  if (userId != null) {
    target = client.getUserById(userId);
    allowedMethods = ALLOWED_USER_METHODS;
    if (method === "setChannel") {
      args = [client.getChannelById(payload[0])];
    }
  } else if (channelId === null || channelId === undefined) {
    target = client;
    allowedMethods = ALLOWED_CLIENT_METHODS;
    if (method === "createVoiceStream") {
      let voiceId = payload.shift();
      let samplesPerPacket = payload.shift();
      let stream = target.createVoiceStream(...payload);
      setupOutboundVoice(voiceId, samplesPerPacket, stream);
      return;
    }
    if (method === "disconnect") {
      clients[clientId] = null;
    }
  } else {
    target = client.getChannelById(channelId);
    allowedMethods = ALLOWED_CHANNEL_METHODS;
  }

  // Validate method against whitelist
  if (!allowedMethods.has(method)) {
    console.error('[WORKER] Attempted to call disallowed method:', method);
    console.error('[WORKER] userId: %s, channelId: %s, allowedMethods:', userId, channelId, Array.from(allowedMethods));
    return;
  }

  // Validate target exists before invoking method
  if (!target) {
    console.error(`[WORKER] Target not found for method: ${method} (userId: ${userId}, channelId: ${channelId})`);
    return;
  }

  // Call the method
  const result = target[method](...args);
  
  // Only send response for query-type methods (those that need return values)
  // Regular calls (like sendMessage) don't need responses
  // The worker will only respond if the main thread is waiting for a promise
}

function handleVoiceStream(data) {
  let stream = voiceStreams[data.voiceId];
  let buffer = data.chunk;
  if (buffer) {
    stream.write(Buffer.from(buffer));
  } else {
    voiceStreams[data.voiceId] = null;
    stream.end();
  }
}

function onMessage(data) {
  let { reqId, method, payload } = data;
  
  if (method === "_connect") {
    handleConnect(reqId, payload);
  } else if (data.clientId != null) {
    handleClientMessage(data);
  } else if (data.voiceId != null) {
    handleVoiceStream(data);
  }
}

globalThis.addEventListener("message", (ev) => {
  // SECURITY-NOTE: Origin verification in worker context
  // ------------------------------------------------
  // Workers can ONLY receive messages from their creating parent context.
  // Unlike window.postMessage(), there is no cross-origin risk here because:
  // 1. Workers cannot be accessed by other origins
  // 2. The 'origin' property doesn't exist on worker MessageEvent objects
  // 3. The worker can only communicate with the script that instantiated it
  //
  // Instead, we validate the message structure to prevent processing malformed data
  // that could cause errors or unexpected behavior.
  
  // VALIDATION-STEP-1: Ensure data exists and is an object
  if (!ev.data || typeof ev.data !== 'object') {
    console.warn('[WORKER] Rejected message: invalid data format');
    return;
  }
  
  // VALIDATION-STEP-2: Verify message conforms to expected protocol
  // All valid messages must be one of three types:
  // - RPC request (has reqId + method)
  // - Client command (has clientId)
  // - Voice stream data (has voiceId)
  const hasValidStructure = 
    (ev.data.reqId !== undefined && ev.data.method !== undefined) || // RPC call
    ev.data.clientId !== undefined || // Client method invocation
    ev.data.voiceId !== undefined; // Voice stream chunk
  
  if (!hasValidStructure) {
    console.warn('[WORKER] Rejected message: invalid message structure', {
      hasReqId: ev.data.reqId !== undefined,
      hasMethod: ev.data.method !== undefined,
      hasClientId: ev.data.clientId !== undefined,
      hasVoiceId: ev.data.voiceId !== undefined
    });
    return;
  }
  
  try {
    onMessage(ev.data);
  } catch (ex) {
    console.error("exception during message event", ev.data, ex);
  }
});
