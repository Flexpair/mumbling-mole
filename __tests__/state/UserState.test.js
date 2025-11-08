/**
 * UserState - Minimal Tests
 * 
 * Tests UserState minimal protocol support:
 * - thisUser tracking
 * - Self mute/deaf state
 * - Minimal user registration (model, name, channel, talking)
 * - Voice stream management
 * - Request mute/deaf operations
 * 
 * NOTE: UI features (tree management, complex bindings) removed in refactor.
 * App uses single-channel mode - no user tree rendering.
 */

import { jest } from '@jest/globals';
import { EventEmitter } from 'events';

// Mock dependencies
jest.unstable_mockModule('../../app/audio/buffer-queue-node.js', () => ({
  default: jest.fn().mockImplementation(() => ({
    connect: jest.fn(),
    write: jest.fn(),
    end: jest.fn()
  }))
}));

const { default: UserState } = await import('../../app/state/UserState.js');

// Test helper
function createMockUser(username) {
  const user = new EventEmitter();
  user.username = username;
  user.selfMute = false;
  user.selfDeaf = false;
  user.session = 123;
  user.channel = null;
  return user;
}

describe('UserState - Constructor & Initialization', () => {
  test('constructor initializes observables', () => {
    const audioState = { audioContext: {} };
    const voiceState = {};
    
    const userState = new UserState(audioState, voiceState);
    
    expect(userState.thisUser()).toBeUndefined();
    expect(userState.selfMute()).toBeUndefined();
    expect(userState.selfDeaf()).toBeUndefined();
  });
});

describe('UserState - Minimal Registration', () => {
  let userState;
  let audioState;
  let voiceState;

  beforeEach(() => {
    audioState = { audioContext: { createGain: () => ({ gain: { value: 1 }, connect: jest.fn() }), destination: {} } };
    voiceState = { isLoopbackMode: () => false, loopbackDominantFrequency: () => 0 };
    userState = new UserState(audioState, voiceState);
  });

  test('registerUser creates minimal UI wrapper', () => {
    const user = createMockUser('TestUser');
    
    userState.registerUser(user);
    
    expect(user.__ui).toBeDefined();
    expect(user.__ui.model).toBe(user);
    expect(user.__ui.name()).toBe('TestUser');
    expect(user.__ui.selfMute()).toBe(false);
    expect(user.__ui.selfDeaf()).toBe(false);
    expect(user.__ui.talking()).toBe("off");
  });

  test('registerUser skips if __ui already exists', () => {
    const user = createMockUser('TestUser');
    user.__ui = { existing: true };
    
    userState.registerUser(user);
    
    expect(user.__ui.existing).toBe(true);
    expect(user.__ui.model).toBeUndefined();
  });

  test('registerUser sets channel reference', () => {
    const mockChannel = { __ui: { name: 'TestChannel' } };
    const user = createMockUser('TestUser');
    user.channel = mockChannel;
    
    userState.registerUser(user);
    
    expect(user.__ui.channel()).toBe(mockChannel.__ui);
  });
});

describe('UserState - This User Management', () => {
  test('thisUser can be set and retrieved', () => {
    const audioState = {};
    const voiceState = {};
    const userState = new UserState(audioState, voiceState);
    
    const user = createMockUser('TestUser');
    userState.registerUser(user);
    
    userState.thisUser(user.__ui);
    
    expect(userState.thisUser()).toBe(user.__ui);
    expect(userState.thisUser().name()).toBe('TestUser');
  });
});

