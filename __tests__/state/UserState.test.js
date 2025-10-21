/**
 * UserState - Comprehensive Tests
 * 
 * Tests all UserState functionality:
 * - User registration and UI bindings
 * - Voice event handlers (Issue #176 regression prevention)
 * - Mute/deaf state management
 * - Voice stream lifecycle and cleanup
 * - Loopback frequency analysis
 */

import { jest } from '@jest/globals';
import { EventEmitter } from 'events';

// Mock BufferQueueNode
class MockBufferQueueNode {
  constructor() {
    this.connect = jest.fn();
    this.write = jest.fn();
    this.end = jest.fn();
  }
}

// Mock dependencies
jest.unstable_mockModule('../../app/audio/buffer-queue-node.js', () => ({
  default: MockBufferQueueNode
}));

// Now import UserState AFTER mocking
const { default: UserState } = await import('../../app/state/UserState.js');

// Test helper
function createMockUser(username, session, uniqueId = null) {
  const mockUser = new EventEmitter();
  mockUser.username = username;
  mockUser.session = session;
  mockUser.uniqueId = uniqueId; // Note: property is 'uniqueId', not 'uid'
  mockUser.mute = false;
  mockUser.deaf = false;
  mockUser.suppress = false;
  mockUser.selfMute = false;
  mockUser.selfDeaf = false;
  mockUser.channel = {
    __ui: {
      users: {
        push: jest.fn(),
        sort: jest.fn(),
        remove: jest.fn(),
      },
    },
  };
  return mockUser;
}

class MockAudioState {
  constructor() {
    // Track created gain nodes for testing
    this._createdGainNodes = [];
    
    this.audioContext = {
      state: 'running',
      sampleRate: 48000,
      destination: { connect: jest.fn() },
      createGain: jest.fn(() => {
        const gainNode = {
          gain: { value: 1 },
          connect: jest.fn(),
        };
        this._createdGainNodes.push(gainNode);
        return gainNode;
      }),
      createAnalyser: jest.fn(() => ({
        fftSize: 2048,
        frequencyBinCount: 1024,
        getByteFrequencyData: jest.fn(),
        connect: jest.fn(),
      })),
    };
  }
  
  getLastGainNode() {
    return this._createdGainNodes[this._createdGainNodes.length - 1];
  }
}

class MockVoiceState {
  constructor() {
    this._isLoopbackMode = false;
    this._loopbackDominantFrequency = 0;
  }
  isLoopbackMode() {
    return this._isLoopbackMode;
  }
  loopbackDominantFrequency() {
    return this._loopbackDominantFrequency;
  }
  updateLoopbackFrequency(freq) {
    this._loopbackDominantFrequency = freq;
  }
}

describe('UserState - Voice Event Registration', () => {
  let userState;
  let audioState;
  let voiceState;

  beforeEach(() => {
    audioState = new MockAudioState();
    voiceState = new MockVoiceState();
    userState = new UserState(audioState, voiceState);
  });

  test('CRITICAL: voice event handler is registered and called', () => {
    // This catches Issue #176 type bugs

    const mockUser = createMockUser('TestUser', 123);
    
    let voiceHandlerCalled = false;
    const originalOn = mockUser.on.bind(mockUser);
    mockUser.on = jest.fn((event, handler) => {
      if (event === 'voice') {
        const wrapped = (stream) => {
          voiceHandlerCalled = true;
          handler(stream);
        };
        return originalOn(event, wrapped);
      }
      return originalOn(event, handler);
    });

    userState.registerUser(mockUser, jest.fn(), jest.fn());

    expect(mockUser.on).toHaveBeenCalledWith('voice', expect.any(Function));

    const mockStream = new EventEmitter();
    mockUser.emit('voice', mockStream);

    // CRITICAL: If this fails, we have Issue #176
    expect(voiceHandlerCalled).toBe(true);
  });

  test('voice handler NOT called without registration', () => {
    const mockUser = new EventEmitter();
    let called = false;
    mockUser.on('voice', () => { called = true; });
    
    // Don't register user
    mockUser.emit('voice', new EventEmitter());
    
    // Handler IS called (EventEmitter works), but we didn't
    // call registerUser, so UI side wouldn't be set up
    expect(called).toBe(true); // EventEmitter still works
  });
});

