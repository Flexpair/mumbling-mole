/**
 * Jest Setup
 * 
 * Global test setup - runs once before all tests.
 * Provides browser API mocks and test utilities.
 */

import { jest } from '@jest/globals';

// Mock AudioContext (Web Audio API)
class MockAudioContext {
  state = 'suspended';
  sampleRate = 48000;
  destination = { connect: jest.fn() };
  _resumeCount = 0;

  async resume() {
    this._resumeCount++;
    this.state = 'running';
  }

  async suspend() {
    this.state = 'suspended';
  }

  createAnalyser() {
    return {
      fftSize: 2048,
      frequencyBinCount: 1024,
      connect: jest.fn(),
      disconnect: jest.fn(),
      getByteFrequencyData: jest.fn(),
      getFloatFrequencyData: jest.fn(),
    };
  }

  createGain() {
    return {
      gain: { value: 1 },
      connect: jest.fn(),
      disconnect: jest.fn(),
    };
  }

  createMediaStreamSource() {
    return {
      connect: jest.fn(),
      disconnect: jest.fn(),
    };
  }
}

globalThis.AudioContext = MockAudioContext;

// Mock AudioWorkletNode (not fully supported in jsdom)
globalThis.AudioWorkletNode = class MockAudioWorkletNode {
  constructor() {
    this.port = {
      postMessage: jest.fn(),
      onmessage: null,
    };
  }
  connect() {}
  disconnect() {}
};

// Mock Web Worker
global.Worker = class Worker {
  constructor(stringUrl) {
    this.url = stringUrl;
    this.onmessage = () => {};
    this.onerror = () => {};
  }
  postMessage(msg) {
    // No-op for tests unless mocked specifically
  }
  terminate() {}
  addEventListener(type, listener) {
    if (type === 'message') this.onmessage = listener;
    if (type === 'error') this.onerror = listener;
  }
  removeEventListener() {}
};

// Mock localStorage (jsdom provides this, but ensure it's clean)
beforeEach(() => {
  localStorage.clear();
});

// Mock console.warn/error to reduce noise (but keep for debugging)
const originalWarn = console.warn;
const originalError = console.error;

globalThis.console = {
  ...console,
  warn: jest.fn((...args) => {
    // Uncomment to see warnings during test development:
    // originalWarn(...args);
  }),
  error: jest.fn((...args) => {
    // Uncomment to see errors during test development:
    // originalError(...args);
  }),
};

// Add custom matchers
expect.extend({
  toBeWithinRange(received, floor, ceiling) {
    const pass = received >= floor && received <= ceiling;
    if (pass) {
      return {
        message: () => `expected ${received} not to be within range ${floor} - ${ceiling}`,
        pass: true,
      };
    } else {
      return {
        message: () => `expected ${received} to be within range ${floor} - ${ceiling}`,
        pass: false,
      };
    }
  },
});