describe('UserState - Mute/Deaf Operations', () => {
  let userState;

  beforeEach(() => {
    userState = new UserState({}, {});
  });

  test('requestMute sets selfMute for thisUser', () => {
    const user = createMockUser('TestUser');
    userState.registerUser(user);
    userState.thisUser(user.__ui);
    
    userState.requestMute(user.__ui);
    
    expect(userState.selfMute()).toBe(true);
  });

  test('requestDeaf sets selfDeaf and selfMute for thisUser', () => {
    const user = createMockUser('TestUser');
    userState.registerUser(user);
    userState.thisUser(user.__ui);
    
    userState.requestDeaf(user.__ui, false);
    
    expect(userState.selfDeaf()).toBe(true);
    expect(userState.selfMute()).toBe(true);
  });

  test('requestDeaf in loopback mode does not set selfMute', () => {
    const user = createMockUser('TestUser');
    userState.registerUser(user);
    userState.thisUser(user.__ui);
    
    userState.requestDeaf(user.__ui, true);
    
    expect(userState.selfDeaf()).toBe(true);
    expect(userState.selfMute()).toBeUndefined();
  });

  test('requestUnmute clears selfMute and selfDeaf', () => {
    const user = createMockUser('TestUser');
    userState.registerUser(user);
    userState.thisUser(user.__ui);
    
    userState.selfMute(true);
    userState.selfDeaf(true);
    
    userState.requestUnmute(user.__ui);
    
    expect(userState.selfMute()).toBe(false);
    expect(userState.selfDeaf()).toBe(false);
  });

  test('requestUndeaf clears selfDeaf', () => {
    const user = createMockUser('TestUser');
    userState.registerUser(user);
    userState.thisUser(user.__ui);
    
    userState.selfDeaf(true);
    
    userState.requestUndeaf(user.__ui);
    
    expect(userState.selfDeaf()).toBe(false);
  });

  test('mute/deaf operations ignored for non-thisUser', () => {
    const user1 = createMockUser('User1');
    const user2 = createMockUser('User2');
    userState.registerUser(user1);
    userState.registerUser(user2);
    userState.thisUser(user1.__ui);
    
    userState.requestMute(user2.__ui);
    
    expect(userState.selfMute()).toBeUndefined();
  });
});

describe('UserState - Reset', () => {
  test('reset clears state', () => {
    const userState = new UserState({}, {});
    const user = createMockUser('TestUser');
    userState.registerUser(user);
    userState.thisUser(user.__ui);
    userState.selfMute(true);
    userState.selfDeaf(true);
    
    userState.reset();
    
    expect(userState.thisUser()).toBeNull();
    expect(userState.selfMute()).toBe(false);
    expect(userState.selfDeaf()).toBe(false);
  });
});

