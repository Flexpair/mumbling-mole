/**
 * Jest Unit Tests for mumble-client User
 * 
 * These tests validate the User class behavior:
 * - Property initialization and immutability
 * - User state updates (mute, deaf, channel changes)
 * - Voice stream management
 * - Texture and comment handling
 * - Event emission
 * 
 * Migrated from Mocha tests in vendors/mumble-client/test/user.js
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

jest.unstable_mockModule('drop-stream', () => ({
  default: {
    obj: jest.fn(() => ({
      once: jest.fn(),
      pipe: jest.fn(),
      end: jest.fn()
    }))
  }
}));

jest.unstable_mockModule('remove-value', () => ({
  default: jest.fn((array, value) => {
    if (array.includes(value)) {
      array.splice(array.indexOf(value), 1);
    }
  })
}));

jest.unstable_mockModule('rtimer', () => ({
  default: jest.fn((callback) => {
    return {
      set: jest.fn(function() { return this; }),
      clear: jest.fn()
    };
  })
}));

const User = (await import('../app/mumble-client/user.js')).default;

describe('mumble-client User', () => {
  let client;
  let user;
  let channel1, channel2;

  beforeEach(() => {
    channel1 = { _id: 1, users: [] };
    channel2 = { _id: 2, users: [] };
    client = {
      _channelById: { 1: channel1, 2: channel2 },
      _userById: {},
      _options: {},
      _send: jest.fn()
    };
    user = new User(client, 31);
  });

  describe('Constructor', () => {
    test('should initialize with client and id', () => {
      expect(user._client).toBe(client);
      expect(user._id).toBe(31);
    });

    test('should initialize request flags as false', () => {
      expect(user._haveRequestedTexture).toBe(false);
      expect(user._haveRequestedComment).toBe(false);
    });

    test('should get id property', () => {
      expect(user.id).toBe(31);
    });
  });

  describe('Property Getters', () => {
    test('should return undefined for unset properties', () => {
      expect(user.username).toBeUndefined();
      expect(user.channel).toBeNull(); // channel returns null when _channelId is not set
      expect(user.mute).toBeUndefined();
      expect(user.deaf).toBeUndefined();
    });

    test('should return channel object from _channelId', () => {
      user._channelId = 1;
      expect(user.channel).toBe(channel1);
    });
  });

  describe('Property Immutability', () => {
    const properties = [
      ['username', 'Test'],
      ['uniqueId', 123],
      ['mute', true],
      ['deaf', true],
      ['selfMute', true],
      ['selfDeaf', true],
      ['suppress', true],
      ['texture', '123'],
      ['textureHash', '123'],
      ['comment', '123'],
      ['commentHash', '123'],
      ['prioritySpeaker', true],
      ['recording', true],
      ['certHash', '123']
    ];

    properties.forEach(([prop, value]) => {
      test(`should prevent setting ${prop}`, () => {
        expect(() => {
          user[prop] = value;
        }).toThrow(/Cannot set/);
      });
    });

    test('should prevent setting channel directly', () => {
      expect(() => {
        user.channel = null;
      }).toThrow(/Cannot set/);
    });

    test('should prevent setting id', () => {
      expect(() => {
        user.id = 123;
      }).toThrow();
    });
  });

  describe('_update Method', () => {
    test('should update username and emit event', () => {
      const listener = jest.fn();
      user.on('update', listener);

      user._update({ name: 'TestUser', actor: 1 });

      expect(user.username).toBe('TestUser');
      expect(listener).toHaveBeenCalledWith(undefined, { username: 'TestUser' });
    });

    test('should update uniqueId', () => {
      user._update({ user_id: 12345, actor: 1 });
      expect(user.uniqueId).toBe(12345);
    });

    test('should update mute status', () => {
      user._update({ mute: true, actor: 1 });
      expect(user.mute).toBe(true);
    });

    test('should update deaf status', () => {
      user._update({ deaf: true, actor: 1 });
      expect(user.deaf).toBe(true);
    });

    test('should update selfMute status', () => {
      user._update({ self_mute: true, actor: 1 });
      expect(user.selfMute).toBe(true);
    });

    test('should update selfDeaf status', () => {
      user._update({ self_deaf: true, actor: 1 });
      expect(user.selfDeaf).toBe(true);
    });

    test('should update suppress status', () => {
      user._update({ suppress: true, actor: 1 });
      expect(user.suppress).toBe(true);
    });

    test('should update texture', () => {
      user._update({ texture: 'image_data', actor: 1 });
      expect(user.texture).toBe('image_data');
    });

    test('should update texture hash and reset request flag', () => {
      user._haveRequestedTexture = true;
      user._update({ texture_hash: 'hash123', actor: 1 });

      expect(user.textureHash).toBe('hash123');
      expect(user._haveRequestedTexture).toBe(false);
    });

    test('should update comment', () => {
      user._update({ comment: 'User comment', actor: 1 });
      expect(user.comment).toBe('User comment');
    });

    test('should update comment hash and reset request flag', () => {
      user._haveRequestedComment = true;
      user._update({ comment_hash: 'hash456', actor: 1 });

      expect(user.commentHash).toBe('hash456');
      expect(user._haveRequestedComment).toBe(false);
    });

    test('should update priority speaker status', () => {
      user._update({ priority_speaker: true, actor: 1 });
      expect(user.prioritySpeaker).toBe(true);
    });

    test('should update recording status', () => {
      user._update({ recording: true, actor: 1 });
      expect(user.recording).toBe(true);
    });

    test('should update cert hash', () => {
      user._update({ hash: 'cert_hash', actor: 1 });
      expect(user.certHash).toBe('cert_hash');
    });

    test('should update channel and adjust user arrays', () => {
      user._update({ channel_id: 1, actor: 1 });
      
      expect(user.channel).toBe(channel1);
      expect(channel1.users).toContain(user);
    });

    test('should handle channel change', () => {
      user._update({ channel_id: 1, actor: 1 });
      expect(channel1.users).toContain(user);

      user._update({ channel_id: 2, actor: 1 });
      expect(channel1.users).not.toContain(user);
      expect(channel2.users).toContain(user);
    });

    test('should include actor in update event', () => {
      const listener = jest.fn();
      user.on('update', listener);
      
      const actor = new User(client, 1);
      client._userById[1] = actor;

      user._update({ name: 'Test', actor: 1 });

      expect(listener).toHaveBeenCalledWith(actor, { username: 'Test' });
    });

    test('should update multiple properties at once', () => {
      const listener = jest.fn();
      user.on('update', listener);

      user._update({
        name: 'MultiUser',
        mute: true,
        deaf: true,
        channel_id: 1,
        actor: 1
      });

      expect(listener).toHaveBeenCalledWith(undefined, {
        username: 'MultiUser',
        mute: true,
        deaf: true,
        channel: channel1
      });
    });
  });

  describe('_remove Method', () => {
    test('should emit remove event with actor and reason', () => {
      const listener = jest.fn();
      user.on('remove', listener);

      const actor = new User(client, 1);
      user._remove(actor, 'Kicked', false);

      expect(listener).toHaveBeenCalledWith(actor, 'Kicked', false);
    });

    test('should remove user from channel', () => {
      user._update({ channel_id: 1, actor: 1 });
      expect(channel1.users).toContain(user);

      user._remove(null, 'Left', false);

      expect(channel1.users).not.toContain(user);
    });

    test('should handle ban flag', () => {
      const listener = jest.fn();
      user.on('remove', listener);

      user._remove(null, 'Banned', true);

      expect(listener).toHaveBeenCalledWith(null, 'Banned', true);
    });
  });

  describe('Voice Stream Management', () => {
    test('should use codec decoder when available', () => {
      const decoderStream = { once: jest.fn(), pipe: jest.fn() };
      client._codecs = {
        createDecoderStream: jest.fn(() => decoderStream)
      };

      const stream = user._getOrCreateVoiceStream();

      expect(client._codecs.createDecoderStream).toHaveBeenCalledWith(user);
      expect(stream).toBe(decoderStream);
    });
  });

  describe('setMute Method', () => {
    test('should send UserState message to mute user', () => {
      user.setMute(true);

      expect(client._send).toHaveBeenCalledWith({
        name: 'UserState',
        payload: {
          session: 31,
          mute: true
        }
      });
    });

    test('should clear deaf when unmuting', () => {
      user.setMute(false);

      expect(client._send).toHaveBeenCalledWith({
        name: 'UserState',
        payload: {
          session: 31,
          mute: false,
          deaf: false
        }
      });
    });
  });

  describe('setDeaf Method', () => {
    test('should send UserState message to deafen user', () => {
      user.setDeaf(true);

      expect(client._send).toHaveBeenCalledWith({
        name: 'UserState',
        payload: {
          session: 31,
          deaf: true,
          mute: true
        }
      });
    });
  });

  describe('clearComment Method', () => {
    test('should send UserState message with empty comment', () => {
      user.clearComment();

      expect(client._send).toHaveBeenCalledWith({
        name: 'UserState',
        payload: {
          session: 31,
          comment: ''
        }
      });
    });
  });

  describe('clearTexture Method', () => {
    test('should send UserState message with empty texture', () => {
      user.clearTexture();

      expect(client._send).toHaveBeenCalledWith({
        name: 'UserState',
        payload: {
          session: 31,
          texture: ''
        }
      });
    });
  });

  describe('requestTexture Method', () => {
    test('should request texture if not already requested', () => {
      user.requestTexture();

      expect(client._send).toHaveBeenCalledWith({
        name: 'RequestBlob',
        payload: {
          session_texture: 31
        }
      });
      expect(user._haveRequestedTexture).toBe(true);
    });

    test('should not request texture if already requested', () => {
      user._haveRequestedTexture = true;
      
      user.requestTexture();

      expect(client._send).not.toHaveBeenCalled();
    });
  });

  describe('requestComment Method', () => {
    test('should request comment if not already requested', () => {
      user.requestComment();

      expect(client._send).toHaveBeenCalledWith({
        name: 'RequestBlob',
        payload: {
          session_comment: 31
        }
      });
      expect(user._haveRequestedComment).toBe(true);
    });

    test('should not request comment if already requested', () => {
      user._haveRequestedComment = true;
      
      user.requestComment();

      expect(client._send).not.toHaveBeenCalled();
    });
  });

  describe('setChannel Method', () => {
    test('should send UserState message with new channel', () => {
      user.setChannel(channel2);

      expect(client._send).toHaveBeenCalledWith({
        name: 'UserState',
        payload: {
          session: 31,
          channel_id: 2
        }
      });
    });
  });

  describe('sendMessage Method', () => {
    test('should send TextMessage to user', () => {
      user.sendMessage('Hello User');

      expect(client._send).toHaveBeenCalledWith({
        name: 'TextMessage',
        payload: {
          session: 31,
          message: 'Hello User'
        }
      });
    });
  });

  describe('register Method', () => {
    test('should send UserState message with user_id 0 to register', () => {
      user.register();

      expect(client._send).toHaveBeenCalledWith({
        name: 'UserState',
        payload: {
          session: 31,
          user_id: 0
        }
      });
    });
  });

  describe('Event Handling', () => {
    test('should support event listeners', () => {
      const updateListener = jest.fn();
      const removeListener = jest.fn();

      user.on('update', updateListener);
      user.on('remove', removeListener);

      user._update({ name: 'Test', actor: 1 });
      user._remove(null, 'Left', false);

      expect(updateListener).toHaveBeenCalledTimes(1);
      expect(removeListener).toHaveBeenCalledTimes(1);
    });

    test('should support removing event listeners', () => {
      const listener = jest.fn();
      user.on('update', listener);
      user.off('update', listener);

      user._update({ name: 'Test', actor: 1 });

      expect(listener).not.toHaveBeenCalled();
    });
  });
});
