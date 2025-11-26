/**
 * Regression test for BufferQueueNode initialization bug
 * 
 * BUG REPORT (November 10, 2025):
 * - Symptom: After connecting, users could not hear audio from other clients
 * - Root cause: BufferQueueNode was created but initialize() was never called
 * - Impact: AudioWorklet module never loaded, playback completely broken
 * - Why tests missed it: Loopback test only tests same-client playback path,
 *   not cross-client network playback initialization
 * 
 * This test verifies that when a voice stream is received from another user,
 * the BufferQueueNode is properly initialized before being used.
 */

import { jest } from '@jest/globals';
import { createPinia, setActivePinia } from 'pinia';

// Mock BufferQueueNode before importing useUserStore
let mockBufferQueueNodeInstance = null;
let mockInitializeCalled = false;

const MockBufferQueueNode = jest.fn(function(options) {
  // Create instance object without using 'this' assignment
  const instance = {
    options,
    _isReady: false,
    _listeners: {},
    
    // Track initialize() calls
    initialize: jest.fn(async () => {
      mockInitializeCalled = true;
      instance._isReady = true;
    }),
    
    connect: jest.fn(),
    write: jest.fn(),
    setJitterBufferSize: jest.fn(),
    
    on: jest.fn((event, callback) => {
      if (!instance._listeners[event]) {
        instance._listeners[event] = [];
      }
      instance._listeners[event].push(callback);
      return instance;
    }),
    
    emit: jest.fn((event, ...args) => {
      if (instance._listeners[event]) {
        for (const callback of instance._listeners[event]) {
          callback(...args);
        }
      }
      return instance;
    }),
  };
  
  // Capture the instance for test assertions
  mockBufferQueueNodeInstance = instance;
  
  return instance;
});

jest.unstable_mockModule('../../app/audio/buffer-queue-node', () => ({
  default: MockBufferQueueNode
}));

// Mock frequency analyzer
const mockFrequencyAnalyzer = {
  start: jest.fn(),
  stop: jest.fn(),
};

jest.unstable_mockModule('../../app/utils/frequency-analyzer', () => ({
  createFrequencyAnalyzer: jest.fn(() => mockFrequencyAnalyzer)
}));

// Mock voice stream manager
const mockStreamManager = {
  set: jest.fn(),
  cleanup: jest.fn((identifier, callback) => {
    // Simulate cleanup with stored resources
    const resources = {
      stopWatch: jest.fn(),
      analyzer: mockFrequencyAnalyzer,
    };
    callback(resources);
  }),
};

jest.unstable_mockModule('../../app/utils/voice-stream-manager', () => ({
  createVoiceStreamManager: jest.fn(() => mockStreamManager)
}));

// Mock AudioContext
const mockAudioContext = {
  createGain: jest.fn(() => ({
    gain: { value: 1 },
    connect: jest.fn(),
  })),
  createAnalyser: jest.fn(() => ({
    fftSize: 0,
    smoothingTimeConstant: 0,
    connect: jest.fn(),
  })),
  destination: {},
};

// Mock AudioStore
const mockAudioState = {
  getAudioContext: jest.fn(() => mockAudioContext),
  audioContext: mockAudioContext
};

// Mock VoiceStore
const mockVoiceState = {
  isLoopbackMode: false,
  updateLoopbackFrequency: jest.fn(),
  loopbackDominantFrequency: 0
};

// Mock SettingsStore
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

// Import useUserStore
const { useUserStore } = await import('../../app/stores/userStore.js');