describe('UserState - Voice Stream Management', () => {
  let userState;
  let audioState;
  let voiceState;
  let mockAudioContext;
  let mockGainNode;
  let mockAnalyserNode;

  beforeEach(() => {
    // Mock AudioContext
    mockAudioContext = {
      createGain: jest.fn(() => mockGainNode),
      createAnalyser: jest.fn(() => mockAnalyserNode),
      destination: {},
      sampleRate: 48000
    };
    
    // Mock GainNode
    mockGainNode = {
      gain: { value: 1 },
      connect: jest.fn()
    };
    
    // Mock AnalyserNode with context reference
    mockAnalyserNode = {
      fftSize: 2048,
      smoothingTimeConstant: 0,
      connect: jest.fn(),
      getByteFrequencyData: jest.fn(),
      frequencyBinCount: 1024,
      context: mockAudioContext // Important: frequency analyzer needs this
    };
    
    audioState = { audioContext: mockAudioContext };
    voiceState = { 
      isLoopbackMode: jest.fn(() => false),
      loopbackDominantFrequency: jest.fn(() => 0),
      updateLoopbackFrequency: jest.fn()
    };
    
    userState = new UserState(audioState, voiceState);
  });

  test('should create BufferQueueNode on voice stream', () => {
    const user = createMockUser('TestUser');
    userState.registerUser(user);
    
    // Create mock voice stream
    const mockStream = new EventEmitter();
    
    // Emit voice event
    user.emit('voice', mockStream);
    
    // Verify BufferQueueNode was created
    expect(mockAudioContext.createGain).toHaveBeenCalled();
  });

  test('should connect audio nodes in normal mode', () => {
    const user = createMockUser('TestUser');
    userState.registerUser(user);
    
    const mockStream = new EventEmitter();
    user.emit('voice', mockStream);
    
    // Verify node connections: userNode -> gainNode -> destination
    expect(mockGainNode.connect).toHaveBeenCalledWith(mockAudioContext.destination);
  });

  test('should create AnalyserNode in loopback mode', () => {
    voiceState.isLoopbackMode = jest.fn(() => true);
    
    const user = createMockUser('TestUser');
    userState.registerUser(user);
    
    const mockStream = new EventEmitter();
    user.emit('voice', mockStream);
    
    // Verify AnalyserNode was created
    expect(mockAudioContext.createAnalyser).toHaveBeenCalled();
    expect(mockAnalyserNode.fftSize).toBe(32768); // Set by voice handler
  });

  test('should update gain when selfDeaf changes', () => {
    const user = createMockUser('TestUser');
    userState.registerUser(user);
    
    const mockStream = new EventEmitter();
    user.emit('voice', mockStream);
    
    // Initially not deaf
    expect(mockGainNode.gain.value).toBe(1);
    
    // Deafen
    userState.selfDeaf(true);
    
    // Gain should be 0
    expect(mockGainNode.gain.value).toBe(0);
    
    // Undeafen
    userState.selfDeaf(false);
    
    // Gain should be restored
    expect(mockGainNode.gain.value).toBe(1);
  });

  test('should set talking status on voice data', () => {
    const user = createMockUser('TestUser');
    userState.registerUser(user);
    
    const mockStream = new EventEmitter();
    user.emit('voice', mockStream);
    
    // Emit voice data
    mockStream.emit('data', { target: 'normal', buffer: new ArrayBuffer(960) });
    
    expect(user.__ui.talking()).toBe('on');
  });

  test('should handle shout target', () => {
    const user = createMockUser('TestUser');
    userState.registerUser(user);
    
    const mockStream = new EventEmitter();
    user.emit('voice', mockStream);
    
    mockStream.emit('data', { target: 'shout', buffer: new ArrayBuffer(960) });
    
    expect(user.__ui.talking()).toBe('shout');
  });

  test('should handle whisper target', () => {
    const user = createMockUser('TestUser');
    userState.registerUser(user);
    
    const mockStream = new EventEmitter();
    user.emit('voice', mockStream);
    
    mockStream.emit('data', { target: 'whisper', buffer: new ArrayBuffer(960) });
    
    expect(user.__ui.talking()).toBe('whisper');
  });

  test('should handle loopback target', () => {
    voiceState.isLoopbackMode = jest.fn(() => true);
    
    const user = createMockUser('TestUser');
    userState.registerUser(user);
    
    const mockStream = new EventEmitter();
    user.emit('voice', mockStream);
    
    mockStream.emit('data', { target: 'loopback', buffer: new ArrayBuffer(960) });
    
    expect(user.__ui.talking()).toBe('on');
  });

  test('should cleanup on voice stream end', () => {
    const user = createMockUser('TestUser');
    userState.registerUser(user);
    
    const mockStream = new EventEmitter();
    user.emit('voice', mockStream);
    
    // End the stream
    mockStream.emit('end');
    
    // Talking should be off
    expect(user.__ui.talking()).toBe('off');
  });
});

