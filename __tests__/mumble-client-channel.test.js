/**
 * Jest Unit Tests for mumble-client Channel
 * 
 * These tests validate the Channel class behavior:
 * - Property initialization and immutability
 * - Channel updates and event emission
 * - Parent-child relationships
 * - Link management
 * - Methods for setting channel properties
 * 
 * Migrated from Mocha tests in vendors/mumble-client/test/channel.js
 */

import { jest } from '@jest/globals';

// Mock dependencies before imports
jest.unstable_mockModule('node:events', () => ({
  EventEmitter: class MockEventEmitter {
    constructor() {
      this._events = {};
    }
    on(event, listener) {
      if (!this._events[event]) this._events[event] = [];
      this._events[event].push(listener);
      return this;
    }
    once(event, listener) {
      const wrapper = (...args) => {
        this.off(event, wrapper);
        listener(...args);
      };
      return this.on(event, wrapper);
    }
    off(event, listener) {
      if (!this._events[event]) return this;
      this._events[event] = this._events[event].filter(l => l !== listener);
      return this;
    }
    emit(event, ...args) {
      if (!this._events[event]) return false;
      for (const listener of this._events[event]) {
        listener(...args);
      }
      return true;
    }
  }
}));

const Channel = (await import('../app/mumble-client/channel.js')).default;

