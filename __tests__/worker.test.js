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

  describe("Voice stream setup", () => {
    test("should handle createVoiceStream message", () => {
      const msg = {
        clientId: 1,
        method: "createVoiceStream",
        payload: [1, 960], // voiceId, samplesPerPacket
      };

      expect(() => messageHandler({ data: msg })).not.toThrow();
    });

    test("should handle voice data chunks", () => {
      // First create voice stream
      const setupMsg = {
        clientId: 1,
        method: "createVoiceStream",
        payload: [1, 960],
      };
      messageHandler({ data: setupMsg });

      // Then send voice data
      const dataMsg = {
        voiceId: 1,
        chunk: new Float32Array(960).buffer,
      };

      expect(() => messageHandler({ data: dataMsg })).not.toThrow();
    });

    test("should handle voice stream end", () => {
      const msg = {
        voiceId: 1,
        chunk: null,
      };

      expect(() => messageHandler({ data: msg })).not.toThrow();
    });
  });

  describe("Client method calls", () => {
    test("should handle setSelfMute request", () => {
      const msg = {
        clientId: 1,
        method: "setSelfMute",
        payload: [true],
      };

      expect(() => messageHandler({ data: msg })).not.toThrow();
    });

    test("should handle setSelfDeaf request", () => {
      const msg = {
        clientId: 1,
        method: "setSelfDeaf",
        payload: [true],
      };

      expect(() => messageHandler({ data: msg })).not.toThrow();
    });

    test("should handle setAudioQuality request", () => {
      const msg = {
        clientId: 1,
        method: "setAudioQuality",
        payload: [96000],
      };

      expect(() => messageHandler({ data: msg })).not.toThrow();
    });
  });

  describe("User operations", () => {
    test("should handle sendMessage request", () => {
      const msg = {
        userId: 1,
        method: "sendMessage",
        payload: ["Hello, World!"],
        clientId: 1,
      };

      expect(() => messageHandler({ data: msg })).not.toThrow();
    });

    test("should handle user mute request", () => {
      const msg = {
        userId: 1,
        method: "setMute",
        payload: [true],
        clientId: 1,
      };

      expect(() => messageHandler({ data: msg })).not.toThrow();
    });

    test("should handle user deaf request", () => {
      const msg = {
        userId: 1,
        method: "setDeaf",
        payload: [true],
        clientId: 1,
      };

      expect(() => messageHandler({ data: msg })).not.toThrow();
    });
  });

  describe("Channel operations", () => {
    test("should handle channel join request", () => {
      const msg = {
        userId: 1,
        method: "setChannel",
        payload: 2,
        clientId: 1,
      };

      expect(() => messageHandler({ data: msg })).not.toThrow();
    });

    test("should handle channel link request", () => {
      const msg = {
        channelId: 1,
        method: "link",
        payload: [2],
        clientId: 1,
      };

      expect(() => messageHandler({ data: msg })).not.toThrow();
    });
  });

  describe("Disconnect handling", () => {
    test("should handle disconnect request", () => {
      const msg = {
        clientId: 1,
        method: "disconnect",
        payload: [],
      };

      expect(() => messageHandler({ data: msg })).not.toThrow();
    });
  });
});


/**
 * @jest-environment jsdom
 */
import { jest } from "@jest/globals";
import PlaybackBufferProcessor from "../app/audio/playback-buffer-processor.js";