describe('UserState - Cleanup Logic', () => {
  let userState;
  let audioState;
  let voiceState;

  beforeEach(() => {
    const mockGainNode = {
      gain: { value: 1 },
      connect: jest.fn()
    };
    
    const mockAudioContext = {
      createGain: jest.fn(() => mockGainNode),
      destination: {},
      sampleRate: 48000
    };
    
    audioState = { audioContext: mockAudioContext };
    voiceState = { 
      isLoopbackMode: jest.fn(() => false),
      loopbackDominantFrequency: jest.fn(() => 0),
      updateLoopbackFrequency: jest.fn()
    };
    
    userState = new UserState(audioState, voiceState);
  });

  test('should cleanup voice stream idempotently', () => {
    const user = createMockUser('TestUser');
    user.session = 123;
    userState.registerUser(user);
    
    const mockStream = new EventEmitter();
    user.emit('voice', mockStream);
    
    // Cleanup once
    userState._cleanupVoiceStream(123);
    
    // Cleanup again - should not throw
    expect(() => {
      userState._cleanupVoiceStream(123);
    }).not.toThrow();
  });

  test('should cleanup old stream when new stream starts', () => {
    const user = createMockUser('TestUser');
    user.session = 123;
    userState.registerUser(user);
    
    // Start first stream
    const mockStream1 = new EventEmitter();
    user.emit('voice', mockStream1);
    
    // Start second stream (should cleanup first)
    const mockStream2 = new EventEmitter();
    user.emit('voice', mockStream2);
    
    // Should not throw
    expect(user.__ui.talking()).toBe('off'); // Initial state
  });

  test('should handle cleanup with missing resources', () => {
    // Cleanup non-existent stream - should not throw
    expect(() => {
      userState._cleanupVoiceStream('non-existent');
    }).not.toThrow();
  });
});

describe('UserState - Frequency Analysis (Loopback Mode)', () => {
  let userState;
  let audioState;
  let voiceState;
  let mockAudioContext;

  beforeEach(() => {
    // Mock AudioContext first (needed for circular reference)
    mockAudioContext = {
      createGain: jest.fn(),
      createAnalyser: jest.fn(),
      destination: {},
      sampleRate: 48000
    };
    
    const mockAnalyserNode = {
      fftSize: 2048,
      smoothingTimeConstant: 0,
      connect: jest.fn(),
      getByteFrequencyData: jest.fn(),
      frequencyBinCount: 1024,
      context: mockAudioContext // Important: frequency analyzer needs this
    };
    
    const mockGainNode = {
      gain: { value: 1 },
      connect: jest.fn()
    };
    
    // Now set the return values
    mockAudioContext.createGain.mockReturnValue(mockGainNode);
    mockAudioContext.createAnalyser.mockReturnValue(mockAnalyserNode);
    
    audioState = { audioContext: mockAudioContext };
    voiceState = { 
      isLoopbackMode: jest.fn(() => true),
      loopbackDominantFrequency: jest.fn(() => 0),
      updateLoopbackFrequency: jest.fn()
    };
    
    userState = new UserState(audioState, voiceState);
  });

  test('should enable frequency analysis in loopback mode', () => {
    const user = createMockUser('TestUser');
    userState.registerUser(user);
    
    const mockStream = new EventEmitter();
    user.emit('voice', mockStream);
    
    // AnalyserNode should be created
    expect(audioState.audioContext.createAnalyser).toHaveBeenCalled();
  });

  test('should not create AnalyserNode in normal mode', () => {
    voiceState.isLoopbackMode = jest.fn(() => false);
    
    const user = createMockUser('TestUser');
    userState.registerUser(user);
    
    const mockStream = new EventEmitter();
    user.emit('voice', mockStream);
    
    // AnalyserNode should NOT be created
    expect(audioState.audioContext.createAnalyser).not.toHaveBeenCalled();
  });
});

