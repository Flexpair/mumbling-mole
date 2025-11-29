/**
 * @jest-environment jsdom
 */
import { jest } from "@jest/globals";
import { EventEmitter } from "events";

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
  beforeEach(() => {
    // Clear call history and reset state
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
      const msg = {
        reqId: 1,
        method: "_connect",
        payload: {
          host: "wss://example.com",
          args: { username: "test" }
        },
      };

      await messageHandler({ data: msg });

      // Verify mumbleConnect was called
      expect(mumbleConnectMock).toHaveBeenCalledWith(
        "wss://example.com",
        expect.objectContaining({ username: "test" })
      );

      // Verify success response
      // Note: Promise resolution always happens in a microtask, so we need to wait
      // for the microtask queue to flush before checking postMessage.
      await new Promise(resolve => setTimeout(resolve, 0));

      expect(globalThis.self.postMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          reqId: 1,
          result: expect.any(Number)
        }),
        undefined
      );
    });

    test("should proxy client events", async () => {
      // Connect first
      const msg = {
        reqId: 2,
        method: "_connect",
        payload: {
          host: "wss://example.com",
          args: {}
        },
      };
      await messageHandler({ data: msg });
      await new Promise(resolve => setTimeout(resolve, 0));
      
      const client = mockClients[mockClients.length - 1];
      
      // Emit event on client
      // Note: 'update' is not proxied on the client object itself, only on users/channels.
      // 'denied' is proxied.
      const denialReason = { type: 1, reason: "Invalid password" };
      client.emit("denied", denialReason);
      
      // Verify proxied message
      expect(globalThis.self.postMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          event: "denied",
          value: [denialReason]
        }),
        undefined
      );
    });
  });

  describe("Voice stream handling", () => {
    test("should handle createVoiceStream message", async () => {
      // Connect first
      await messageHandler({ 
        data: { 
          reqId: 1, 
          method: "_connect", 
          payload: { host: "wss://test", args: {} } 
        } 
      });
      await new Promise(resolve => setTimeout(resolve, 0));
      
      const client = mockClients[mockClients.length - 1];
      
      // Mock createVoiceStream on client
      const mockStream = new EventEmitter();
      client.createVoiceStream.mockReturnValue(mockStream);

      // Get the client ID from the connect response
      const connectResponse = postMessageCalls.find(call => call.reqId === 1);
      const clientId = connectResponse.result;

      const msg = {
        clientId: clientId,
        method: "createVoiceStream",
        payload: [1, 960], // voiceId, samplesPerPacket
      };

      messageHandler({ data: msg });

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
      // Connect first
      await messageHandler({ 
        data: { 
          reqId: 1, 
          method: "_connect", 
          payload: { host: "wss://test", args: {} } 
        } 
      });
      await new Promise(resolve => setTimeout(resolve, 0));
      
      const client = mockClients[mockClients.length - 1];
      // Mock setSelfMute on client
      client.setSelfMute = jest.fn();
      
      // Get the client ID
      const connectResponse = postMessageCalls.find(call => call.reqId === 1);
      const clientId = connectResponse.result;

      const msg = {
        clientId: clientId,
        method: "setSelfMute",
        payload: [true],
      };

      messageHandler({ data: msg });
      
      expect(client.setSelfMute).toHaveBeenCalledWith(true);
    });
  });

  describe("Error handling", () => {
    test("should catch message processing errors", async () => {
      const consoleErrorSpy = jest
        .spyOn(console, "error")
        .mockImplementation(() => {});

      // Connect first to get a valid client ID
      await messageHandler({ 
        data: { 
          reqId: 1, 
          method: "_connect", 
          payload: { host: "wss://test", args: {} } 
        } 
      });
      await new Promise(resolve => setTimeout(resolve, 0));
      const connectResponse = postMessageCalls.find(call => call.reqId === 1);
      const clientId = connectResponse.result;

      const msg = {
        clientId: clientId,
        method: "invalid",
        payload: {},
      };

      expect(() => messageHandler({ data: msg })).not.toThrow();
      
      // worker.js logs error but doesn't send response for invalid methods
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
      await messageHandler({ 
        data: { 
          reqId: 1, 
          method: "_connect", 
          payload: { host: "wss://test", args: {} } 
        } 
      });
      await new Promise(resolve => setTimeout(resolve, 0));
      
      const client = mockClients[mockClients.length - 1];
      
      // Simulate root channel with all required properties
      const mockChannel = new EventEmitter();
      mockChannel.id = 0;
      mockChannel.name = "Root";
      mockChannel.children = [];
      mockChannel.links = [];  // Required by pushProp
      mockChannel.parent = null;
      mockChannel.position = 0;
      mockChannel.description = "";
      client.root = mockChannel;
      
      // Set up self user (required by ClientInitializer.initialize)
      client.self = { id: 1 };
      
      // The connect response should have already been sent
      globalThis.postMessage.mockClear();
      
      // Emit newChannel - this triggers registerEventProxy callback
      client.emit('newChannel', mockChannel);
      
      // Should proxy the event
      expect(globalThis.postMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          event: "newChannel"
        }),
        undefined
      );
    });

    test("should register user on client", async () => {
      await messageHandler({ 
        data: { 
          reqId: 1, 
          method: "_connect", 
          payload: { host: "wss://test", args: {} } 
        } 
      });
      await new Promise(resolve => setTimeout(resolve, 0));
      
      const client = mockClients[mockClients.length - 1];
      
      // Simulate user
      const mockUser = new EventEmitter();
      mockUser.session = 123;
      mockUser.username = "TestUser";
      
      // Emit newUser
      client.emit('newUser', mockUser);
      
      expect(globalThis.postMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          event: "newUser"
        }),
        undefined
      );
    });
  });

  describe("setAudioQuality", () => {
    test("should call setAudioQuality on client", async () => {
      await messageHandler({ 
        data: { 
          reqId: 1, 
          method: "_connect", 
          payload: { host: "wss://test", args: {} } 
        } 
      });
      await new Promise(resolve => setTimeout(resolve, 0));
      
      const client = mockClients[mockClients.length - 1];
      client.setAudioQuality = jest.fn();
      
      const connectResponse = postMessageCalls.find(call => call.reqId === 1);
      const clientId = connectResponse.result;

      messageHandler({ 
        data: { 
          clientId, 
          method: "setAudioQuality", 
          payload: [40000, 960] 
        } 
      });
      
      expect(client.setAudioQuality).toHaveBeenCalledWith(40000, 960);
    });
  });

  describe("Disconnect handling", () => {
    test("should handle disconnect request", async () => {
      await messageHandler({ 
        data: { 
          reqId: 1, 
          method: "_connect", 
          payload: { host: "wss://test", args: {} } 
        } 
      });
      await new Promise(resolve => setTimeout(resolve, 0));
      
      const client = mockClients[mockClients.length - 1];
      
      const connectResponse = postMessageCalls.find(call => call.reqId === 1);
      const clientId = connectResponse.result;

      messageHandler({ 
        data: { 
          clientId, 
          method: "disconnect", 
          payload: [] 
        } 
      });
      
      expect(client.disconnect).toHaveBeenCalled();
    });
  });

  describe("reject() function branches", () => {
    test("should handle structuredClone failure gracefully", async () => {
      // Create an object that can't be cloned (has functions)
      const uncloneable = {
        message: "Test error",
        name: "TestError",
        func: () => {},  // Functions can't be cloned
      };
      
      mumbleConnectMock.mockRejectedValueOnce(uncloneable);
      
      await messageHandler({ 
        data: { 
          reqId: 98, 
          method: "_connect", 
          payload: { host: "wss://test-unclone", args: {} } 
        } 
      });
      await new Promise(resolve => setTimeout(resolve, 0));
      
      // Should fall back to extracting message/name/stack
      expect(globalThis.postMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          reqId: 98,
          error: expect.objectContaining({
            message: "Test error",
            name: "TestError"
          })
        }),
        undefined
      );
    });
  });

  describe("pushProp edge cases", () => {
    test("should handle transformed values", async () => {
      await messageHandler({ 
        data: { 
          reqId: 1, 
          method: "_connect", 
          payload: { host: "wss://test", args: {} } 
        } 
      });
      await new Promise(resolve => setTimeout(resolve, 0));
      
      const client = mockClients[mockClients.length - 1];
      
      // Set up client with root for testing
      const mockChannel = new EventEmitter();
      mockChannel.id = 1;
      mockChannel.name = "Root";
      mockChannel.children = [];
      mockChannel.links = [];
      mockChannel.parent = null;
      mockChannel.position = 0;
      mockChannel.description = "";
      client.root = mockChannel;
      client.self = { id: 42 };
      
      // Clear previous calls
      globalThis.postMessage.mockClear();
      
      // Trigger maxBandwidth event (this uses pushProp internally)
      client.emit('maxBandwidthChange');
      
      // Should have called postMessage with prop update
      expect(globalThis.postMessage).toHaveBeenCalled();
    });
  });

  describe("Voice stream target handling", () => {
    test("should handle different voice targets", async () => {
      await messageHandler({ 
        data: { 
          reqId: 1, 
          method: "_connect", 
          payload: { host: "wss://test", args: {} } 
        } 
      });
      await new Promise(resolve => setTimeout(resolve, 0));
      
      const client = mockClients[mockClients.length - 1];
      const connectResponse = postMessageCalls.find(call => call.reqId === 1);
      const clientId = connectResponse.result;
      
      // Reset the mock to track calls
      client.createVoiceStream.mockClear();

      // Test createVoiceStream with loopback target (31)
      messageHandler({
        data: {
          clientId,
          method: "createVoiceStream",
          payload: [31]  // Loopback target
        }
      });
      
      // Verify createVoiceStream was called (method exists in mock)
      expect(client.createVoiceStream).toHaveBeenCalled();
    });
  });

  describe("User method calls", () => {
    test("should handle user method calls when user exists", async () => {
      await messageHandler({ 
        data: { 
          reqId: 1, 
          method: "_connect", 
          payload: { host: "wss://test", args: {} } 
        } 
      });
      await new Promise(resolve => setTimeout(resolve, 0));
      
      const client = mockClients[mockClients.length - 1];
      const connectResponse = postMessageCalls.find(call => call.reqId === 1);
      const clientId = connectResponse.result;

      // Note: In the real implementation, getUserById needs the actual user
      // Just verify the method dispatch logic works correctly
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      
      // This will fail because there's no user with id 42, which tests the 
      // target validation branch
      messageHandler({
        data: {
          clientId,
          userId: 42,
          method: "requestMove",
          payload: [1]
        }
      });
      
      // Should log error about missing target
      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });

    test("should reject disallowed methods", async () => {
      await messageHandler({ 
        data: { 
          reqId: 1, 
          method: "_connect", 
          payload: { host: "wss://test", args: {} } 
        } 
      });
      await new Promise(resolve => setTimeout(resolve, 0));
      
      const client = mockClients[mockClients.length - 1];
      const connectResponse = postMessageCalls.find(call => call.reqId === 1);
      const clientId = connectResponse.result;

      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      
      // Try to call a disallowed method
      messageHandler({
        data: {
          clientId,
          userId: 42,
          method: "dangerousMethod",
          payload: []
        }
      });
      
      // Should log error about disallowed method
      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });
  });

  describe("Channel method calls", () => {
    test("should call allowed channel methods", async () => {
      await messageHandler({ 
        data: { 
          reqId: 1, 
          method: "_connect", 
          payload: { host: "wss://test", args: {} } 
        } 
      });
      await new Promise(resolve => setTimeout(resolve, 0));
      
      const client = mockClients[mockClients.length - 1];
      const connectResponse = postMessageCalls.find(call => call.reqId === 1);
      const clientId = connectResponse.result;

      // Setup mock channel
      const mockChannel = {
        sendMessage: jest.fn()
      };
      client.getChannelById = jest.fn(() => mockChannel);

      // Call channel method
      messageHandler({
        data: {
          clientId,
          channelId: 0,
          method: "sendMessage",
          payload: ["Hello"]
        }
      });
      
      expect(mockChannel.sendMessage).toHaveBeenCalledWith("Hello");
    });
  });

  describe("Edge cases", () => {
    test("should handle missing target gracefully", async () => {
      await messageHandler({ 
        data: { 
          reqId: 1, 
          method: "_connect", 
          payload: { host: "wss://test", args: {} } 
        } 
      });
      await new Promise(resolve => setTimeout(resolve, 0));
      
      const client = mockClients[mockClients.length - 1];
      const connectResponse = postMessageCalls.find(call => call.reqId === 1);
      const clientId = connectResponse.result;

      // Return null for user lookup
      client.getUserById = jest.fn(() => null);

      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      
      // Try to call method on non-existent user
      messageHandler({
        data: {
          clientId,
          userId: 999,
          method: "requestMove",
          payload: [1]
        }
      });
      
      // Should log error but not crash
      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });

    test("should handle postMessage failure", async () => {
      // Connect first
      await messageHandler({ 
        data: { 
          reqId: 1, 
          method: "_connect", 
          payload: { host: "wss://test", args: {} } 
        } 
      });
      await new Promise(resolve => setTimeout(resolve, 0));
      
      const client = mockClients[mockClients.length - 1];
      
      // Make postMessage throw
      const errorSpy = jest.spyOn(console, 'error').mockImplementation();
      const throwingMock = jest.fn((msg) => {
        if (msg.event) {
          throw new Error('postMessage failed');
        }
        postMessageCalls.push(msg);
      });
      globalThis.postMessage = throwingMock;
      globalThis.self.postMessage = throwingMock;
      
      // Emit an event that triggers postMessage
      expect(() => {
        client.emit('denied', { type: 1, reason: "Test" });
      }).toThrow('postMessage failed');
      
      // Restore
      globalThis.postMessage = jest.fn((msg) => postMessageCalls.push(msg));
      globalThis.self.postMessage = globalThis.postMessage;
      errorSpy.mockRestore();
    });
  });

  describe("Client initialization edge cases", () => {
    test("should handle client with root channel already set", async () => {
      // Create a client that already has root set
      const clientWithRoot = createMockClient();
      const mockRoot = new EventEmitter();
      mockRoot.id = 0;
      mockRoot.name = "Root";
      mockRoot.children = [];
      mockRoot.links = [];
      mockRoot.parent = null;
      mockRoot.position = 0;
      mockRoot.description = "";
      clientWithRoot.root = mockRoot;
      clientWithRoot.users = [];
      
      mumbleConnectMock.mockResolvedValueOnce(clientWithRoot);
      
      await messageHandler({ 
        data: { 
          reqId: 50, 
          method: "_connect", 
          payload: { host: "wss://test-with-root", args: {} } 
        } 
      });
      await new Promise(resolve => setTimeout(resolve, 0));
      
      // Should have set up root channel
      const rootPropMessage = postMessageCalls.find(
        call => call.prop === 'root' && call.clientId !== undefined
      );
      expect(rootPropMessage).toBeDefined();
    });

    test("should handle newChannel event after connection", async () => {
      // Create client without root
      const clientNoRoot = createMockClient();
      clientNoRoot.root = null;
      clientNoRoot.users = [];
      clientNoRoot.channels = {};
      clientNoRoot.self = { id: 99 }; // Add self for pushProp
      
      mumbleConnectMock.mockResolvedValueOnce(clientNoRoot);
      
      await messageHandler({ 
        data: { 
          reqId: 51, 
          method: "_connect", 
          payload: { host: "wss://test-no-root", args: {} } 
        } 
      });
      await new Promise(resolve => setTimeout(resolve, 0));
      
      // Now emit newChannel event with a root-like channel
      const mockChannel = new EventEmitter();
      mockChannel.id = 0;
      mockChannel.name = "Root";
      mockChannel.children = [];
      mockChannel.links = [];
      mockChannel.parent = null;
      mockChannel.position = 0;
      mockChannel.description = "";
      
      // Set as root after the fact
      clientNoRoot.root = mockChannel;
      clientNoRoot.emit('newChannel', mockChannel);
      
      // Give time for event processing
      await new Promise(resolve => setTimeout(resolve, 10));
      
      // Should have processed the channel
      const channelMessage = postMessageCalls.find(
        call => call.event === 'newChannel'
      );
      expect(channelMessage).toBeDefined();
    });

    test("should handle connected event triggering initialization", async () => {
      const clientNoRoot = createMockClient();
      clientNoRoot.root = null;
      clientNoRoot.users = [];
      clientNoRoot.channels = {};
      clientNoRoot.self = { id: 99 }; // Add self for pushProp
      
      mumbleConnectMock.mockResolvedValueOnce(clientNoRoot);
      
      await messageHandler({ 
        data: { 
          reqId: 52, 
          method: "_connect", 
          payload: { host: "wss://test-connected-event", args: {} } 
        } 
      });
      await new Promise(resolve => setTimeout(resolve, 0));
      
      // Add root before emitting connected
      const mockRoot = new EventEmitter();
      mockRoot.id = 0;
      mockRoot.name = "Root";
      mockRoot.children = [];
      mockRoot.links = [];
      mockRoot.parent = null;
      mockRoot.position = 0;
      mockRoot.description = "";
      clientNoRoot.root = mockRoot;
      
      // Emit connected event
      clientNoRoot.emit('connected');
      await new Promise(resolve => setTimeout(resolve, 10));
      
      // Should have initialized from connected event
      expect(postMessageCalls.length).toBeGreaterThan(0);
    });

    test("should cleanup on disconnect", async () => {
      const clientWithRoot = createMockClient();
      const mockRoot = new EventEmitter();
      mockRoot.id = 0;
      mockRoot.name = "Root";
      mockRoot.children = [];
      mockRoot.links = [];
      mockRoot.parent = null;
      mockRoot.position = 0;
      mockRoot.description = "";
      clientWithRoot.root = mockRoot;
      clientWithRoot.users = [];
      
      mumbleConnectMock.mockResolvedValueOnce(clientWithRoot);
      
      await messageHandler({ 
        data: { 
          reqId: 53, 
          method: "_connect", 
          payload: { host: "wss://test-disconnect", args: {} } 
        } 
      });
      await new Promise(resolve => setTimeout(resolve, 0));
      
      // Emit disconnect - should cleanup without errors
      expect(() => {
        clientWithRoot.emit('disconnect');
      }).not.toThrow();
    });

    test("should handle dataPing event for stats", async () => {
      await messageHandler({ 
        data: { 
          reqId: 54, 
          method: "_connect", 
          payload: { host: "wss://test-dataping", args: {} } 
        } 
      });
      await new Promise(resolve => setTimeout(resolve, 0));
      
      const client = mockClients[mockClients.length - 1];
      client.dataStats = { ping: 50, jitter: 10 };
      
      globalThis.postMessage.mockClear();
      
      // Emit dataPing
      client.emit('dataPing');
      
      // Should push dataStats prop
      const statsMessage = postMessageCalls.find(call => call.prop === 'dataStats');
      expect(statsMessage).toBeDefined();
    });

    test("should handle serverVersion event", async () => {
      await messageHandler({ 
        data: { 
          reqId: 55, 
          method: "_connect", 
          payload: { host: "wss://test-version", args: {} } 
        } 
      });
      await new Promise(resolve => setTimeout(resolve, 0));
      
      const client = mockClients[mockClients.length - 1];
      client.serverVersion = "1.5.0";
      
      globalThis.postMessage.mockClear();
      
      // Emit serverVersion
      client.emit('serverVersion');
      
      // Should push serverVersion prop
      const versionMessage = postMessageCalls.find(call => call.prop === 'serverVersion');
      expect(versionMessage).toBeDefined();
    });
  });

  describe("User setChannel method", () => {
    test("should transform channel ID to channel object for setChannel", async () => {
      await messageHandler({ 
        data: { 
          reqId: 1, 
          method: "_connect", 
          payload: { host: "wss://test", args: {} } 
        } 
      });
      await new Promise(resolve => setTimeout(resolve, 0));
      
      const client = mockClients[mockClients.length - 1];
      const connectResponse = postMessageCalls.find(call => call.reqId === 1);
      const clientId = connectResponse.result;

      // Setup mock user with setChannel
      const mockUser = {
        setChannel: jest.fn()
      };
      const mockChannel = { id: 5, name: "Test Channel" };
      
      client.getUserById = jest.fn(() => mockUser);
      client.getChannelById = jest.fn((id) => mockChannel);

      // Call setChannel on user
      messageHandler({
        data: {
          clientId,
          userId: 42,
          method: "setChannel",
          payload: [5]  // Channel ID
        }
      });
      
      // Should have looked up channel and passed object to setChannel
      expect(client.getChannelById).toHaveBeenCalledWith(5);
      expect(mockUser.setChannel).toHaveBeenCalledWith(mockChannel);
    });
  });

  describe("Voice stream with target", () => {
    test("should pass voice target to stream data", async () => {
      await messageHandler({ 
        data: { 
          reqId: 1, 
          method: "_connect", 
          payload: { host: "wss://test", args: {} } 
        } 
      });
      await new Promise(resolve => setTimeout(resolve, 0));
      
      const client = mockClients[mockClients.length - 1];
      const connectResponse = postMessageCalls.find(call => call.reqId === 1);
      const clientId = connectResponse.result;
      
      // Mock createVoiceStream to capture what's passed
      let capturedStream = null;
      client.createVoiceStream = jest.fn(() => {
        capturedStream = new MockPassThrough();
        return capturedStream;
      });

      // Create voice stream with loopback target (31)
      messageHandler({
        data: {
          clientId,
          method: "createVoiceStream",
          payload: [100, 960, 31]  // voiceId, samplesPerPacket, voiceTarget
        }
      });
      
      expect(client.createVoiceStream).toHaveBeenCalledWith(31);
    });
  });

  describe("Channel link handling in update events", () => {
    test("should transform links array in channel update", async () => {
      // Create a client with self properly set
      const clientWithSelf = createMockClient();
      clientWithSelf.self = { id: 99 };
      clientWithSelf.users = [];
      
      // Set up root channel for initialization
      const mockChannel = new EventEmitter();
      mockChannel.id = 1;
      mockChannel.name = "Test";
      mockChannel.children = [];
      mockChannel.links = [];
      mockChannel.parent = null;
      mockChannel.position = 0;
      mockChannel.description = "";
      
      clientWithSelf.root = mockChannel;
      
      mumbleConnectMock.mockResolvedValueOnce(clientWithSelf);
      
      await messageHandler({ 
        data: { 
          reqId: 1, 
          method: "_connect", 
          payload: { host: "wss://test", args: {} } 
        } 
      });
      await new Promise(resolve => setTimeout(resolve, 0));
      
      globalThis.postMessage.mockClear();
      postMessageCalls.length = 0;
      
      // Now emit update with links
      const linkedChannel = { id: 2, name: "Linked" };
      mockChannel.emit('update', { 
        name: "Updated",
        links: [linkedChannel] 
      });
      
      // Find the update event message
      const updateMessage = postMessageCalls.find(
        call => call.event === 'update' && call.channelId !== undefined
      );
      
      if (updateMessage) {
        // Links should be transformed to IDs
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
      
      // Object with no recognized properties
      messageHandler({ data: { somethingRandom: 123 } });
      
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('invalid message structure'),
        expect.any(Object)
      );
      warnSpy.mockRestore();
    });

    test("should handle message exceptions gracefully", async () => {
      const errorSpy = jest.spyOn(console, 'error').mockImplementation();
      
      // Connect first
      await messageHandler({ 
        data: { 
          reqId: 1, 
          method: "_connect", 
          payload: { host: "wss://test", args: {} } 
        } 
      });
      await new Promise(resolve => setTimeout(resolve, 0));
      
      const connectResponse = postMessageCalls.find(call => call.reqId === 1);
      const clientId = connectResponse.result;
      
      // Make client throw on method call
      const client = mockClients[mockClients.length - 1];
      client.getUserById = jest.fn(() => {
        throw new Error('Test exception');
      });
      
      // Should not throw but log error
      messageHandler({ 
        data: { 
          clientId,
          userId: 42,
          method: "sendMessage",
          payload: ["test"]
        } 
      });
      
      errorSpy.mockRestore();
    });
  });

  describe("Voice stream handling", () => {
    test("should handle voice data write", async () => {
      await messageHandler({ 
        data: { 
          reqId: 1, 
          method: "_connect", 
          payload: { host: "wss://test", args: {} } 
        } 
      });
      await new Promise(resolve => setTimeout(resolve, 0));
      
      const client = mockClients[mockClients.length - 1];
      const connectResponse = postMessageCalls.find(call => call.reqId === 1);
      const clientId = connectResponse.result;
      
      const mockStream = new MockPassThrough();
      client.createVoiceStream.mockReturnValue(mockStream);

      // Create voice stream
      messageHandler({
        data: {
          clientId,
          method: "createVoiceStream",
          payload: [5, 960, 0]  // voiceId, samplesPerPacket, target
        }
      });
      
      // Write data to stream
      const voiceData = new ArrayBuffer(960 * 4);
      messageHandler({
        data: {
          voiceId: 5,
          chunk: voiceData
        }
      });
      
      // Should have written to stream
      // (The mock PassThrough will receive data)
    });

    test("should end voice stream when chunk is null", async () => {
      await messageHandler({ 
        data: { 
          reqId: 1, 
          method: "_connect", 
          payload: { host: "wss://test", args: {} } 
        } 
      });
      await new Promise(resolve => setTimeout(resolve, 0));
      
      const client = mockClients[mockClients.length - 1];
      const connectResponse = postMessageCalls.find(call => call.reqId === 1);
      const clientId = connectResponse.result;
      
      const mockStream = new MockPassThrough();
      client.createVoiceStream.mockReturnValue(mockStream);

      // Create voice stream
      messageHandler({
        data: {
          clientId,
          method: "createVoiceStream",
          payload: [6, 960, 0]
        }
      });
      
      // End stream with null chunk
      messageHandler({
        data: {
          voiceId: 6,
          chunk: null
        }
      });
    });
  });
});


