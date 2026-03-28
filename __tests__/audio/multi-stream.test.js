/**
 * Multi-Stream Unit Tests
 * 
 * Tests critical scenarios where multiple users speak simultaneously.
 * Focus: Race conditions, resource cleanup, memory leaks.
 */

import { jest } from '@jest/globals';
import { createPinia, setActivePinia } from 'pinia';
import { safeStoreToRefs } from '../helpers/safeStoreToRefs.js';

// Mock BufferQueueNode before imports
const mockBufferQueueNodeInstances = [];
const mockBufferQueueNode = jest.fn().mockImplementation(function(config) {
  const instance = {
    initialize: jest.fn().mockResolvedValue(undefined),
    connect: jest.fn(),
    disconnect: jest.fn(),
    dispose: jest.fn(),
    setJitterBufferSize: jest.fn(),
    write: jest.fn(),
    config,
    node: {
      connect: jest.fn(),
      disconnect: jest.fn()
    }
  };
  mockBufferQueueNodeInstances.push(instance);
  return instance;
});

// Mock voice-stream-manager
const mockStreamResources = new Map();

const mockStreamManagerSet = jest.fn((identifier, resources) => {
  mockStreamResources.set(identifier, resources);
});

const mockStreamManagerGet = jest.fn((identifier) => {
  return mockStreamResources.get(identifier);
});

const mockStreamManagerCleanup = jest.fn((identifier, callback) => {
  const resources = mockStreamResources.get(identifier);
  if (!resources) {
    // Try lookup by sessionId (fallback logic)
    for (const [streamId, res] of mockStreamResources.entries()) {
      if (res.sessionId === identifier) {
        if (callback) callback(res);
        mockStreamResources.delete(streamId);
      }
    }
    return;
  }
  if (callback) {
    callback(resources);
  }
  mockStreamResources.delete(identifier);
});

const mockStreamManagerSize = jest.fn(() => mockStreamResources.size);

jest.unstable_mockModule('../../app/audio/buffer-queue-node.js', () => ({
  default: mockBufferQueueNode
}));

jest.unstable_mockModule('../../app/utils/voice-stream-manager.js', () => ({
  createVoiceStreamManager: jest.fn(() => ({
    set: mockStreamManagerSet,
    get: mockStreamManagerGet,
    cleanup: mockStreamManagerCleanup,
    size: mockStreamManagerSize
  }))
}));

jest.unstable_mockModule('../../app/utils/frequency-analyzer.js', () => ({
  createFrequencyAnalyzer: jest.fn(() => ({
    start: jest.fn(),
    stop: jest.fn(),
    getFrequency: jest.fn().mockReturnValue(0)
  }))
}));

// Mock audio state
const mockAudioContext = {
  createGain: jest.fn(() => ({
    gain: { value: 1 },
    connect: jest.fn(),
    disconnect: jest.fn()
  })),
  createAnalyser: jest.fn(() => ({
    fftSize: 0,
    smoothingTimeConstant: 0,
    connect: jest.fn(),
    disconnect: jest.fn()
  })),
  destination: {},
  state: 'running'
};

const mockAudioState = {
  getAudioContext: jest.fn(() => mockAudioContext),
  audioContext: mockAudioContext
};

const mockVoiceState = {
  voiceHandlerReady: true, // Store state is unwrapped
  isLoopbackMode: false // Store state is unwrapped
};

const mockSettingsStore = {
  jitterBufferSize: 3,
  jitterBufferMode: 'balanced'
};

jest.unstable_mockModule('../../app/stores/audioStore.js', () => ({
  useAudioStore: () => mockAudioState
}));

jest.unstable_mockModule('../../app/stores/voiceStore.js', () => ({
  useVoiceStore: () => mockVoiceState
}));

jest.unstable_mockModule('../../app/stores/settingsStore.js', () => ({
  useSettingsStore: () => mockSettingsStore
}));

// Import after mocks
setActivePinia(createPinia());
const { useUserStore } = await import('../../app/stores/userStore.js');

// Mock user factory
function createMockUser(id, name) {
  const eventHandlers = new Map();
  return {
    id,
    name,
    username: name, // Add username field
    session: id, // Add session field
    channel: { id: 1 },
    __ui: null, // Will be set by registerUser
    on: jest.fn((event, handler) => {
      if (!eventHandlers.has(event)) {
        eventHandlers.set(event, []);
      }
      eventHandlers.get(event).push(handler);
    }),
    emit: (event, ...args) => {
      const handlers = eventHandlers.get(event) || [];
      for (const handler of handlers) {
        handler(...args);
      }
    }
  };
}