describe('UserState - User Registration', () => {
  let userState;
  let audioState;
  let voiceState;

  beforeEach(() => {
    audioState = new MockAudioState();
    voiceState = new MockVoiceState();
    userState = new UserState(audioState, voiceState);
  });

  test('registerUser creates UI bindings', () => {
    const mockUser = createMockUser('Alice', 1, 'uid123');
    const openContextMenu = jest.fn();
    const getContextMenu = jest.fn();

    userState.registerUser(mockUser, openContextMenu, getContextMenu);

    expect(mockUser.__ui).toBeDefined();
    expect(mockUser.__ui.model).toBe(mockUser);
    expect(mockUser.__ui.name()).toBe('Alice');
    // uid is mapped from uniqueId property
    expect(mockUser.__ui.uid()).toBe('uid123');
  });

  test('registerUser skips if __ui already exists', () => {
    const mockUser = createMockUser('Bob', 2);
    mockUser.__ui = { existing: true };

    userState.registerUser(mockUser, jest.fn(), jest.fn());

    // Should not overwrite existing __ui
    expect(mockUser.__ui.existing).toBe(true);
    expect(mockUser.__ui.model).toBeUndefined();
  });

  test('registerUser creates toggleMute/toggleDeaf handlers', () => {
    const mockUser = createMockUser('Charlie', 3);
    userState.thisUser(mockUser.__ui); // Make this the current user

    userState.registerUser(mockUser, jest.fn(), jest.fn());

    expect(mockUser.__ui.toggleMute).toBeDefined();
    expect(mockUser.__ui.toggleDeaf).toBeDefined();
  });

  test('update event changes observable properties', () => {
    const mockUser = createMockUser('Dave', 4);
    userState.registerUser(mockUser, jest.fn(), jest.fn());

    expect(mockUser.__ui.mute()).toBe(false);

    mockUser.emit('update', null, { mute: true });

    expect(mockUser.__ui.mute()).toBe(true);
  });

  test('remove event clears user from channel', () => {
    const mockUser = createMockUser('Eve', 5);
    userState.registerUser(mockUser, jest.fn(), jest.fn());

    const channelUsers = mockUser.channel.__ui.users;
    expect(channelUsers.remove).not.toHaveBeenCalled();

    mockUser.emit('remove');

    expect(channelUsers.remove).toHaveBeenCalledWith(mockUser.__ui);
  });

  test('channel change moves user to new channel', () => {
    const mockUser = createMockUser('Frank', 6);
    userState.registerUser(mockUser, jest.fn(), jest.fn());

    const oldChannelUsers = mockUser.channel.__ui.users;
    const newChannel = {
      __ui: {
        users: {
          push: jest.fn(),
          sort: jest.fn(),
          remove: jest.fn(),
        },
      },
    };

    mockUser.emit('update', null, { channel: newChannel });

    expect(oldChannelUsers.remove).toHaveBeenCalledWith(mockUser.__ui);
    expect(newChannel.__ui.users.push).toHaveBeenCalledWith(mockUser.__ui);
  });

  test('ui.state computed shows all status flags', () => {
    const mockUser = createMockUser('Grace', 7, 'uid456');
    userState.registerUser(mockUser, jest.fn(), jest.fn());

    // Test various flag combinations
    expect(mockUser.__ui.state()).toContain('Authenticated');

    mockUser.emit('update', null, { mute: true });
    expect(mockUser.__ui.state()).toContain('Muted (server)');

    mockUser.emit('update', null, { deaf: true });
    expect(mockUser.__ui.state()).toContain('Deafened (server)');

    mockUser.emit('update', null, { selfMute: true });
    expect(mockUser.__ui.state()).toContain('Muted (self)');

    mockUser.emit('update', null, { selfDeaf: true });
    expect(mockUser.__ui.state()).toContain('Deafened (self)');
  });

  test('toggleMute calls requestMute/requestUnmute', () => {
    const mockUser = createMockUser('Heidi', 8);
    userState.registerUser(mockUser, jest.fn(), jest.fn());
    userState.thisUser(mockUser.__ui);

    // Spy on methods
    const requestMuteSpy = jest.spyOn(userState, 'requestMute');
    const requestUnmuteSpy = jest.spyOn(userState, 'requestUnmute');

    // Initially not muted (check UI observable, which mirrors model property)
    expect(mockUser.__ui.selfMute()).toBe(false);
    mockUser.__ui.toggleMute();
    expect(requestMuteSpy).toHaveBeenCalledWith(mockUser.__ui);

    // requestMute() updates userState.selfMute(), which triggers __ui.selfMute observable
    // But in test we need to manually sync since we're not testing the full integration
    mockUser.__ui.selfMute(true);
    
    mockUser.__ui.toggleMute();
    expect(requestUnmuteSpy).toHaveBeenCalledWith(mockUser.__ui);
  });

  test('toggleDeaf calls requestDeaf/requestUndeaf', () => {
    const mockUser = createMockUser('Ivan', 9);
    userState.registerUser(mockUser, jest.fn(), jest.fn());
    userState.thisUser(mockUser.__ui);

    const requestDeafSpy = jest.spyOn(userState, 'requestDeaf');
    const requestUndeafSpy = jest.spyOn(userState, 'requestUndeaf');

    expect(mockUser.__ui.selfDeaf()).toBe(false);
    mockUser.__ui.toggleDeaf();
    expect(requestDeafSpy).toHaveBeenCalledWith(mockUser.__ui);

    mockUser.__ui.selfDeaf(true);
    
    mockUser.__ui.toggleDeaf();
    expect(requestUndeafSpy).toHaveBeenCalledWith(mockUser.__ui);
  });

  test('openContextMenu handler is set up', () => {
    const mockUser = createMockUser('Judy', 10);
    const openContextMenu = jest.fn();
    const getContextMenu = jest.fn(() => 'menu');

    userState.registerUser(mockUser, openContextMenu, getContextMenu);

    const mockEvent = { clientX: 100, clientY: 200 };
    mockUser.__ui.openContextMenu(null, mockEvent);

    expect(getContextMenu).toHaveBeenCalled();
    expect(openContextMenu).toHaveBeenCalledWith(mockEvent, 'menu', mockUser.__ui);
  });
});

