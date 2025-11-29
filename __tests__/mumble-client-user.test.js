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

jest.unstable_mockModule('../app/utils/drop-stream.js', () => ({
  default: {
    obj: jest.fn(() => ({
      once: jest.fn(),
      pipe: jest.fn(),
      end: jest.fn()
    }))
  }
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

    for (const [prop, value] of properties) {
      test(`should prevent setting ${prop}`, () => {
        expect(() => {
          user[prop] = value;
        }).toThrow(/Cannot set/);
      });
    }

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
      user._update({ userId: 12345, actor: 1 });
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
      user._update({ selfMute: true, actor: 1 });
      expect(user.selfMute).toBe(true);
    });

    test('should update selfDeaf status', () => {
      user._update({ selfDeaf: true, actor: 1 });
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
      user._update({ textureHash: 'hash123', actor: 1 });

      expect(user.textureHash).toBe('hash123');
      expect(user._haveRequestedTexture).toBe(false);
    });

    test('should update comment', () => {
      user._update({ comment: 'User comment', actor: 1 });
      expect(user.comment).toBe('User comment');
    });

    test('should update comment hash and reset request flag', () => {
      user._haveRequestedComment = true;
      user._update({ commentHash: 'hash456', actor: 1 });

      expect(user.commentHash).toBe('hash456');
      expect(user._haveRequestedComment).toBe(false);
    });

    test('should update priority speaker status', () => {
      user._update({ prioritySpeaker: true, actor: 1 });
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
      user._update({ channelId: 1, actor: 1 });
      
      expect(user.channel).toBe(channel1);
      expect(channel1.users).toContain(user);
    });

    test('should handle channel change', () => {
      user._update({ channelId: 1, actor: 1 });
      expect(channel1.users).toContain(user);

      user._update({ channelId: 2, actor: 1 });
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
        channelId: 1,
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
      user._update({ channelId: 1, actor: 1 });
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
          channelId: 2
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
    test('should send UserState message with userId 0 to register', () => {
      user.register();

      expect(client._send).toHaveBeenCalledWith({
        name: 'UserState',
        payload: {
          session: 31,
          userId: 0
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

  describe('Voice Stream Management', () => {
    beforeEach(() => {
      // Setup codecs mock
      client._codecs = {
        createDecoderStream: jest.fn(() => ({
          once: jest.fn(),
          write: jest.fn(),
          end: jest.fn()
        })),
        getDuration: jest.fn(() => 20)
      };
    });

    test('_createVoiceCodecStream should create decoder stream when codecs available', () => {
      const stream = user._createVoiceCodecStream();
      expect(client._codecs.createDecoderStream).toHaveBeenCalledWith(user);
    });

    test('_getOrCreateVoiceStream should reuse existing stream', () => {
      const mockStream = { 
        once: jest.fn(), 
        write: jest.fn(), 
        end: jest.fn() 
      };
      user._voice = mockStream;
      
      const result = user._getOrCreateVoiceStream();
      expect(result).toBe(mockStream);
    });

    test('_getOrCreateVoiceStream should create new stream when none exists', () => {
      user._voice = null;
      const result = user._getOrCreateVoiceStream();
      expect(result).toBeDefined();
      expect(client._codecs.createDecoderStream).toHaveBeenCalled();
    });

    test('_getDuration should calculate total duration from frames', () => {
      const frames = [Buffer.from([1]), Buffer.from([2]), Buffer.from([3])];
      const duration = user._getDuration('Opus', frames);
      // 3 frames * 20ms each = 60
      expect(duration).toBe(60);
    });

    test('_handlePacketLoss should return false for late packets', () => {
      user._lastVoiceSeqId = 10;
      const result = user._handlePacketLoss(5, 20, 'Opus', 0, null);
      expect(result).toBe(false);
    });

    test('_handlePacketLoss should insert empty frames for lost packets', () => {
      user._lastVoiceSeqId = 5;
      user._voice = { write: jest.fn(), once: jest.fn(), end: jest.fn() };
      
      // seqNum 10 with lastSeqId 5 means we lost packets 6-9 (4 packets)
      const result = user._handlePacketLoss(10, 20, 'Opus', 0, null);
      
      expect(result).toBe(true);
    });

    test('_handlePacketLoss should cap lost frames at 10', () => {
      user._lastVoiceSeqId = 5;
      user._voice = { write: jest.fn(), once: jest.fn(), end: jest.fn() };
      
      // seqNum 100 would mean 94 lost packets, but should cap at 10
      user._handlePacketLoss(100, 20, 'Opus', 0, null);
      
      // Should have called write 10 times for empty frames
      expect(user._voice.write).toHaveBeenCalledTimes(10);
    });

    test('_insertEmptyFrames should write null frames', () => {
      user._voice = { write: jest.fn(), once: jest.fn(), end: jest.fn() };
      
      user._insertEmptyFrames(3, 'Opus', 0, { x: 1, y: 2, z: 3 });
      
      expect(user._voice.write).toHaveBeenCalledTimes(3);
      expect(user._voice.write).toHaveBeenCalledWith({
        target: 0,
        codec: 'Opus',
        frame: null,
        position: { x: 1, y: 2, z: 3 }
      });
    });

    test('_writeFrame should write frame to stream', () => {
      user._voice = { write: jest.fn(), once: jest.fn(), end: jest.fn() };
      const frame = Buffer.from([1, 2, 3]);
      
      user._writeFrame(frame, 'Opus', 0, null);
      
      expect(user._voice.write).toHaveBeenCalledWith({
        target: 0,
        codec: 'Opus',
        frame: frame,
        position: null
      });
    });

    test('_endVoiceTransmission should end and clean up stream', () => {
      const mockStream = { end: jest.fn() };
      const mockTimeout = { clear: jest.fn() };
      user._voice = mockStream;
      user._voiceTimeout = mockTimeout;
      
      user._endVoiceTransmission();
      
      expect(mockTimeout.clear).toHaveBeenCalled();
      expect(mockStream.end).toHaveBeenCalled();
      expect(user._voice).toBeNull();
      expect(user._voiceTimeout).toBeNull();
    });

    test('_endVoiceTransmission should handle no active stream', () => {
      user._voice = null;
      user._voiceTimeout = null;
      
      // Should not throw
      user._endVoiceTransmission();
      
      expect(user._voice).toBeNull();
    });
  });

  describe('_onVoice Method', () => {
    beforeEach(() => {
      client._codecs = {
        createDecoderStream: jest.fn(() => ({
          once: jest.fn(),
          write: jest.fn(),
          end: jest.fn()
        })),
        getDuration: jest.fn(() => 10)
      };
    });

    test('should write frames to voice stream', () => {
      const frames = [Buffer.from([1, 2, 3])];
      
      user._onVoice(0, 'Opus', 0, frames, null, false);
      
      // Voice stream should be created and written to
      expect(user._voice).toBeDefined();
    });

    test('should end transmission when end flag is true', () => {
      const frames = [Buffer.from([1, 2, 3])];
      user._voice = { write: jest.fn(), end: jest.fn() };
      user._voiceTimeout = { set: jest.fn(), clear: jest.fn() };
      
      user._onVoice(0, 'Opus', 0, frames, null, true);
      
      expect(user._voice).toBeNull();
    });

    test('should update lastVoiceSeqId after writing', () => {
      const frames = [Buffer.from([1])];
      client._codecs.getDuration = jest.fn(() => 20);
      
      user._onVoice(10, 'Opus', 0, frames, null, false);
      
      // seqNum + duration/10 - 1 = 10 + 20/10 - 1 = 11
      expect(user._lastVoiceSeqId).toBe(11);
    });

    test('should handle empty frames array with end flag', () => {
      user._voice = { end: jest.fn() };
      user._voiceTimeout = { clear: jest.fn() };
      
      user._onVoice(0, 'Opus', 0, [], null, true);
      
      expect(user._voice).toBeNull();
    });

    test('should drop late packets during ongoing transmission', () => {
      user._voice = { write: jest.fn(), once: jest.fn(), end: jest.fn() };
      user._voiceTimeout = { set: jest.fn(), clear: jest.fn() };
      user._lastVoiceSeqId = 100;
      
      const frames = [Buffer.from([1])];
      
      // Late packet (seqNum 50 < lastSeqId 100)
      user._onVoice(50, 'Opus', 0, frames, null, false);
      
      // Frame should not be written
      expect(user._voice.write).not.toHaveBeenCalled();
    });
  });

  describe('State Modification Methods', () => {
    test('setMute should send UserState with mute flag', () => {
      user.setMute(true);
      
      expect(client._send).toHaveBeenCalledWith({
        name: 'UserState',
        payload: {
          session: 31,
          mute: true
        }
      });
    });

    test('setMute(false) should also set deaf to false', () => {
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

    test('setDeaf should send UserState with deaf flag', () => {
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

    test('setDeaf(false) should not change mute', () => {
      user.setDeaf(false);
      
      expect(client._send).toHaveBeenCalledWith({
        name: 'UserState',
        payload: {
          session: 31,
          deaf: false
        }
      });
    });

    test('clearComment should send empty comment', () => {
      user.clearComment();
      
      expect(client._send).toHaveBeenCalledWith({
        name: 'UserState',
        payload: {
          session: 31,
          comment: ''
        }
      });
    });

    test('clearTexture should send empty texture', () => {
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
});