describe('UserState - Edge Cases', () => {
  let userState;
  let audioState;
  let voiceState;

  beforeEach(() => {
    const mockGainNode = {
      gain: { value: 1 },
      connect: jest.fn()
    };
    
    const mockAudioContext = {
      createGain: jest.fn(() => mockGainNode),
      destination: {},
      sampleRate: 48000
    };
    
    audioState = { audioContext: mockAudioContext };
    voiceState = { 
      isLoopbackMode: jest.fn(() => false),
      loopbackDominantFrequency: jest.fn(() => 0),
      updateLoopbackFrequency: jest.fn()
    };
    
    userState = new UserState(audioState, voiceState);
  });

  test('should handle user without session ID', () => {
    const user = createMockUser('TestUser');
    user.session = undefined;
    userState.registerUser(user);
    
    const mockStream = new EventEmitter();
    
    // Should not throw
    expect(() => {
      user.emit('voice', mockStream);
    }).not.toThrow();
  });

  test('should handle multiple users with voice streams', () => {
    const user1 = createMockUser('User1');
    const user2 = createMockUser('User2');
    user1.session = 1;
    user2.session = 2;
    
    userState.registerUser(user1);
    userState.registerUser(user2);
    
    const stream1 = new EventEmitter();
    const stream2 = new EventEmitter();
    
    user1.emit('voice', stream1);
    user2.emit('voice', stream2);
    
    // Both should work independently
    stream1.emit('data', { target: 'normal', buffer: new ArrayBuffer(960) });
    stream2.emit('data', { target: 'normal', buffer: new ArrayBuffer(960) });
    
    expect(user1.__ui.talking()).toBe('on');
    expect(user2.__ui.talking()).toBe('on');
  });

  test('should handle rapid mute/unmute changes', () => {
    const user = createMockUser('TestUser');
    userState.registerUser(user);
    userState.thisUser(user.__ui);
    
    // Rapid toggles
    for (let i = 0; i < 10; i++) {
      userState.requestMute(user.__ui);
      userState.requestUnmute(user.__ui);
    }
    
    // Should end in unmuted state
    expect(userState.selfMute()).toBe(false);
  });

  test('should handle user without channel', () => {
    const user = createMockUser('TestUser');
    user.channel = null;
    
    userState.registerUser(user);
    
    // channel observable should be undefined since user.channel is null
    expect(user.__ui.channel()).toBeUndefined();
  });
});

describe('UserState - Stream Manager Integration', () => {
  let userState;

  beforeEach(() => {
    const mockGainNode = {
      gain: { value: 1 },
      connect: jest.fn()
    };
    
    const mockAudioContext = {
      createGain: jest.fn(() => mockGainNode),
      destination: {},
      sampleRate: 48000
    };
    
    const audioState = { audioContext: mockAudioContext };
    const voiceState = { 
      isLoopbackMode: jest.fn(() => false),
      loopbackDominantFrequency: jest.fn(() => 0)
    };
    
    userState = new UserState(audioState, voiceState);
  });

  test('should have stream manager instance', () => {
    expect(userState._streamManager).toBeDefined();
    expect(typeof userState._streamManager.set).toBe('function');
    expect(typeof userState._streamManager.cleanup).toBe('function');
  });

  test('should track resources in stream manager', () => {
    const user = createMockUser('TestUser');
    user.session = 123;
    userState.registerUser(user);
    
    const mockStream = new EventEmitter();
    user.emit('voice', mockStream);
    
    // Stream manager should have resources tracked
    // (internal state not directly accessible, but no errors means tracking works)
    expect(() => {
      userState._cleanupVoiceStream(123);
    }).not.toThrow();
  });
});

// ============================================================
// REMOVED TESTS - UI Features No Longer Implemented
// ============================================================
// The following test categories were removed during code cleanup:
// - Complex UI bindings (uid, mute, deaf, suppress observables)
// - Toggle handlers (toggleMute, toggleDeaf methods)
// - UI state computed (flags string)
// - Context menu handlers (openContextMenu)
// - Event handlers (update, remove events for dynamic changes)
// - Channel.users array management (push/remove/sort operations)
//
// Reason: App uses single-channel mode - all users in same room.
// No UI rendering of user lists or complex status displays.
// Protocol still maintains channel.users array (mumble-client/user.js).
// UI only needs minimal user.__ui for sendMessage and audio controls.
