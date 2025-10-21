/**
 * ChannelState - Comprehensive Tests
 * 
 * Tests ChannelState functionality:
 * - Channel registration and UI bindings
 * - Channel tree management (parent/child)
 * - Channel linking and link detection
 * - Event handling (update, remove)
 */

import { jest } from '@jest/globals';
import { EventEmitter } from 'events';

const { default: ChannelState } = await import('../../app/state/ChannelState.js');

// Test helper
function createMockChannel(name, position, parent = null) {
  const channel = new EventEmitter();
  channel.name = name;
  channel.position = position;
  channel.description = `Description for ${name}`;
  channel.parent = parent;
  channel.links = [];
  return channel;
}

describe('ChannelState - Constructor & Initialization', () => {
  test('constructor initializes with undefined root', () => {
    const channelState = new ChannelState();
    
    expect(channelState.root()).toBeUndefined();
  });
});

describe('ChannelState - Channel Registration', () => {
  let channelState;

  beforeEach(() => {
    channelState = new ChannelState();
  });

  test('registerChannel creates UI bindings', () => {
    const channel = createMockChannel('TestChannel', 0);
    
    channelState.registerChannel(channel, jest.fn(), jest.fn(), jest.fn());
    
    expect(channel.__ui).toBeDefined();
    expect(channel.__ui.model).toBe(channel);
    expect(channel.__ui.name()).toBe('TestChannel');
    expect(channel.__ui.position()).toBe(0);
  });

  test('registerChannel skips if __ui already exists', () => {
    const channel = createMockChannel('TestChannel', 0);
    channel.__ui = { existing: true };
    
    channelState.registerChannel(channel, jest.fn(), jest.fn(), jest.fn());
    
    expect(channel.__ui.existing).toBe(true);
    expect(channel.__ui.model).toBeUndefined();
  });

  test('registerChannel sets up parent-child relationship', () => {
    const parentChannel = createMockChannel('Parent', 0);
    channelState.registerChannel(parentChannel, jest.fn(), jest.fn(), jest.fn());
    
    const childChannel = createMockChannel('Child', 1, parentChannel);
    channelState.registerChannel(childChannel, jest.fn(), jest.fn(), jest.fn());
    
    expect(childChannel.__ui.parent()).toBe(parentChannel.__ui);
    expect(parentChannel.__ui.channels()).toContain(childChannel.__ui);
  });

  test('registerChannel initializes observables', () => {
    const channel = createMockChannel('TestChannel', 0);
    
    channelState.registerChannel(channel, jest.fn(), jest.fn(), jest.fn());
    
    expect(channel.__ui.expanded()).toBe(true);
    expect(channel.__ui.linked()).toBe(false);
    expect(Array.isArray(channel.__ui.channels())).toBe(true);
    expect(Array.isArray(channel.__ui.users())).toBe(true);
  });

  test('registerChannel calls updateLinks', () => {
    const channel = createMockChannel('TestChannel', 0);
    const updateLinks = jest.fn();
    
    channelState.registerChannel(channel, jest.fn(), jest.fn(), updateLinks);
    
    expect(updateLinks).toHaveBeenCalled();
  });

  test('openContextMenu handler is set up', () => {
    const channel = createMockChannel('TestChannel', 0);
    const openContextMenu = jest.fn();
    const getContextMenu = jest.fn(() => 'menu');
    
    channelState.registerChannel(channel, openContextMenu, getContextMenu, jest.fn());
    
    const mockEvent = { clientX: 100, clientY: 200 };
    channel.__ui.openContextMenu(null, mockEvent);
    
    expect(getContextMenu).toHaveBeenCalled();
    expect(openContextMenu).toHaveBeenCalledWith(mockEvent, 'menu', channel.__ui);
  });
});

describe('ChannelState - Channel Events', () => {
  let channelState;

  beforeEach(() => {
    channelState = new ChannelState();
  });

  test('update event changes observable properties', () => {
    const channel = createMockChannel('TestChannel', 0);
    channelState.registerChannel(channel, jest.fn(), jest.fn(), jest.fn());
    
    expect(channel.__ui.name()).toBe('TestChannel');
    
    channel.emit('update', { name: 'UpdatedChannel' });
    
    expect(channel.__ui.name()).toBe('UpdatedChannel');
  });

  test('update event moves channel to new parent', () => {
    const parent1 = createMockChannel('Parent1', 0);
    const parent2 = createMockChannel('Parent2', 1);
    channelState.registerChannel(parent1, jest.fn(), jest.fn(), jest.fn());
    channelState.registerChannel(parent2, jest.fn(), jest.fn(), jest.fn());
    
    const child = createMockChannel('Child', 2, parent1);
    channelState.registerChannel(child, jest.fn(), jest.fn(), jest.fn());
    
    expect(child.__ui.parent()).toBe(parent1.__ui);
    
    child.emit('update', { parent: parent2 });
    
    expect(parent1.__ui.channels.remove).toHaveBeenCalledWith(child.__ui);
    expect(parent2.__ui.channels()).toContain(child.__ui);
  });

  test('update event with links triggers updateLinks', () => {
    const channel = createMockChannel('TestChannel', 0);
    const updateLinks = jest.fn();
    channelState.registerChannel(channel, jest.fn(), jest.fn(), updateLinks);
    
    updateLinks.mockClear();
    channel.emit('update', { links: [] });
    
    expect(updateLinks).toHaveBeenCalled();
  });

  test('remove event clears channel from parent', () => {
    const parent = createMockChannel('Parent', 0);
    channelState.registerChannel(parent, jest.fn(), jest.fn(), jest.fn());
    
    const child = createMockChannel('Child', 1, parent);
    channelState.registerChannel(child, jest.fn(), jest.fn(), jest.fn());
    
    child.emit('remove');
    
    expect(parent.__ui.channels.remove).toHaveBeenCalledWith(child.__ui);
  });

  test('remove event triggers updateLinks', () => {
    const channel = createMockChannel('TestChannel', 0);
    const updateLinks = jest.fn();
    channelState.registerChannel(channel, jest.fn(), jest.fn(), updateLinks);
    
    updateLinks.mockClear();
    channel.emit('remove');
    
    expect(updateLinks).toHaveBeenCalled();
  });
});

