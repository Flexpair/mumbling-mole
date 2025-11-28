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
  });
});
