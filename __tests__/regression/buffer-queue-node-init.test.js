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

// Mock BufferQueueNode before importing useUserState
let mockBufferQueueNodeInstance = null;
let mockInitializeCalled = false;

const MockBufferQueueNode = jest.fn().mockImplementation(function(options) {
  mockBufferQueueNodeInstance = this;
  this.options = options;
  this._isReady = false;
  this._listeners = {};
  
  // Track initialize() calls
  this.initialize = jest.fn(async () => {
    mockInitializeCalled = true;
    this._isReady = true;
    return Promise.resolve();
  });
  
  this.connect = jest.fn();
  this.write = jest.fn();
  
  this.on = jest.fn((event, callback) => {
    if (!this._listeners[event]) {
      this._listeners[event] = [];
    }
    this._listeners[event].push(callback);
    return this;
  });
  
  this.emit = jest.fn((event, ...args) => {
    if (this._listeners[event]) {
      for (const callback of this._listeners[event]) {
        callback(...args);
      }
    }
    return this;
  });
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

describe('Regression: BufferQueueNode initialization bug', () => {
  let useUserState;
  let mockAudioContext;
  let mockUser;
  let mockStream;
  
  beforeEach(async () => {
    // Reset mocks
    jest.clearAllMocks();
    mockBufferQueueNodeInstance = null;
    mockInitializeCalled = false;
    
    // Import after mocks are set up
    const module = await import('../../app/composables/useUserState.js');
    useUserState = module.useUserState;
    
    // Create mock AudioContext
    mockAudioContext = {
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
    // Setup
    const mockAudioState = {
      getAudioContext: () => mockAudioContext,
    };
    
    const mockVoiceState = {
      isLoopbackMode: { value: false },
      updateLoopbackFrequency: jest.fn(),
      loopbackDominantFrequency: { value: 0 },
    };
    
    // Create user state
    const userState = useUserState(mockAudioState, mockVoiceState);
    
    // Register the user (this sets up voice event handlers)
    userState.registerUser(mockUser);
    
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
    const mockAudioState = {
      getAudioContext: () => mockAudioContext,
    };
    
    const mockVoiceState = {
      isLoopbackMode: { value: true }, // Loopback mode
      updateLoopbackFrequency: jest.fn(),
      loopbackDominantFrequency: { value: 0 },
    };
    
    // Create user state
    const userState = useUserState(mockAudioState, mockVoiceState);
    
    // Register the user
    userState.registerUser(mockUser);
    
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
      mockBufferQueueNodeInstance = this;
      this.options = options;
      this._isReady = false;
      this._listeners = {};
      
      // Simulate initialization failure
      this.initialize = jest.fn(async () => {
        throw new Error('AudioWorklet module failed to load');
      });
      
      this.connect = jest.fn();
      this.write = jest.fn();
      this.on = jest.fn();
    });
    
    const mockAudioState = {
      getAudioContext: () => mockAudioContext,
    };
    
    const mockVoiceState = {
      isLoopbackMode: { value: false },
      updateLoopbackFrequency: jest.fn(),
      loopbackDominantFrequency: { value: 0 },
    };
    
    // Spy on console.error to verify error is logged
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    
    // Create user state
    const userState = useUserState(mockAudioState, mockVoiceState);
    userState.registerUser(mockUser);
    
    // Simulate receiving a voice stream
    await mockUser.emit('voice', mockStream);
    await new Promise(resolve => setTimeout(resolve, 0));
    
    // Verify error was logged
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      '[VOICE] Failed to initialize BufferQueueNode:',
      expect.any(Error)
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
    
    const mockAudioState = {
      getAudioContext: () => mockAudioContext,
    };
    
    const mockVoiceState = {
      isLoopbackMode: { value: false },
      updateLoopbackFrequency: jest.fn(),
      loopbackDominantFrequency: { value: 0 },
    };
    
    // Create user state
    const userState = useUserState(mockAudioState, mockVoiceState);
    
    // Register user (sets up event handlers)
    userState.registerUser(mockUser);
    
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