describe('Regression: BufferQueueNode initialization bug', () => {
  let userStore;
  let mockUser;
  let mockStream;
  
  beforeEach(async () => {
    setActivePinia(createPinia());
    // Reset mocks
    jest.clearAllMocks();
    mockBufferQueueNodeInstance = null;
    mockInitializeCalled = false;
    
    // Reset store mocks
    mockVoiceState.isLoopbackMode = false;
    
    // Create user store
    userStore = useUserStore();
    
    // Create mock user with EventEmitter pattern
    mockUser = {
      session: 12345,
      username: 'TestUser',
      __ui: null,
      _listeners: {},
      on: jest.fn((event, callback) => {
        if (!mockUser._listeners[event]) {
          mockUser._listeners[event] = [];
        }
        mockUser._listeners[event].push(callback);
        return mockUser;
      }),
      emit: function(event, ...args) {
        if (this._listeners[event]) {
          for (const callback of this._listeners[event]) {
            callback(...args);
          }
        }
        return this;
      },
    };
    
    // Create mock voice stream
    mockStream = {
      _listeners: {},
      on: jest.fn(function(event, callback) {
        if (!this._listeners[event]) {
          this._listeners[event] = [];
        }
        this._listeners[event].push(callback);
        return this;
      }),
      emit: function(event, ...args) {
        if (this._listeners[event]) {
          for (const callback of this._listeners[event]) {
            callback(...args);
          }
        }
        return this;
      },
    };
  });
  
  test('CRITICAL: BufferQueueNode.initialize() must be called when voice stream is received', async () => {
    // Register the user (this sets up voice event handlers)
    userStore.registerUser(mockUser);
    
    // Verify user.on('voice') was called during registration
    expect(mockUser.on).toHaveBeenCalledWith('voice', expect.any(Function));
    
    // Simulate receiving a voice stream (this is what happens in production)
    // Use await to handle async voice handler
    await mockUser.emit('voice', mockStream);
    
    // Wait for next tick to allow async handler to complete
    await new Promise(resolve => setTimeout(resolve, 0));
    
    // CRITICAL ASSERTION: BufferQueueNode constructor must have been called
    expect(MockBufferQueueNode).toHaveBeenCalledWith({
      audioContext: mockAudioContext,
    });
    
    // CRITICAL ASSERTION: initialize() MUST have been called
    // This is the bug that was in production - initialize() was never called!
    expect(mockBufferQueueNodeInstance.initialize).toHaveBeenCalled();
    expect(mockInitializeCalled).toBe(true);
    
    // CRITICAL ASSERTION: initialize() must be called BEFORE connect()
    // Check call order
    const initializeCallOrder = mockBufferQueueNodeInstance.initialize.mock.invocationCallOrder[0];
    const connectCallOrder = mockBufferQueueNodeInstance.connect.mock.invocationCallOrder[0];
    
    expect(initializeCallOrder).toBeLessThan(connectCallOrder);
  });
  
  test('BufferQueueNode.initialize() must be called in loopback mode too', async () => {
    // Setup with loopback mode enabled
    mockVoiceState.isLoopbackMode = true;
    
    // Register the user
    userStore.registerUser(mockUser);
    
    // Simulate receiving a voice stream in loopback mode
    await mockUser.emit('voice', mockStream);
    
    // Wait for async handler
    await new Promise(resolve => setTimeout(resolve, 0));
    
    // Verify initialize() was called even in loopback mode
    expect(mockBufferQueueNodeInstance.initialize).toHaveBeenCalled();
    expect(mockInitializeCalled).toBe(true);
  });
  
  test('Voice stream handler should abort if BufferQueueNode.initialize() fails', async () => {
    // Setup with initialize() that throws error
    MockBufferQueueNode.mockImplementationOnce(function(options) {
      const instance = {
        options,
        _isReady: false,
        _listeners: {},
        
        // Simulate initialization failure
        initialize: jest.fn(async () => {
          throw new Error('AudioWorklet module failed to load');
        }),
        
        connect: jest.fn(),
        write: jest.fn(),
        on: jest.fn(),
      };
      
      mockBufferQueueNodeInstance = instance;
      return instance;
    });
    
    // Spy on console.error to verify error is logged
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    
    userStore.registerUser(mockUser);
    
    // Simulate receiving a voice stream
    await mockUser.emit('voice', mockStream);
    await new Promise(resolve => setTimeout(resolve, 0));
    
    // Verify error was logged (now with emoji and detailed error object)
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      '[VOICE] ❌ Failed to initialize BufferQueueNode:',
      expect.any(Error)
    );
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      '[VOICE] Error details:',
      expect.objectContaining({
        name: expect.any(String),
        message: expect.any(String),
        stack: expect.any(String)
      })
    );
    
    // Verify connect() was NOT called (handler aborted)
    expect(mockBufferQueueNodeInstance.connect).not.toHaveBeenCalled();
    
    consoleErrorSpy.mockRestore();
  });
  
  test('Integration: Full voice stream flow with BufferQueueNode initialization', async () => {
    // This test simulates the complete production scenario:
    // 1. User connects
    // 2. Voice stream is received from another user
    // 3. BufferQueueNode is created and initialized
    // 4. Audio data flows through the node
    
    // Register user (sets up event handlers)
    userStore.registerUser(mockUser);
    
    // Simulate receiving voice stream
    await mockUser.emit('voice', mockStream);
    await new Promise(resolve => setTimeout(resolve, 0));
    
    // Verify BufferQueueNode was created and initialized
    expect(MockBufferQueueNode).toHaveBeenCalled();
    expect(mockBufferQueueNodeInstance.initialize).toHaveBeenCalled();
    
    // Simulate audio data being received
    const audioData = {
      buffer: new Float32Array([0.1, 0.2, 0.3]),
      target: 'normal',
    };
    
    mockStream.emit('data', audioData);
    
    // Verify audio data was written to BufferQueueNode
    expect(mockBufferQueueNodeInstance.write).toHaveBeenCalledWith(audioData.buffer);
    
    // Verify talking state was updated
    expect(mockUser.__ui.talking.value).toBe('on');
    
    // Simulate stream ending
    mockStream.emit('end');
    
    // Verify talking state was reset
    expect(mockUser.__ui.talking.value).toBe('off');
    
    // Verify cleanup was called
    expect(mockStreamManager.cleanup).toHaveBeenCalled();
  });
});