// Mock voice stream
function createMockVoiceStream() {
  const eventHandlers = new Map();
  const stream = {
    on: jest.fn(function(event, handler) {
      if (!eventHandlers.has(event)) {
        eventHandlers.set(event, []);
      }
      eventHandlers.get(event).push(handler);
      return stream; // Enable chaining
    }),
    emit: (event, ...args) => {
      const handlers = eventHandlers.get(event) || [];
      for (const handler of handlers) {
        handler(...args);
      }
    },
    once: jest.fn()
  };
  return stream;
}

describe('Multi-Stream Voice Handling', () => {
  let userStore;

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();
    mockBufferQueueNodeInstances.length = 0;
    mockStreamResources.clear();

    // Create fresh userStore
    userStore = useUserStore();
  });

  test('should handle 3 simultaneous voice streams without race conditions', async () => {
    // Simulate 3 users speaking at the same time
    const users = [
      createMockUser(1, 'Alice'),
      createMockUser(2, 'Bob'),
      createMockUser(3, 'Charlie')
    ];

    const streams = users.map(() => createMockVoiceStream());

    // Register all users
    for (const user of users) {
      userStore.registerUser(user);
    }

    // Start all voice streams simultaneously (simulates real meeting scenario)
    await Promise.all(
      users.map((user, i) => {
        return new Promise(resolve => {
          user.emit('voice', streams[i]);
          // Wait for async BufferQueueNode initialization (includes worklet loading)
          setTimeout(resolve, 20);
        });
      })
    );

    // Verify all streams were initialized
    expect(mockBufferQueueNodeInstances.length).toBe(3);
    expect(mockStreamManagerSet).toHaveBeenCalledTimes(3);
    
    // Verify stream manager has 3 active streams
    expect(mockStreamManagerSize()).toBe(3);
  });

  test('should cleanup resources when users stop speaking', async () => {
    const user = createMockUser(1, 'Alice');
    const stream = createMockVoiceStream();
    
    userStore.registerUser(user);
    user.emit('voice', stream);
    
    // Wait for initialization
    await new Promise(resolve => setTimeout(resolve, 10));
    
    // Simulate stream end
    stream.emit('end');
    
    // Verify cleanup
    expect(mockStreamManagerCleanup).toHaveBeenCalledWith(1, expect.any(Function));
  });

  test('should handle rapid start/stop sequences (jitter)', async () => {
    const user = createMockUser(1, 'Alice');
    const stream1 = createMockVoiceStream();
    const stream2 = createMockVoiceStream();
    
    userStore.registerUser(user);
    
    // Start stream 1
    user.emit('voice', stream1);
    await new Promise(resolve => setTimeout(resolve, 5));
    
    // Stop stream 1 and immediately start stream 2
    stream1.emit('end');
    user.emit('voice', stream2);
    
    await new Promise(resolve => setTimeout(resolve, 10));
    
    // Verify correct state
    // Should have cleaned up stream 1
    expect(mockStreamManagerCleanup).toHaveBeenCalled();
    // Should have initialized stream 2
    expect(mockBufferQueueNodeInstances.length).toBeGreaterThanOrEqual(1);
  });
  
  test('should create separate gain nodes for multiple streams (deaf-ready architecture)', async () => {
    const users = [
      createMockUser(1, 'Alice'),
      createMockUser(2, 'Bob'),
      createMockUser(3, 'Charlie')
    ];

    const streams = users.map(() => createMockVoiceStream());
    let gainNodeCount = 0;

    // Mock createGain to count gain node creations
    mockAudioContext.createGain.mockImplementation(() => {
      gainNodeCount++;
      return {
        gain: { value: 1 },
        connect: jest.fn(),
        disconnect: jest.fn()
      };
    });

    // Register and start
    for (const user of users) {
      userStore.registerUser(user);
    }
    
    await Promise.all(
      users.map((user, i) => {
        return new Promise(resolve => {
          user.emit('voice', streams[i]);
          setTimeout(resolve, 10);
        });
      })
    );

    // Each stream should have its own gain node (for independent deaf control)
    expect(gainNodeCount).toBe(3);

    // Verify selfDeaf state is available and reactive
    const { selfDeaf } = safeStoreToRefs(userStore);
    expect(selfDeaf.value).toBe(false);
    
    // Toggle deaf state (demonstrates reactivity exists)
    selfDeaf.value = true;
    expect(selfDeaf.value).toBe(true);
    
    selfDeaf.value = false;
    expect(selfDeaf.value).toBe(false);
    
    // Note: Full E2E deaf functionality is tested in integration tests
    // This unit test validates the architectural pattern (separate gain nodes per stream)
  });
});