describe('mumble-client Channel', () => {
  let channel1, channel2, channel3, channel4;
  let client;
  let channel;

  beforeEach(() => {
    channel1 = { _id: 1, children: [] };
    channel2 = { _id: 2, children: [] };
    channel3 = { _id: 3, children: [] };
    channel4 = { _id: 4, children: [] };
    client = {
      _channelById: { 1: channel1, 2: channel2, 3: channel3, 4: channel4 },
      _send: jest.fn()
    };
    channel = new Channel(client, 1); // Arbitrary test channel ID
  });

  describe('Constructor', () => {
    test('should initialize with client and id', () => {
      expect(channel._client).toBe(client);
      expect(channel._id).toBe(1);
    });

    test('should have users array', () => {
      expect(channel.users).toEqual([]);
      expect(Array.isArray(channel.users)).toBe(true);
    });

    test('should have children array', () => {
      expect(channel.children).toEqual([]);
      expect(Array.isArray(channel.children)).toBe(true);
    });

    test('should initialize with empty links', () => {
      expect(channel._links).toEqual([]);
    });

    test('should initialize description request flag as false', () => {
      expect(channel._haveRequestedDescription).toBe(false);
    });
  });

  describe('Property Getters', () => {
    test('should get id', () => {
      expect(channel.id).toBe(1);
    });

    test('should return undefined for unset properties', () => {
      expect(channel.name).toBeUndefined();
      expect(channel.description).toBeUndefined();
      expect(channel.position).toBeUndefined();
    });
  });

  describe('Property Immutability', () => {
    const properties = [
      ['name', '123'],
      ['description', '123'],
      ['descriptionHash', '123'],
      ['temporary', true],
      ['position', 123],
      ['maxUsers', 123]
    ];

    for (const [prop, value] of properties) {
      test(`should prevent setting ${prop}`, () => {
        expect(() => {
          channel[prop] = value;
        }).toThrow();
      });
    }

    test('should prevent setting parent directly', () => {
      expect(() => {
        channel.parent = channel2;
      }).toThrow();
    });

    test('should prevent setting links directly', () => {
      expect(() => {
        channel.links = [];
      }).toThrow();
    });

    test('should prevent setting id', () => {
      expect(() => {
        channel.id = 123;
      }).toThrow();
    });
  });

  describe('_update Method', () => {
    test('should update name and emit event', () => {
      const listener = jest.fn();
      channel.on('update', listener);

      channel._update({ name: 'Test Channel' });

      expect(channel.name).toBe('Test Channel');
      expect(listener).toHaveBeenCalledWith({ name: 'Test Channel' });
    });

    test('should update description', () => {
      const listener = jest.fn();
      channel.on('update', listener);

      channel._update({ description: 'Test Description' });

      expect(channel.description).toBe('Test Description');
      expect(listener).toHaveBeenCalledWith({ description: 'Test Description' });
    });

    test('should update description hash and reset request flag', () => {
      channel._haveRequestedDescription = true;
      channel._update({ description_hash: 'hash123' });

      expect(channel.descriptionHash).toBe('hash123');
      expect(channel._haveRequestedDescription).toBe(false);
    });

    test('should update temporary flag', () => {
      channel._update({ temporary: true });
      expect(channel.temporary).toBe(true);
    });

    test('should update position', () => {
      channel._update({ position: 5 });
      expect(channel.position).toBe(5);
    });

    test('should update maxUsers', () => {
      channel._update({ max_users: 10 });
      expect(channel.maxUsers).toBe(10);
    });

    test('should update parent and adjust children arrays', () => {
      channel._update({ parent: 1 });
      
      expect(channel.parent).toBe(channel1);
      expect(channel1.children).toContain(channel);
    });

    test('should handle parent change', () => {
      channel._update({ parent: 1 });
      expect(channel1.children).toContain(channel);

      channel._update({ parent: 2 });
      expect(channel1.children).not.toContain(channel);
      expect(channel2.children).toContain(channel);
    });

    test('should update multiple properties at once', () => {
      const listener = jest.fn();
      channel.on('update', listener);

      channel._update({
        name: 'Multi',
        description: 'Multiple updates',
        position: 3,
        temporary: false
      });

      expect(listener).toHaveBeenCalledWith({
        name: 'Multi',
        description: 'Multiple updates',
        position: 3,
        temporary: false
      });
    });
  });

  describe('Links Management', () => {
    test('should set links completely with links property', () => {
      const listener = jest.fn();
      channel.on('update', listener);

      channel._update({ links: [1, 2, 3] });

      expect(channel._links).toEqual([1, 2, 3]);
      expect(channel.links).toEqual([channel1, channel2, channel3]);
      expect(listener).toHaveBeenCalledWith({ 
        links: [channel1, channel2, channel3] 
      });
    });

    test('should remove links with links_remove', () => {
      channel._links = [1, 2, 3, 4];
      channel._update({ links_remove: [2, 4] });

      expect(channel._links).toEqual([1, 3]);
      expect(channel.links).toEqual([channel1, channel3]);
    });

    test('should add links with links_add', () => {
      channel._links = [1];
      channel._update({ links_add: [2, 3] });

      expect(channel._links).toEqual([1, 2, 3]);
      expect(channel.links).toEqual([channel1, channel2, channel3]);
    });

    test('should not add duplicate links', () => {
      channel._links = [1, 2];
      channel._update({ links_add: [2, 3] });

      expect(channel._links).toEqual([1, 2, 3]);
    });

    test('should handle links with undefined channels', () => {
      channel._links = [1, 999];
      expect(channel.links).toEqual([channel1, undefined]);
    });
  });

  describe('requestDescription Method', () => {
    test('should request description if not already requested', () => {
      channel.requestDescription();

      expect(client._send).toHaveBeenCalledWith({
        name: 'RequestBlob',
        payload: {
          channel_description: 1
        }
      });
      expect(channel._haveRequestedDescription).toBe(true);
    });

    test('should not request description if already requested', () => {
      channel._haveRequestedDescription = true;
      
      channel.requestDescription();

      expect(client._send).not.toHaveBeenCalled();
    });
  });

  describe('sendMessage Method', () => {
    test('should send TextMessage to channel', () => {
      channel.sendMessage('Hello Channel');

      expect(client._send).toHaveBeenCalledWith({
        name: 'TextMessage',
        payload: {
          channelId: [1], // Arbitrary test channel ID
          message: 'Hello Channel'
        }
      });
    });
  });

  describe('sendTreeMessage Method', () => {
    test('should send TextMessage to channel tree', () => {
      channel.sendTreeMessage('Hello Tree');

      expect(client._send).toHaveBeenCalledWith({
        name: 'TextMessage',
        payload: {
          treeId: [1], // Arbitrary test channel ID
          message: 'Hello Tree'
        }
      });
    });
  });

  describe('_remove Method', () => {
    test('should emit remove event', () => {
      const listener = jest.fn();
      channel.on('remove', listener);

      channel._remove();

      expect(listener).toHaveBeenCalled();
    });

    test('should remove from parent children array', () => {
      channel._update({ parent: 1 });
      expect(channel1.children).toContain(channel);

      channel._remove();

      expect(channel1.children).not.toContain(channel);
    });

    test('should handle removal without parent', () => {
      expect(() => {
        channel._remove();
      }).not.toThrow();
    });
  });

  describe('Event Handling', () => {
    test('should support event listeners', () => {
      const updateListener = jest.fn();
      const removeListener = jest.fn();

      channel.on('update', updateListener);
      channel.on('remove', removeListener);

      channel._update({ name: 'Test' });
      channel._remove();

      expect(updateListener).toHaveBeenCalledTimes(1);
      expect(removeListener).toHaveBeenCalledTimes(1);
    });

    test('should support removing event listeners', () => {
      const listener = jest.fn();
      channel.on('update', listener);
      channel.off('update', listener);

      channel._update({ name: 'Test' });

      expect(listener).not.toHaveBeenCalled();
    });
  });
});
