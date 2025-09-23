// Test setup file for Vitest
import { vi } from 'vitest';

// Mock browser APIs that aren't available in test environment
global.AudioContext = vi.fn();
global.webkitAudioContext = vi.fn();
global.AudioWorkletNode = vi.fn();
global.localStorage = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
  key: vi.fn(),
  length: 0,
};

// Mock WebSocket for networking tests
global.WebSocket = vi.fn();

// Mock Worker for web worker tests
global.Worker = vi.fn().mockImplementation(() => ({
  postMessage: vi.fn(),
  terminate: vi.fn(),
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
}));

// Mock URL for asset loading tests
global.URL = {
  createObjectURL: vi.fn(),
  revokeObjectURL: vi.fn(),
};
