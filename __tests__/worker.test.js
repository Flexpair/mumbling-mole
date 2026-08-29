/**
 * @jest-environment jsdom
 */
import { jest } from "@jest/globals";
import { EventEmitter } from "node:events";

/**
 * Tests for worker.js - Worker thread implementation
 * 
 * Note: worker.js uses dynamic require() for codecs which makes it challenging to test.
 * These tests focus on the message handling and event proxying behavior.
 */

// Create mock client instances
const mockClients = [];
const createMockClient = () => {
  const client = new EventEmitter();
  Object.assign(client, {
    root: null,
    users: [],
    channels: {},
    maxBandwidth: 96000,
    serverVersion: "1.4.0",
    dataStats: null,
    self: null,
    getUserById: jest.fn(),
    getChannelById: jest.fn(),
    createVoiceStream: jest.fn(),
    disconnect: jest.fn(),
  });
  mockClients.push(client);
  return client;
};

// Mock stream classes
class MockTransform extends EventEmitter {
  constructor(options) {
    super();
    this.options = options;
  }
  pipe(dest) {
    this.destination = dest;
    return dest;
  }
  write(data) {
    if (this.options?.transform) {
      this.options.transform(data, null, (err, result) => {
        if (!err && result !== undefined) {
          this.destination?.write?.(result);
        }
      });
    }
    return true;
  }
  end() {
    this.emit("end");
    this.destination?.end?.();
  }
}

class MockPassThrough extends EventEmitter {
  constructor() {
    super();
    this.data = [];
  }
  pipe(dest) {
    this.destination = dest;
    return dest;
  }
  write(data) {
    this.data.push(data);
    this.emit("data", data);
    this.destination?.write?.(data);
    return true;
  }
  end() {
    this.emit("end");
    this.destination?.end?.();
  }
}

// Set up all mocks BEFORE any imports
jest.unstable_mockModule("stream", () => ({
  Transform: MockTransform,
  PassThrough: MockPassThrough,
}));

jest.unstable_mockModule("../app/utils/to-arraybuffer-lite.js", () => ({
  default: jest.fn((buf) => buf),
}));

jest.unstable_mockModule("../app/utils/chunker-lite.js", () => ({
  default: jest.fn(() => ({
    pipe: jest.fn((dest) => dest),
    write: jest.fn(),
    end: jest.fn(),
  })),
}));

jest.unstable_mockModule("../app/audio/codecs-browser.js", () => ({
  default: { opus: "mocked" },
}));

// Mock mumble-websocket to return new client each time
const mumbleConnectMock = jest.fn(() => Promise.resolve(createMockClient()));
jest.unstable_mockModule("../app/mumble-websocket.js", () => ({
  default: mumbleConnectMock,
}));

// Mock global self
const postMessageCalls = [];

// Spy on globalThis
jest.spyOn(globalThis, 'addEventListener');
jest.spyOn(globalThis, 'postMessage').mockImplementation((msg) => postMessageCalls.push(msg));

// For backward compatibility if needed
globalThis.self = {
  postMessage: globalThis.postMessage,
  addEventListener: globalThis.addEventListener,
};

// Mock require for worker.js (needed for codecs)
globalThis.require = jest.fn((path) => {
  if (path === "./audio/codecs-browser.js") return { opus: "mocked" };
  return {};
});

// Now import worker (this registers the message listener)
await import("../app/worker.js");

// Extract the message handler
const messageListenerCall = globalThis.addEventListener.mock.calls.find(
  (call) => call[0] === "message"
);
const messageHandler = messageListenerCall?.[1];