describe('ChannelState - User Count', () => {
  let channelState;

  beforeEach(() => {
    channelState = new ChannelState();
  });

  test('userCount returns user count', () => {
    const channel = createMockChannel('TestChannel', 0);
    channelState.registerChannel(channel, jest.fn(), jest.fn(), jest.fn());
    
    // Add mock users
    channel.__ui.users.push({ name: 'User1' });
    channel.__ui.users.push({ name: 'User2' });
    
    expect(channel.__ui.userCount()).toBe(2);
  });

  test('userCount includes child channel users', () => {
    const parent = createMockChannel('Parent', 0);
    channelState.registerChannel(parent, jest.fn(), jest.fn(), jest.fn());
    
    const child = createMockChannel('Child', 1, parent);
    channelState.registerChannel(child, jest.fn(), jest.fn(), jest.fn());
    
    parent.__ui.users.push({ name: 'User1' });
    child.__ui.users.push({ name: 'User2' });
    child.__ui.users.push({ name: 'User3' });
    
    expect(parent.__ui.userCount()).toBe(3); // 1 + 2 from child
  });
});

describe('ChannelState - Channel Links', () => {
  let channelState;

  beforeEach(() => {
    channelState = new ChannelState();
  });

  test('updateLinks does nothing when no root', () => {
    expect(channelState.root()).toBeUndefined();
    
    // Should not throw
    channelState.updateLinks();
  });

  test('updateLinks marks linked channels', () => {
    const channel1 = createMockChannel('Channel1', 0);
    const channel2 = createMockChannel('Channel2', 1);
    channelState.registerChannel(channel1, jest.fn(), jest.fn(), jest.fn());
    channelState.registerChannel(channel2, jest.fn(), jest.fn(), jest.fn());
    
    channelState.root(channel1.__ui);
    channel1.links = [channel2];
    
    channelState.updateLinks();
    
    expect(channel1.__ui.linked()).toBe(true);
    expect(channel2.__ui.linked()).toBe(true);
  });

  test('updateLinks handles bidirectional links', () => {
    const channel1 = createMockChannel('Channel1', 0);
    const channel2 = createMockChannel('Channel2', 1);
    channelState.registerChannel(channel1, jest.fn(), jest.fn(), jest.fn());
    channelState.registerChannel(channel2, jest.fn(), jest.fn(), jest.fn());
    
    channelState.root(channel1.__ui);
    channel1.links = [channel2];
    channel2.links = [channel1];
    
    channelState.updateLinks();
    
    expect(channel1.__ui.linked()).toBe(true);
    expect(channel2.__ui.linked()).toBe(true);
  });

  test('updateLinks handles transitive links', () => {
    const channel1 = createMockChannel('Channel1', 0);
    const channel2 = createMockChannel('Channel2', 1);
    const channel3 = createMockChannel('Channel3', 2);
    channelState.registerChannel(channel1, jest.fn(), jest.fn(), jest.fn());
    channelState.registerChannel(channel2, jest.fn(), jest.fn(), jest.fn());
    channelState.registerChannel(channel3, jest.fn(), jest.fn(), jest.fn());
    
    channelState.root(channel1.__ui);
    channel1.links = [channel2];
    channel2.links = [channel3];
    
    channelState.updateLinks();
    
    expect(channel1.__ui.linked()).toBe(true);
    expect(channel2.__ui.linked()).toBe(true);
    expect(channel3.__ui.linked()).toBe(true);
  });

  test('updateLinks marks unlinked channels as false', () => {
    const channel1 = createMockChannel('Channel1', 0);
    const channel2 = createMockChannel('Channel2', 1);
    const channel3 = createMockChannel('Channel3', 2);
    channelState.registerChannel(channel1, jest.fn(), jest.fn(), jest.fn());
    channelState.registerChannel(channel2, jest.fn(), jest.fn(), jest.fn());
    channelState.registerChannel(channel3, jest.fn(), jest.fn(), jest.fn());
    
    channelState.root(channel1.__ui);
    channel1.links = [channel2];
    // channel3 is NOT linked
    
    channelState.updateLinks();
    
    expect(channel1.__ui.linked()).toBe(true);
    expect(channel2.__ui.linked()).toBe(true);
    expect(channel3.__ui.linked()).toBe(false);
  });
});

describe('ChannelState - Reset', () => {
  let channelState;

  beforeEach(() => {
    channelState = new ChannelState();
  });

  test('reset clears root channel', () => {
    const channel = createMockChannel('TestChannel', 0);
    channelState.registerChannel(channel, jest.fn(), jest.fn(), jest.fn());
    channelState.root(channel.__ui);
    
    channelState.reset();
    
    expect(channelState.root()).toBeUndefined();
  });

  test('reset can be called multiple times safely', () => {
    channelState.reset();
    channelState.reset();
    
    expect(channelState.root()).toBeUndefined();
  });
});