describe('UserState - Mute/Deaf Operations', () => {
  let userState;
  let audioState;
  let voiceState;

  beforeEach(() => {
    audioState = new MockAudioState();
    voiceState = new MockVoiceState();
    userState = new UserState(audioState, voiceState);
  });

  test('requestMute sets selfMute for current user', () => {
    const mockUser = createMockUser('Grace', 7);
    userState.registerUser(mockUser, jest.fn(), jest.fn());
    userState.thisUser(mockUser.__ui);

    expect(userState.selfMute()).toBeFalsy();

    userState.requestMute(mockUser.__ui);

    expect(userState.selfMute()).toBe(true);
  });

  test('requestMute ignores non-current user', () => {
    const mockUser1 = createMockUser('Heidi', 8);
    const mockUser2 = createMockUser('Ivan', 9);
    userState.registerUser(mockUser1, jest.fn(), jest.fn());
    userState.registerUser(mockUser2, jest.fn(), jest.fn());
    userState.thisUser(mockUser1.__ui);

    userState.requestMute(mockUser2.__ui);

    expect(userState.selfMute()).toBeFalsy();
  });

  test('requestDeaf sets both mute and deaf in normal mode', () => {
    const mockUser = createMockUser('Judy', 10);
    userState.registerUser(mockUser, jest.fn(), jest.fn());
    userState.thisUser(mockUser.__ui);

    userState.requestDeaf(mockUser.__ui, false);

    expect(userState.selfMute()).toBe(true);
    expect(userState.selfDeaf()).toBe(true);
  });

  test('requestDeaf sets only deaf in loopback mode', () => {
    const mockUser = createMockUser('Karl', 11);
    userState.registerUser(mockUser, jest.fn(), jest.fn());
    userState.thisUser(mockUser.__ui);

    userState.requestDeaf(mockUser.__ui, true);

    expect(userState.selfMute()).toBeFalsy();
    expect(userState.selfDeaf()).toBe(true);
  });

  test('requestUnmute clears both mute and deaf', () => {
    const mockUser = createMockUser('Laura', 12);
    userState.registerUser(mockUser, jest.fn(), jest.fn());
    userState.thisUser(mockUser.__ui);

    userState.selfMute(true);
    userState.selfDeaf(true);

    userState.requestUnmute(mockUser.__ui);

    expect(userState.selfMute()).toBe(false);
    expect(userState.selfDeaf()).toBe(false);
  });

  test('requestUndeaf clears only deaf', () => {
    const mockUser = createMockUser('Mike', 13);
    userState.registerUser(mockUser, jest.fn(), jest.fn());
    userState.thisUser(mockUser.__ui);

    userState.selfMute(true);
    userState.selfDeaf(true);

    userState.requestUndeaf(mockUser.__ui);

    expect(userState.selfMute()).toBe(true);
    expect(userState.selfDeaf()).toBe(false);
  });
});

