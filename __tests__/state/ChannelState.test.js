/**
 * ChannelState - Minimal Tests
 * 
 * Tests ChannelState minimal protocol support:
 * - Root channel tracking
 * - Minimal channel registration (model + name only)
 * - Reset functionality
 * 
 * NOTE: UI features (tree traversal, links, events) removed in refactor.
 * App uses single-channel mode - no channel tree rendering.
 */

import { jest } from '@jest/globals';
import { EventEmitter } from 'events';
import ko from 'knockout';

const { default: ChannelState } = await import('../../app/state/ChannelState.js');

// Test helper
function createMockChannel(name) {
  const channel = new EventEmitter();
  channel.name = name;
  return channel;
}

describe('ChannelState - Constructor & Initialization', () => {
  test('constructor initializes with undefined root', () => {
    const channelState = new ChannelState();
    
    expect(channelState.root()).toBeUndefined();
  });
});

describe('ChannelState - Minimal Registration', () => {
  let channelState;

  beforeEach(() => {
    channelState = new ChannelState();
  });

  test('registerChannel creates minimal UI wrapper', () => {
    const channel = createMockChannel('TestChannel');
    
    channelState.registerChannel(channel);
    
    expect(channel.__ui).toBeDefined();
    expect(channel.__ui.model).toBe(channel);
    expect(channel.__ui.name()).toBe('TestChannel');
  });

  test('registerChannel skips if __ui already exists', () => {
    const channel = createMockChannel('TestChannel');
    channel.__ui = { existing: true };
    
    channelState.registerChannel(channel);
    
    expect(channel.__ui.existing).toBe(true);
    expect(channel.__ui.model).toBeUndefined();
  });

  test('name observable is reactive', () => {
    const channel = createMockChannel('Original');
    channelState.registerChannel(channel);
    
    const spy = jest.fn();
    channel.__ui.name.subscribe(spy);
    
    channel.__ui.name('Updated');
    expect(spy).toHaveBeenCalledWith('Updated');
  });
});

describe('ChannelState - Root Management', () => {
  test('root can be set and retrieved', () => {
    const channelState = new ChannelState();
    const channel = createMockChannel('Root');
    channelState.registerChannel(channel);
    
    channelState.root(channel.__ui);
    
    expect(channelState.root()).toBe(channel.__ui);
    expect(channelState.root().name()).toBe('Root');
  });
});

describe('ChannelState - Reset', () => {
  test('reset clears root', () => {
    const channelState = new ChannelState();
    const channel = createMockChannel('Root');
    channelState.registerChannel(channel);
    channelState.root(channel.__ui);
    
    channelState.reset();
    
    expect(channelState.root()).toBeNull();
  });
});

// ============================================================
// REMOVED TESTS - UI Features No Longer Implemented
// ============================================================
// The following test categories were removed during code cleanup:
// - Channel tree traversal (parent/child relationships, channels array)
// - Channel linking (updateLinks, linked observables, _findLinks, _getAllChannels)
// - Event handlers (update, remove events for dynamic tree changes)
// - UI bindings (expanded, users, userCount, openContextMenu)
// - Parent-child sorting and management
//
// Reason: App uses single-channel mode - all users in same room.
// No UI rendering of channel tree or user lists.
// Protocol still maintains channel.users array (mumble-client/channel.js).
// UI only needs root channel reference for messageBoxHint logic.
