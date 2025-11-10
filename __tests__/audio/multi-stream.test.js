/**
 * Multi-Stream Unit Tests
 * 
 * Tests critical scenarios where multiple users speak simultaneously.
 * Focus: Race conditions, resource cleanup, memory leaks.
 */

import { jest } from '@jest/globals';

// Mock BufferQueueNode before imports
const mockBufferQueueNodeInstances = [];
const mockBufferQueueNode = jest.fn().mockImplementation(function(config) {
  const instance = {
    initialize: jest.fn().mockResolvedValue(undefined),
    connect: jest.fn(),
    disconnect: jest.fn(),
    dispose: jest.fn(),
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

// Import after mocks
const { useUserState } = await import('../../app/composables/useUserState.js');

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
      handlers.forEach(handler => handler(...args));
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
      handlers.forEach(handler => handler(...args));
    },
    once: jest.fn()
  };
  return stream;
}

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
  voiceHandlerReady: { value: true },
  isLoopbackMode: { value: false } // Add missing property
};

describe('Multi-Stream Voice Handling', () => {
  let userState;

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();
    mockBufferQueueNodeInstances.length = 0;
    mockStreamResources.clear();

    // Create fresh userState (only 2 params: audioState, voiceState)
    userState = useUserState(mockAudioState, mockVoiceState);
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
    users.forEach(user => userState.registerUser(user));

    // Start all voice streams simultaneously (simulates real meeting scenario)
    await Promise.all(
      users.map((user, i) => {
        return new Promise(resolve => {
          user.emit('voice', streams[i]);
          // Wait for async initialize to complete
          setTimeout(resolve, 10);
        });
      })
    );

    // All BufferQueueNodes should be created
    expect(mockBufferQueueNode).toHaveBeenCalledTimes(3);

    // All should be initialized
    expect(mockBufferQueueNodeInstances[0].initialize).toHaveBeenCalled();
    expect(mockBufferQueueNodeInstances[1].initialize).toHaveBeenCalled();
    expect(mockBufferQueueNodeInstances[2].initialize).toHaveBeenCalled();

    // All should be connected to audio graph
    expect(mockBufferQueueNodeInstances[0].connect).toHaveBeenCalled();
    expect(mockBufferQueueNodeInstances[1].connect).toHaveBeenCalled();
    expect(mockBufferQueueNodeInstances[2].connect).toHaveBeenCalled();

    // Stream manager should track all 3
    expect(mockStreamResources.size).toBe(3);
  });

  test('should cleanup resources when streams end (prevent memory leaks)', async () => {
    const users = [
      createMockUser(1, 'Alice'),
      createMockUser(2, 'Bob')
    ];

    const streams = users.map(() => createMockVoiceStream());

    // Register and start
    users.forEach(user => userState.registerUser(user));
    
    await Promise.all(
      users.map((user, i) => {
        return new Promise(resolve => {
          user.emit('voice', streams[i]);
          setTimeout(resolve, 10);
        });
      })
    );

    expect(mockStreamResources.size).toBe(2);

    // End first stream
    streams[0].emit('end');

    // Should cleanup first stream
    expect(mockStreamResources.size).toBe(1);

    // End second stream
    streams[1].emit('end');

    // All cleaned up
    expect(mockStreamResources.size).toBe(0);

    // Cleanup should have been called (possibly multiple times per stream due to internal logic)
    expect(mockStreamManagerCleanup).toHaveBeenCalled();
    expect(mockStreamManagerCleanup.mock.calls.length).toBeGreaterThanOrEqual(2);
  });

  test('should handle rapid user join/leave cycles (stress test)', async () => {
    const iterations = 5;

    for (let i = 0; i < iterations; i++) {
      const user = createMockUser(i, `User${i}`);
      const stream = createMockVoiceStream();

      userState.registerUser(user);
      
      await new Promise(resolve => {
        user.emit('voice', stream);
        setTimeout(resolve, 5);
      });

      // Immediately end stream (simulates quick join/leave)
      stream.emit('end');
    }

    // No memory leaks - all streams cleaned up
    expect(mockStreamResources.size).toBe(0);

    // All nodes were created
    expect(mockBufferQueueNode).toHaveBeenCalledTimes(iterations);
    // Cleanup called (possibly multiple times per stream)
    expect(mockStreamManagerCleanup.mock.calls.length).toBeGreaterThanOrEqual(iterations);
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
    users.forEach(user => userState.registerUser(user));
    
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
    expect(userState.selfDeaf.value).toBe(false);
    
    // Toggle deaf state (demonstrates reactivity exists)
    userState.selfDeaf.value = true;
    expect(userState.selfDeaf.value).toBe(true);
    
    userState.selfDeaf.value = false;
    expect(userState.selfDeaf.value).toBe(false);
    
    // Note: Full E2E deaf functionality is tested in integration tests
    // This unit test validates the architectural pattern (separate gain nodes per stream)
  });
});
