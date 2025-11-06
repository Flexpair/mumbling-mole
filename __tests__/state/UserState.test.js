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