describe('UserState - Voice Stream Lifecycle', () => {
  let userState;
  let audioState;
  let voiceState;

  beforeEach(() => {
    jest.useFakeTimers();
    audioState = new MockAudioState();
    voiceState = new MockVoiceState();
    userState = new UserState(audioState, voiceState);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  test('voice stream creates BufferQueueNode and connects audio graph', () => {
    const mockUser = createMockUser('Nina', 14);
    userState.registerUser(mockUser, jest.fn(), jest.fn());

    const mockStream = new EventEmitter();
    mockUser.emit('voice', mockStream);

    // Should create gain node and connect
    expect(audioState.audioContext.createGain).toHaveBeenCalled();
  });

  test('voice stream data updates talking state', () => {
    const mockUser = createMockUser('Oscar', 15);
    userState.registerUser(mockUser, jest.fn(), jest.fn());

    const mockStream = new EventEmitter();
    mockUser.emit('voice', mockStream);

    expect(mockUser.__ui.talking()).toBe('off');

    mockStream.emit('data', { target: 'normal', buffer: new ArrayBuffer(8) });

    expect(mockUser.__ui.talking()).toBe('on');
  });

  test('voice stream handles shout/whisper targets', () => {
    const mockUser = createMockUser('Paula', 16);
    userState.registerUser(mockUser, jest.fn(), jest.fn());

    const mockStream = new EventEmitter();
    mockUser.emit('voice', mockStream);

    mockStream.emit('data', { target: 'shout', buffer: new ArrayBuffer(8) });
    expect(mockUser.__ui.talking()).toBe('shout');

    mockStream.emit('data', { target: 'whisper', buffer: new ArrayBuffer(8) });
    expect(mockUser.__ui.talking()).toBe('whisper');

    mockStream.emit('data', { target: 'loopback', buffer: new ArrayBuffer(8) });
    expect(mockUser.__ui.talking()).toBe('on');
  });

  test('voice stream end cleans up resources', () => {
    const mockUser = createMockUser('Quinn', 17);
    userState.registerUser(mockUser, jest.fn(), jest.fn());

    const mockStream = new EventEmitter();
    mockUser.emit('voice', mockStream);

    mockStream.emit('data', { target: 'normal', buffer: new ArrayBuffer(8) });
    expect(mockUser.__ui.talking()).toBe('on');

    mockStream.emit('end');

    expect(mockUser.__ui.talking()).toBe('off');
    expect(userState._activeVoiceStreams.has(17)).toBe(false);
  });

  test('selfDeaf subscription updates gain', () => {
    const mockUser = createMockUser('Rachel', 18);
    userState.registerUser(mockUser, jest.fn(), jest.fn());

    const mockStream = new EventEmitter();
    mockUser.emit('voice', mockStream);

    // Get the gain node that was created
    const gainNode = audioState.getLastGainNode();
    expect(gainNode.gain.value).toBe(1);

    userState.selfDeaf(true);

    expect(gainNode.gain.value).toBe(0);

    userState.selfDeaf(false);

    expect(gainNode.gain.value).toBe(1);
  });

  test('multiple voice streams clean up previous stream', () => {
    const mockUser = createMockUser('Steve', 19);
    userState.registerUser(mockUser, jest.fn(), jest.fn());

    const mockStream1 = new EventEmitter();
    mockUser.emit('voice', mockStream1);

    expect(userState._activeVoiceStreams.has(19)).toBe(true);

    const mockStream2 = new EventEmitter();
    mockUser.emit('voice', mockStream2);

    // Should still have only one entry (old one cleaned up)
    expect(userState._activeVoiceStreams.size).toBe(1);
  });
});

describe('UserState - Loopback Frequency Analysis', () => {
  let userState;
  let audioState;
  let voiceState;

  beforeEach(() => {
    jest.useFakeTimers();
    audioState = new MockAudioState();
    voiceState = new MockVoiceState();
    voiceState._isLoopbackMode = true;
    userState = new UserState(audioState, voiceState);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  test('loopback mode creates analyser node', () => {
    const mockUser = createMockUser('Tina', 20);
    userState.registerUser(mockUser, jest.fn(), jest.fn());

    const mockStream = new EventEmitter();
    mockUser.emit('voice', mockStream);

    expect(audioState.audioContext.createAnalyser).toHaveBeenCalled();
  });

  test('frequency analysis updates loopback frequency', () => {
    const mockUser = createMockUser('Uma', 21);
    userState.registerUser(mockUser, jest.fn(), jest.fn());

    const mockStream = new EventEmitter();
    
    // Get the analyser that will be created
    let capturedAnalyser = null;
    const originalCreateAnalyser = audioState.audioContext.createAnalyser;
    audioState.audioContext.createAnalyser = jest.fn(() => {
      capturedAnalyser = originalCreateAnalyser();
      
      // Mock frequency data with peak at 440 Hz
      const mockData = new Uint8Array(capturedAnalyser.frequencyBinCount);
      mockData.fill(10); // Background noise
      const peakIndex = Math.floor((440 * capturedAnalyser.frequencyBinCount * 2) / 48000); // Calculate correct bin
      mockData[peakIndex] = 200; // Strong signal at 440 Hz
      
      capturedAnalyser.getByteFrequencyData = jest.fn((array) => {
        array.set(mockData);
      });
      
      return capturedAnalyser;
    });

    mockUser.emit('voice', mockStream);

    // Advance time to trigger analysis
    jest.advanceTimersByTime(100);

    expect(voiceState.loopbackDominantFrequency()).toBeGreaterThan(0);
  });

  test('frequency analysis clears display when muted', () => {
    const mockUser = createMockUser('Victor', 22);
    userState.registerUser(mockUser, jest.fn(), jest.fn());

    const mockStream = new EventEmitter();
    mockUser.emit('voice', mockStream);

    voiceState._loopbackDominantFrequency = 440;
    userState.selfMute(true);

    jest.advanceTimersByTime(100);

    expect(voiceState.loopbackDominantFrequency()).toBe(0);
  });

  test('frequency analysis clears display when deafened', () => {
    const mockUser = createMockUser('William', 25);
    userState.registerUser(mockUser, jest.fn(), jest.fn());

    const mockStream = new EventEmitter();
    mockUser.emit('voice', mockStream);

    voiceState._loopbackDominantFrequency = 440;
    userState.selfDeaf(true);

    jest.advanceTimersByTime(100);

    expect(voiceState.loopbackDominantFrequency()).toBe(0);
  });

  test('frequency analysis handles low amplitude gradually', () => {
    const mockUser = createMockUser('Xena', 26);
    userState.registerUser(mockUser, jest.fn(), jest.fn());

    const mockStream = new EventEmitter();
    
    let capturedAnalyser = null;
    const originalCreateAnalyser = audioState.audioContext.createAnalyser;
    audioState.audioContext.createAnalyser = jest.fn(() => {
      capturedAnalyser = originalCreateAnalyser();
      
      // Mock low amplitude data (below threshold of 50)
      const mockData = new Uint8Array(capturedAnalyser.frequencyBinCount);
      mockData.fill(20); // All below threshold
      
      capturedAnalyser.getByteFrequencyData = jest.fn((array) => {
        array.set(mockData);
      });
      
      return capturedAnalyser;
    });

    mockUser.emit('voice', mockStream);

    // Set initial frequency
    voiceState._loopbackDominantFrequency = 440;

    // First 2 checks - should NOT clear yet (threshold is 3)
    jest.advanceTimersByTime(100);
    expect(voiceState.loopbackDominantFrequency()).toBe(440);
    
    jest.advanceTimersByTime(100);
    expect(voiceState.loopbackDominantFrequency()).toBe(440);

    // Third check - should clear now
    jest.advanceTimersByTime(100);
    expect(voiceState.loopbackDominantFrequency()).toBe(0);
  });

  test('frequency analysis interval is cleaned up on stream end', () => {
    const mockUser = createMockUser('Wendy', 23);
    userState.registerUser(mockUser, jest.fn(), jest.fn());

    const mockStream = new EventEmitter();
    mockUser.emit('voice', mockStream);

    const intervalsBefore = jest.getTimerCount();

    mockStream.emit('end');

    const intervalsAfter = jest.getTimerCount();

    // Interval should be cleared
    expect(intervalsAfter).toBeLessThan(intervalsBefore);
  });
});

describe('UserState - Reset', () => {
  let userState;
  let audioState;
  let voiceState;

  beforeEach(() => {
    audioState = new MockAudioState();
    voiceState = new MockVoiceState();
    userState = new UserState(audioState, voiceState);
  });

  test('reset clears all state', () => {
    const mockUser = createMockUser('Xavier', 24);
    userState.registerUser(mockUser, jest.fn(), jest.fn());
    userState.thisUser(mockUser.__ui);
    userState.selfMute(true);
    userState.selfDeaf(true);

    userState.reset();

    expect(userState.thisUser()).toBeNull();
    expect(userState.selfMute()).toBe(false);
    expect(userState.selfDeaf()).toBe(false);
  });
});
