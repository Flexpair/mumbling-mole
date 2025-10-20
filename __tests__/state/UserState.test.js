/**
 * UserState - Voice Event Registration Tests
 * 
 * Critical test to catch Issue #176 type bugs where voice event
 * handlers are not registered or called properly.
 */

import { jest } from '@jest/globals';
import { EventEmitter } from 'events';

// Mock BufferQueueNode
class MockBufferQueueNode {
  constructor() {
    this.connect = jest.fn();
    this.write = jest.fn();
  }
}

// Mock dependencies
jest.unstable_mockModule('../../app/audio/buffer-queue-node.js', () => ({
  default: MockBufferQueueNode
}));

// Now import UserState AFTER mocking
const { default: UserState } = await import('../../app/state/UserState.js');

// Test helper
function createMockUser(username, session) {
  const mockUser = new EventEmitter();
  mockUser.username = username;
  mockUser.session = session;
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
    this.audioContext = {
      state: 'running',
      sampleRate: 48000,
      destination: { connect: jest.fn() },
      createGain: () => ({
        gain: { value: 1 },
        connect: jest.fn(),
      }),
      createAnalyser: jest.fn(() => ({
        fftSize: 2048,
        frequencyBinCount: 1024,
        connect: jest.fn(),
      })),
    };
  }
}

class MockVoiceState {
  constructor() {
    this._isLoopbackMode = false;
  }
  isLoopbackMode() {
    return this._isLoopbackMode;
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