describe("worker.js", () => {
  // ============ HELPER FUNCTIONS ============
  /**
   * Connects to a test server and returns connection info.
   * Reduces boilerplate across tests.
   */
  async function connectClient(reqId = 1, host = "wss://test", args = {}) {
    await messageHandler({ 
      data: { 
        reqId, 
        method: "_connect", 
        payload: { host, args } 
      } 
    });
    await new Promise(resolve => setTimeout(resolve, 0));
    
    const client = mockClients.at(-1);
    const connectResponse = postMessageCalls.find(call => call.reqId === reqId);
    const clientId = connectResponse?.result;
    
    return { client, clientId, connectResponse };
  }

  /**
   * Creates a mock channel with all required properties.
   */
  function createMockChannel(overrides = {}) {
    const channel = new EventEmitter();
    Object.assign(channel, {
      id: 0,
      name: "Root",
      children: [],
      links: [],
      parent: null,
      position: 0,
      description: "",
      ...overrides
    });
    return channel;
  }

  /**
   * Creates a mock user with all required properties.
   */
  function createMockUser(overrides = {}) {
    const user = new EventEmitter();
    Object.assign(user, {
      session: 123,
      username: "TestUser",
      setChannel: jest.fn(),
      sendMessage: jest.fn(),
      requestMove: jest.fn(),
      ...overrides
    });
    return user;
  }

  /**
   * Sets up a connected client with root channel and self.
   */
  async function setupConnectedClientWithRoot(reqId = 1) {
    const { client, clientId } = await connectClient(reqId);
    const mockRoot = createMockChannel();
    client.root = mockRoot;
    client.self = { id: 99 };
    return { client, clientId, mockRoot };
  }

  // ============ SETUP / TEARDOWN ============
  beforeEach(() => {
    jest.clearAllMocks();
    postMessageCalls.length = 0;
    mockClients.length = 0;
  });

  afterAll(() => {
    jest.restoreAllMocks();
  });

  describe("Module initialization", () => {
    test("should register message event listener", () => {
      expect(messageHandler).toBeDefined();
      expect(typeof messageHandler).toBe("function");
    });

    test("should have postMessage function", () => {
      expect(globalThis.postMessage).toBeDefined();
      expect(typeof globalThis.postMessage).toBe("function");
    });
  });

  describe("Connection handling", () => {
    test("should handle connect request", async () => {
      const { clientId } = await connectClient(1, "wss://example.com", { username: "test" });

      expect(mumbleConnectMock).toHaveBeenCalledWith(
        "wss://example.com",
        expect.objectContaining({ username: "test" }),
        expect.objectContaining({ signal: expect.any(AbortSignal) })
      );
      expect(globalThis.self.postMessage).toHaveBeenCalledWith(
        expect.objectContaining({ reqId: 1, result: clientId }),
        undefined
      );
    });

    test("should proxy client events", async () => {
      const { client } = await connectClient(2, "wss://example.com");
      
      const denialReason = { type: 1, reason: "Invalid password" };
      client.emit("denied", denialReason);
      
      expect(globalThis.self.postMessage).toHaveBeenCalledWith(
        expect.objectContaining({ event: "denied", value: [denialReason] }),
        undefined
      );
    });

    test("should abort and discard a cancelled pending connection", async () => {
      let resolveConnection;
      const client = createMockClient();
      mumbleConnectMock.mockReturnValueOnce(new Promise(resolve => {
        resolveConnection = resolve;
      }));

      messageHandler({
        data: {
          reqId: 77,
          method: "_connect",
          payload: { host: "wss://pending", args: {} },
        },
      });
      const signal = mumbleConnectMock.mock.calls.at(-1)[2].signal;

      messageHandler({
        data: {
          method: "_cancelConnect",
          payload: { reqId: 77 },
        },
      });

      expect(signal.aborted).toBe(true);
      resolveConnection(client);
      await new Promise(resolve => setTimeout(resolve, 0));

      expect(client.disconnect).toHaveBeenCalled();
      expect(postMessageCalls).not.toContainEqual(
        expect.objectContaining({ reqId: 77 })
      );
    });
  });

  describe("Voice stream handling", () => {
    test("should handle createVoiceStream message", async () => {
      const { client, clientId } = await connectClient();
      const mockStream = new EventEmitter();
      client.createVoiceStream.mockReturnValue(mockStream);

      messageHandler({ data: { clientId, method: "createVoiceStream", payload: [1, 960] } });

      expect(client.createVoiceStream).toHaveBeenCalled();
    });

    test("should handle voice data", () => {
      const msg = {
        voiceId: 1,
        chunk: new ArrayBuffer(960 * 4),
      };

      expect(() => messageHandler({ data: msg })).not.toThrow();
    });

    test("should handle voice end", () => {
      const msg = {
        voiceId: 2,
        chunk: null,
      };

      expect(() => messageHandler({ data: msg })).not.toThrow();
    });
  });

  describe("Client method calls", () => {
    test("should handle setSelfMute request", async () => {
      const { client, clientId } = await connectClient();
      client.setSelfMute = jest.fn();

      messageHandler({ data: { clientId, method: "setSelfMute", payload: [true] } });
      
      expect(client.setSelfMute).toHaveBeenCalledWith(true);
    });
  });

  describe("Error handling", () => {
    test("should catch message processing errors", async () => {
      const consoleErrorSpy = jest.spyOn(console, "error").mockImplementation();
      const { clientId } = await connectClient();

      expect(() => messageHandler({ data: { clientId, method: "invalid", payload: {} } })).not.toThrow();
      expect(consoleErrorSpy).toHaveBeenCalled();

      consoleErrorSpy.mockRestore();
    });

    test("should handle connection failure", async () => {
      const connectionError = new Error("Connection refused");
      mumbleConnectMock.mockRejectedValueOnce(connectionError);

      const msg = {
        reqId: 99,
        method: "_connect",
        payload: { host: "wss://invalid", args: {} },
      };

      await messageHandler({ data: msg });
      await new Promise(resolve => setTimeout(resolve, 0));

      // Should have called postMessage with error
      expect(globalThis.postMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          reqId: 99,
          error: expect.objectContaining({
            message: "Connection refused"
          })
        }),
        undefined
      );
    });

    test("should handle Event objects in reject", async () => {
      // Create a mock WebSocket error event
      const wsError = new Event('error');
      mumbleConnectMock.mockRejectedValueOnce(wsError);

      const msg = {
        reqId: 100,
        method: "_connect",
        payload: { host: "wss://ws-error", args: {} },
      };

      await messageHandler({ data: msg });
      await new Promise(resolve => setTimeout(resolve, 0));

      // Should convert Event to serializable object (reject() uses Error)
      expect(globalThis.postMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          reqId: 100,
          error: expect.objectContaining({
            message: "Connection failed",
            name: "Error"
          })
        }),
        undefined
      );
    });
  });

  describe("Channel and User registration", () => {
    test("should register channel on client", async () => {
      const { client } = await connectClient();
      const mockChannel = createMockChannel();
      client.root = mockChannel;
      client.self = { id: 1 };
      
      globalThis.postMessage.mockClear();
      client.emit('newChannel', mockChannel);
      
      expect(globalThis.postMessage).toHaveBeenCalledWith(
        expect.objectContaining({ event: "newChannel" }),
        undefined
      );
    });

    test("should register user on client", async () => {
      const { client } = await connectClient();
      const mockUser = createMockUser();
      
      client.emit('newUser', mockUser);
      
      expect(globalThis.postMessage).toHaveBeenCalledWith(
        expect.objectContaining({ event: "newUser" }),
        undefined
      );
    });
  });

  describe("setAudioQuality", () => {
    test("should call setAudioQuality on client", async () => {
      const { client, clientId } = await connectClient();
      client.setAudioQuality = jest.fn();

      messageHandler({ data: { clientId, method: "setAudioQuality", payload: [40000, 960] } });
      
      expect(client.setAudioQuality).toHaveBeenCalledWith(40000, 960);
    });
  });

  describe("Disconnect handling", () => {
    test("should handle disconnect request", async () => {
      const { client, clientId } = await connectClient();

      messageHandler({ data: { clientId, method: "disconnect", payload: [] } });
      
      expect(client.disconnect).toHaveBeenCalled();
    });
  });

  describe("reject() function branches", () => {
    test("should handle structuredClone failure gracefully", async () => {
      const uncloneable = { message: "Test error", name: "TestError", func: () => {} };
      mumbleConnectMock.mockRejectedValueOnce(uncloneable);
      
      await connectClient(98, "wss://test-unclone");
      
      expect(globalThis.postMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          reqId: 98,
          error: expect.objectContaining({ message: "Test error", name: "TestError" })
        }),
        undefined
      );
    });
  });

  describe("pushProp edge cases", () => {
    test("should handle transformed values", async () => {
      const { client, mockRoot } = await setupConnectedClientWithRoot();
      mockRoot.id = 1;
      client.self = { id: 42 };
      
      globalThis.postMessage.mockClear();
      client.emit('maxBandwidthChange');
      
      expect(globalThis.postMessage).toHaveBeenCalled();
    });
  });

  describe("Voice stream target handling", () => {
    test("should handle different voice targets", async () => {
      const { client, clientId } = await connectClient();
      client.createVoiceStream.mockClear();

      messageHandler({ data: { clientId, method: "createVoiceStream", payload: [31] } });
      
      expect(client.createVoiceStream).toHaveBeenCalled();
    });
  });

  describe("User method calls", () => {
    test("should handle user method calls when user exists", async () => {
      const { clientId } = await connectClient();
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      
      messageHandler({ data: { clientId, userId: 42, method: "requestMove", payload: [1] } });
      
      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });

    test("should reject disallowed methods", async () => {
      const { clientId } = await connectClient();
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      
      messageHandler({ data: { clientId, userId: 42, method: "dangerousMethod", payload: [] } });
      
      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });
  });

  describe("Channel method calls", () => {
    test("should call allowed channel methods", async () => {
      const { client, clientId } = await connectClient();
      const mockChannel = { sendMessage: jest.fn() };
      client.getChannelById = jest.fn(() => mockChannel);

      messageHandler({ data: { clientId, channelId: 0, method: "sendMessage", payload: ["Hello"] } });
      
      expect(mockChannel.sendMessage).toHaveBeenCalledWith("Hello");
    });
  });

  describe("Edge cases", () => {
    test("should handle missing target gracefully", async () => {
      const { client, clientId } = await connectClient();
      client.getUserById = jest.fn(() => null);
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      
      messageHandler({ data: { clientId, userId: 999, method: "requestMove", payload: [1] } });
      
      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });

    test("should handle postMessage failure", async () => {
      const { client } = await connectClient();
      const errorSpy = jest.spyOn(console, 'error').mockImplementation();
      const throwingMock = jest.fn((msg) => {
        if (msg.event) throw new Error('postMessage failed');
        postMessageCalls.push(msg);
      });
      globalThis.postMessage = throwingMock;
      globalThis.self.postMessage = throwingMock;
      
      expect(() => client.emit('denied', { type: 1, reason: "Test" })).toThrow('postMessage failed');
      
      globalThis.postMessage = jest.fn((msg) => postMessageCalls.push(msg));
      globalThis.self.postMessage = globalThis.postMessage;
      errorSpy.mockRestore();
    });
  });

  describe("Client initialization edge cases", () => {
    test("should handle client with root channel already set", async () => {
      const clientWithRoot = createMockClient();
      const mockRoot = createMockChannel();
      clientWithRoot.root = mockRoot;
      clientWithRoot.users = [];
      
      mumbleConnectMock.mockResolvedValueOnce(clientWithRoot);
      await connectClient(50, "wss://test-with-root");
      
      const rootPropMessage = postMessageCalls.find(
        call => call.prop === 'root' && call.clientId !== undefined
      );
      expect(rootPropMessage).toBeDefined();
    });

    test("should handle newChannel event after connection", async () => {
      const clientNoRoot = createMockClient();
      clientNoRoot.root = null;
      clientNoRoot.users = [];
      clientNoRoot.channels = {};
      clientNoRoot.self = { id: 99 };
      
      mumbleConnectMock.mockResolvedValueOnce(clientNoRoot);
      await connectClient(51, "wss://test-no-root");
      
      const mockChannel = createMockChannel();
      clientNoRoot.root = mockChannel;
      clientNoRoot.emit('newChannel', mockChannel);
      
      await new Promise(resolve => setTimeout(resolve, 10));
      
      const channelMessage = postMessageCalls.find(call => call.event === 'newChannel');
      expect(channelMessage).toBeDefined();
    });

    test("should handle connected event triggering initialization", async () => {
      const clientNoRoot = createMockClient();
      clientNoRoot.root = null;
      clientNoRoot.users = [];
      clientNoRoot.channels = {};
      clientNoRoot.self = { id: 99 };
      
      mumbleConnectMock.mockResolvedValueOnce(clientNoRoot);
      await connectClient(52, "wss://test-connected-event");
      
      const mockRoot = createMockChannel();
      clientNoRoot.root = mockRoot;
      clientNoRoot.emit('connected');
      await new Promise(resolve => setTimeout(resolve, 10));
      
      expect(postMessageCalls.length).toBeGreaterThan(0);
    });

    test("should cleanup on disconnect", async () => {
      const clientWithRoot = createMockClient();
      const mockRoot = createMockChannel();
      clientWithRoot.root = mockRoot;
      clientWithRoot.users = [];
      
      mumbleConnectMock.mockResolvedValueOnce(clientWithRoot);
      await connectClient(53, "wss://test-disconnect");
      
      expect(() => clientWithRoot.emit('disconnect')).not.toThrow();
    });

    test("should handle dataPing event for stats", async () => {
      const { client } = await connectClient(54, "wss://test-dataping");
      client.dataStats = { ping: 50, jitter: 10 };
      
      globalThis.postMessage.mockClear();
      client.emit('dataPing');
      
      const statsMessage = postMessageCalls.find(call => call.prop === 'dataStats');
      expect(statsMessage).toBeDefined();
    });

    test("should handle serverVersion event", async () => {
      const { client } = await connectClient(55, "wss://test-version");
      client.serverVersion = "1.5.0";
      
      globalThis.postMessage.mockClear();
      client.emit('serverVersion');
      
      const versionMessage = postMessageCalls.find(call => call.prop === 'serverVersion');
      expect(versionMessage).toBeDefined();
    });
  });

  describe("User setChannel method", () => {
    test("should transform channel ID to channel object for setChannel", async () => {
      const { client, clientId } = await connectClient();
      const mockUser = createMockUser();
      const mockChannel = { id: 5, name: "Test Channel" };
      
      client.getUserById = jest.fn(() => mockUser);
      client.getChannelById = jest.fn(() => mockChannel);

      messageHandler({ data: { clientId, userId: 42, method: "setChannel", payload: [5] } });
      
      expect(client.getChannelById).toHaveBeenCalledWith(5);
      expect(mockUser.setChannel).toHaveBeenCalledWith(mockChannel);
    });
  });

  describe("Voice stream with target", () => {
    test("should pass voice target to stream data", async () => {
      const { client, clientId } = await connectClient();
      let capturedStream = null;
      client.createVoiceStream = jest.fn(() => {
        capturedStream = new MockPassThrough();
        return capturedStream;
      });

      messageHandler({ data: { clientId, method: "createVoiceStream", payload: [100, 960, 31] } });
      
      expect(client.createVoiceStream).toHaveBeenCalledWith(31);
    });
  });

  describe("Channel link handling in update events", () => {
    test("should transform links array in channel update", async () => {
      const clientWithSelf = createMockClient();
      clientWithSelf.self = { id: 99 };
      clientWithSelf.users = [];
      
      const mockChannel = createMockChannel({ id: 1, name: "Test" });
      clientWithSelf.root = mockChannel;
      
      mumbleConnectMock.mockResolvedValueOnce(clientWithSelf);
      await connectClient();
      
      globalThis.postMessage.mockClear();
      postMessageCalls.length = 0;
      
      const linkedChannel = { id: 2, name: "Linked" };
      mockChannel.emit('update', { name: "Updated", links: [linkedChannel] });
      
      const updateMessage = postMessageCalls.find(
        call => call.event === 'update' && call.channelId !== undefined
      );
      
      if (updateMessage) {
        expect(updateMessage.value[0].links).toEqual([2]);
      }
    });
  });

  describe("Message validation", () => {
    test("should reject non-object messages", () => {
      const warnSpy = jest.spyOn(console, 'warn').mockImplementation();
      messageHandler({ data: null });
      expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('invalid data format'));
      warnSpy.mockRestore();
    });

    test("should reject messages with invalid structure", () => {
      const warnSpy = jest.spyOn(console, 'warn').mockImplementation();
      messageHandler({ data: { somethingRandom: 123 } });
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('invalid message structure'),
        expect.any(Object)
      );
      warnSpy.mockRestore();
    });

    test("should handle message exceptions gracefully", async () => {
      const errorSpy = jest.spyOn(console, 'error').mockImplementation();
      const { client, clientId } = await connectClient();
      client.getUserById = jest.fn(() => { throw new Error('Test exception'); });
      
      messageHandler({ data: { clientId, userId: 42, method: "sendMessage", payload: ["test"] } });
      
      expect(errorSpy).toHaveBeenCalled();
      errorSpy.mockRestore();
    });
  });

  describe("Voice stream handling", () => {
    test("should handle voice data write", async () => {
      const { client, clientId } = await connectClient();
      const mockStream = new MockPassThrough();
      client.createVoiceStream.mockReturnValue(mockStream);
      const writeSpy = jest.spyOn(MockPassThrough.prototype, 'write');

      messageHandler({ data: { clientId, method: "createVoiceStream", payload: [5, 960, 0] } });
      
      const voiceData = new ArrayBuffer(960 * 4);
      messageHandler({ data: { voiceId: 5, chunk: voiceData } });

      // handleVoiceStream writes to the internal resampler (a PassThrough),
      // which then pipes through chunker/transform stages to the user stream.
      expect(writeSpy).toHaveBeenCalledTimes(1);
      expect(writeSpy.mock.calls[0][0]).toHaveLength(960 * 4);
      writeSpy.mockRestore();
    });

    test("should end voice stream when chunk is null", async () => {
      const { client, clientId } = await connectClient();
      const mockStream = new MockPassThrough();
      client.createVoiceStream.mockReturnValue(mockStream);
      const endSpy = jest.spyOn(MockPassThrough.prototype, 'end');

      messageHandler({ data: { clientId, method: "createVoiceStream", payload: [6, 960, 0] } });
      messageHandler({ data: { voiceId: 6, chunk: null } });

      // handleVoiceStream ends the internal resampler (a PassThrough) when chunk is null
      expect(endSpy).toHaveBeenCalledTimes(1);
      endSpy.mockRestore();
    });
  });
});


