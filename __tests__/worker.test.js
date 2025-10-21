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

jest.unstable_mockModule("to-arraybuffer", () => ({
  default: jest.fn((buf) => buf),
}));

jest.unstable_mockModule("stream-chunker", () => ({
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
global.self = {
  postMessage: jest.fn((msg) => postMessageCalls.push(msg)),
  addEventListener: jest.fn(),
};

// Now import worker (this registers the message listener)
await import("../app/worker.js");

// Extract the message handler
const messageListenerCall = global.self.addEventListener.mock.calls.find(
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

  describe("Module initialization", () => {
    test("should register message event listener", () => {
      expect(messageHandler).toBeDefined();
      expect(typeof messageHandler).toBe("function");
    });

    test("should have postMessage function", () => {
      expect(global.self.postMessage).toBeDefined();
      expect(typeof global.self.postMessage).toBe("function");
    });
  });

  // Note: worker.js uses dynamic require() for codecs which is challenging to mock in Jest ESM.
  // Additional testing would require integration tests or a different testing strategy.
  // The Playwright loopback tests provide end-to-end validation of worker functionality.

  describe("Voice stream handling", () => {
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

  describe("Error handling", () => {
    test("should catch message processing errors", () => {
      const consoleErrorSpy = jest
        .spyOn(console, "error")
        .mockImplementation(() => {});

      const msg = {
        reqId: 999,
        method: "invalid",
        payload: {},
      };

      expect(() => messageHandler({ data: msg })).not.toThrow();

      consoleErrorSpy.mockRestore();
    });
  });
});
