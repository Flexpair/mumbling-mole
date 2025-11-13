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
    self.postMessage(msg, transfer);
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
  let jsonValue = structuredClone(value);
  if (value.$type) {
    jsonValue.$type = { name: value.$type.name };
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

function setupChannel(id, channel) {
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
    setupChannel(id, child);
  }

  return channel.id;
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
  registerEventProxy(id, user, "voice", (stream) => {
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
  });
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

function setupClient(id, client) {
  let tempRootChannel = null;
  
  const ROOT_CHECK_INTERVAL_MS = 500;
  const ROOT_CHECK_MAX_COUNT = 20;
  const ROOT_CHECK_TIMEOUT_SECONDS = (ROOT_CHECK_MAX_COUNT * ROOT_CHECK_INTERVAL_MS) / 1000;
  
  id = { client: id };

  registerEventProxy(id, client, "error");
  registerEventProxy(id, client, "denied", (it) => [it]);
  registerEventProxy(id, client, "newChannel", (it) => [setupChannel(id, it)]);
  registerEventProxy(id, client, "newUser", (it) => [setupUser(id, it)]);
  registerEventProxy(
    id,
    client,
    "message",
    (sender, message, users, channels, trees) => {
      return [
        sender.id,
        message,
        users.map((it) => it.id),
        channels.map((it) => it.id),
        trees.map((it) => it.id),
      ];
    }
  );
  
  // STATS-MONITORING: Push data statistics when ping responses arrive
  client.on("dataPing", () => {
    pushProp(id, client, "dataStats");
  });
  
  client.on("connected", () => {
    pushProp(id, client, "maxBandwidth");
  });
  client.on("maxBandwidthChange", () => {
    pushProp(id, client, "maxBandwidth");
  });
  client.on("serverVersion", () => {
    pushProp(id, client, "serverVersion");
  });
  
  client.on("disconnect", () => {
    if (rootCheckInterval) {
      clearInterval(rootCheckInterval);
      rootCheckInterval = null;
    }
  });

  let initialized = false;
  let rootCheckInterval = null;

  const initializeClientState = () => {
    if (initialized) {
      return;
    }
    let rootChannel = client.root;
    
    if (!rootChannel && tempRootChannel) {
      rootChannel = tempRootChannel;
    }
    
    if (!rootChannel) {
      return;
    }

    initialized = true;

    setupChannel(id, rootChannel);
    for (let user of client.users) {
      setupUser(id, user);
    }

    pushProp(id, client, "root", () => rootChannel.id);
    pushProp(id, client, "self", (it) => it.id);
    pushProp(id, client, "serverVersion");
    pushProp(id, client, "maxBandwidth");

    client.removeListener("newChannel", initializeClientState);
    client.removeListener("connected", initializeClientState);
    if (rootCheckInterval) {
      clearInterval(rootCheckInterval);
      rootCheckInterval = null;
    }
    
    tempRootChannel = null;
  };

  initializeClientState();
  
  if (!initialized) {
    // Three-strategy root channel initialization to handle various server behaviors:
    // 1. newChannel event (primary) - most servers send this first
    // 2. connected event (backup) - fires when root arrives after connection
    // 3. Periodic check (fallback) - handles servers with unusual timing/event delivery
    client.on("newChannel", () => {
      initializeClientState();
    });
    
    client.on("connected", () => {
      initializeClientState();
    });
    
    let checkCount = 0;
    rootCheckInterval = setInterval(() => {
      checkCount++;
      
      if (client.channels) {
        const channels = client.channels;
        
        if (typeof channels === 'object') {
          const channelEntries = Object.entries(channels);
          
          const rootCandidates = channelEntries.filter(([id, ch]) => !ch.parent || ch.parent === null || ch.parent === undefined);
          
          if (rootCandidates.length > 0) {
            const [, rootChannel] = rootCandidates[0];
            
            clearInterval(rootCheckInterval);
            rootCheckInterval = null;
            
            tempRootChannel = rootChannel;
            
            initializeClientState();
            return;
          }
        }
      }
      
      if (client.root || checkCount > ROOT_CHECK_MAX_COUNT) {
        clearInterval(rootCheckInterval);
        rootCheckInterval = null;
        if (client.root) {
          initializeClientState();
        } else {
          console.warn(`[WORKER] Failed to initialize: root channel not found after ${ROOT_CHECK_TIMEOUT_SECONDS}s`);
        }
      }
    }, ROOT_CHECK_INTERVAL_MS);
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
    console.error(`[WORKER] Attempted to call disallowed method: ${method}`);
    return;
  }

  target[method](...args);
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

self.addEventListener("message", (ev) => {
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