describe("PlaybackBufferProcessor queue management", () => {
  // Assuming MAX_QUEUE_PACKETS is 25 as per the plan's example.
  // This constant should align with the actual value defined in playback-buffer-processor.js
  const MAX_TEST_QUEUE_PACKETS = 25;

  let processor;
  let consoleWarnSpy;

  beforeEach(() => {
    // Spy on console.warn to capture messages and suppress actual output during tests
    consoleWarnSpy = jest.spyOn(console, "warn").mockImplementation(() => {});

    // Instantiate PlaybackBufferProcessor with typical values
    // (bufferSize, sampleRate, numberOfChannels)
    // bufferSize = samplesPerPacket * bytesPerSample (e.g., 960 samples * 4 bytes/float32)
    processor = new PlaybackBufferProcessor(960 * 4, 48000, 1);
  });

  afterEach(() => {
    // Restore the original console.warn implementation after each test
    consoleWarnSpy.mockRestore();
  });

  test("should not drop packets if the queue is below MAX_QUEUE_PACKETS", () => {
    const packetsToSend = MAX_TEST_QUEUE_PACKETS - 5; // Send fewer than the maximum

    for (let i = 0; i < packetsToSend; i++) {
      // Simulate an incoming audio packet
      processor.processAudioFrame({ type: "audio", data: `packet-${i}` });
    }

    // The queue length should be exactly the number of packets sent
    expect(processor._queue.length).toBe(packetsToSend);
    // No warnings should be logged as no packets were dropped
    expect(consoleWarnSpy).not.toHaveBeenCalled();

    // Verify the content of the queue
    for (let i = 0; i < packetsToSend; i++) {
      expect(processor._queue[i]).toEqual({ type: "audio", data: `packet-${i}` });
    }
  });

  test("should enforce MAX_QUEUE_PACKETS limit by dropping oldest packets when overflowing", () => {
    const overflowAmount = 10; // Number of packets to send beyond the max limit
    const totalPacketsToSend = MAX_TEST_QUEUE_PACKETS + overflowAmount;

    // Simulate sending packets, exceeding the maximum queue size
    for (let i = 0; i < totalPacketsToSend; i++) {
      processor.processAudioFrame({ type: "audio", data: `packet-${i}` });
    }

    // After sending more than MAX_QUEUE_PACKETS, the queue length should stabilize at MAX_QUEUE_PACKETS
    expect(processor._queue.length).toBe(MAX_TEST_QUEUE_PACKETS);

    // console.warn should have been called for each packet that was dropped
    expect(consoleWarnSpy).toHaveBeenCalledTimes(overflowAmount);
    // Verify the warning message content
    expect(consoleWarnSpy).toHaveBeenCalledWith(
      "[PLAYBACK] Queue overflow: Dropping oldest packet to maintain buffer size."
    );

    // Verify the content of the queue: the oldest `overflowAmount` packets should be gone
    // The packets remaining should be from `packet-overflowAmount` up to `packet-(totalPacketsToSend - 1)`
    for (let i = 0; i < MAX_TEST_QUEUE_PACKETS; i++) {
      expect(processor._queue[i]).toEqual({
        type: "audio",
        data: `packet-${overflowAmount + i}`,
      });
    }
  });

  test("should drop the oldest packet and maintain size when exactly at limit and new packet arrives", () => {
    // Fill the queue to its maximum capacity
    for (let i = 0; i < MAX_TEST_QUEUE_PACKETS; i++) {
      processor.processAudioFrame({ type: "audio", data: `packet-${i}` });
    }
    expect(processor._queue.length).toBe(MAX_TEST_QUEUE_PACKETS);
    expect(consoleWarnSpy).not.toHaveBeenCalled(); // No drops yet

    // Send one more packet; this should trigger dropping the oldest (packet-0)
    processor.processAudioFrame({
      type: "audio",
      data: `packet-${MAX_TEST_QUEUE_PACKETS}`,
    });

    // The queue length should still be MAX_QUEUE_PACKETS
    expect(processor._queue.length).toBe(MAX_TEST_QUEUE_PACKETS);
    // console.warn should have been called exactly once
    expect(consoleWarnSpy).toHaveBeenCalledTimes(1);
    expect(consoleWarnSpy).toHaveBeenCalledWith(
      "[PLAYBACK] Queue overflow: Dropping oldest packet to maintain buffer size."
    );

    // Verify the contents: packet-0 should be gone, packet-1 is now the first element,
    // and the new packet is at the end.
    expect(processor._queue[0]).toEqual({ type: "audio", data: "packet-1" });
    expect(processor._queue[MAX_TEST_QUEUE_PACKETS - 1]).toEqual({
      type: "audio",
      data: `packet-${MAX_TEST_QUEUE_PACKETS}`,
    });
  });
});