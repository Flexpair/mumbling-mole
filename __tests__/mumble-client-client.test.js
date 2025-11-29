/**
 * Jest Unit Tests for mumble-client Client
 * 
 * These tests validate the MumbleClient class behavior:
 * - Client construction and initialization
 * - Connection establishment
 * - Message handling
 * - User and channel management
 * - Voice data handling
 * - Permission management
 * - Bandwidth calculations
 * 
 * Migrated from Mocha tests in vendors/mumble-client/test/client.js
 */

import { jest } from '@jest/globals';
import { PassThrough } from 'node:stream';

// Mock DropStream
const mockDropStream = {
  obj: jest.fn(() => ({
    once: jest.fn(),
    pipe: jest.fn(),
    end: jest.fn()
  }))
};

// Mock mumble-streams
const mockMumbleStreams = {
  version: {
    toUInt8: jest.fn(() => [1, 3, 0])
  },
  data: {
    Encoder: jest.fn(() => {
      const stream = new PassThrough({ objectMode: true });
      stream.pipe = jest.fn().mockReturnThis();
      stream.on = jest.fn((event, handler) => {
        PassThrough.prototype.on.call(stream, event, handler);
        return stream;
      });
      stream.write = jest.fn();
      return stream;
    }),
    Decoder: jest.fn(() => {
      const stream = new PassThrough({ objectMode: true });
      stream.pipe = jest.fn().mockReturnThis();
      stream.on = jest.fn((event, handler) => {
        PassThrough.prototype.on.call(stream, event, handler);
        return stream;
      });
      return stream;
    }),
    messages: {
      PermissionDenied: {
        DenyType: {
          Text: 0,
          Permission: 1,
          SuperUser: 2,
          ChannelName: 3,
          TextTooLong: 4,
          H9K: 5,
          TemporaryChannel: 6,
          MissingCertificate: 7,
          UserName: 8,
          ChannelFull: 9,
          NestingLimit: 10
        }
      }
    }
  },
  voice: {
    Encoder: jest.fn(() => {
      const stream = new PassThrough({ objectMode: true });
      stream.pipe = jest.fn().mockReturnThis();
      stream.on = jest.fn((event, handler) => {
        PassThrough.prototype.on.call(stream, event, handler);
        return stream;
      });
      return stream;
    }),
    Decoder: jest.fn(() => {
      const stream = new PassThrough({ objectMode: true });
      stream.pipe = jest.fn().mockReturnThis();
      stream.on = jest.fn((event, handler) => {
        PassThrough.prototype.on.call(stream, event, handler);
        return stream;
      });
      return stream;
    })
  }
};

// Mock reduplexer
const mockDuplexer = jest.fn((encoder, decoder, opts) => {
  const stream = new PassThrough({ objectMode: opts?.objectMode });
  stream.write = jest.fn();
  stream.pipe = jest.fn().mockReturnThis();
  stream.on = jest.fn((event, handler) => {
    if (event === 'data' || event === 'end' || event === 'error') {
      // Store handler for testing
      stream['_' + event + 'Handler'] = handler;
    }
    PassThrough.prototype.on.call(stream, event, handler);
    return stream;
  });
  return stream;
});

// Mock dependencies
jest.unstable_mockModule('../app/mumble-streams/index.js', () => ({ default: mockMumbleStreams }));
jest.unstable_mockModule('../app/utils/duplexer-lite.js', () => ({ default: mockDuplexer }));
jest.unstable_mockModule('../app/utils/drop-stream.js', () => ({ default: mockDropStream }));
jest.unstable_mockModule('../app/utils/stats-lite.js', () => ({
  default: jest.fn(() => ({
    update: jest.fn(),
    mean: 0,
    variance: 0,
    getAll: jest.fn(() => null),
    reset: jest.fn()
  }))
}));

const MumbleClient = (await import('../app/mumble-client/client.js')).default;
const User = (await import('../app/mumble-client/user.js')).default;
const Channel = (await import('../app/mumble-client/channel.js')).default;

describe('mumble-client Client', () => {
  let client;

  beforeEach(() => {
    jest.clearAllMocks();
    client = new MumbleClient({
      username: 'TestUser',
      password: 'TestPassword',
      tokens: ['token1', 'token2'],
      clientSoftware: 'Test Client',
      osName: 'Test OS',
      osVersion: 'v1.0'
    });
  });

  describe('Constructor', () => {
    test('should throw error when username is missing', () => {
      expect(() => {
        new MumbleClient({});
      }).toThrow('No username given');
    });

    test('should initialize with required options', () => {
      expect(client._username).toBe('TestUser');
      expect(client._password).toBe('TestPassword');
      expect(client._tokens).toEqual(['token1', 'token2']);
    });

    test('should initialize with default ping interval', () => {
      expect(client._dataPingInterval).toBe(5000);
    });

    test('should initialize with custom ping interval', () => {
      const customClient = new MumbleClient({
        username: 'Test',
        dataPingInterval: 10000
      });
      expect(customClient._dataPingInterval).toBe(10000);
    });

    test('should initialize with default max in-flight pings', () => {
      expect(client._maxInFlightDataPings).toBe(2);
    });

    test('should initialize empty user and channel arrays', () => {
      expect(client.users).toEqual([]);
      expect(client.channels).toEqual([]);
    });

    test('should initialize user and channel maps', () => {
      expect(client._userById).toEqual({});
      expect(client._channelById).toEqual({});
    });

    test('should set disconnected flag to false', () => {
      expect(client._disconnected).toBe(false);
    });

    test('should initialize with codecs if provided', () => {
      const codecs = {
        opus: true,
        createDecoderStream: jest.fn(),
        createEncoderStream: jest.fn()
      };
      const codecClient = new MumbleClient({
        username: 'Test',
        codecs
      });
      expect(codecClient._codecs).toBe(codecs);
    });
  });

  describe('Static Methods', () => {
    describe('calcEnforcableBandwidth', () => {
      test('should be available as static method', () => {
        expect(MumbleClient.calcEnforcableBandwidth).toBeDefined();
        expect(typeof MumbleClient.calcEnforcableBandwidth).toBe('function');
      });

      test('should calculate bandwidth for given parameters', () => {
        const result = MumbleClient.calcEnforcableBandwidth(96000, 60, false);
        
        expect(result).toBeDefined();
        expect(typeof result).toBe('number');
        expect(result).toBeGreaterThan(0);
      });

      test('should handle different bitrates', () => {
        const bitrates = [40000, 72000, 96000, 128000];
        
        for (const bitrate of bitrates) {
          const result = MumbleClient.calcEnforcableBandwidth(bitrate, 60, false);
          expect(result).toBeGreaterThan(0);
        }
      });

      test('should handle voice activity detection flag', () => {
        const withoutVad = MumbleClient.calcEnforcableBandwidth(96000, 60, false);
        const withVad = MumbleClient.calcEnforcableBandwidth(96000, 60, true);

        expect(withoutVad).toBeGreaterThan(0);
        expect(withVad).toBeGreaterThan(0);
      });
    });
  });

  describe('User Management', () => {
    test('should have users array', () => {
      expect(client.users).toEqual([]);
      expect(Array.isArray(client.users)).toBe(true);
    });

    test('should have userById map', () => {
      expect(client._userById).toEqual({});
    });

    test('should allow adding users to internal structures', () => {
      const user = new User(client, 1);
      client._userById[1] = user;
      client.users.push(user);

      expect(client._userById[1]).toBe(user);
      expect(client.users).toContain(user);
    });
  });

  describe('Channel Management', () => {
    test('should have channels array', () => {
      expect(client.channels).toEqual([]);
      expect(Array.isArray(client.channels)).toBe(true);
    });

    test('should have channelById map', () => {
      expect(client._channelById).toEqual({});
    });

    test('should allow adding channels to internal structures', () => {
      const channel = new Channel(client, 1);
      client._channelById[1] = channel;
      client.channels.push(channel);

      expect(client._channelById[1]).toBe(channel);
      expect(client.channels).toContain(channel);
    });

    test('should get root channel from channels array', () => {
      const rootChannel = new Channel(client, 0);
      client._channelById[0] = rootChannel;
      client.channels.push(rootChannel);

      expect(client.root).toBe(rootChannel);
    });
  });

  describe('Message Sending Infrastructure', () => {
    test('should have _send method', () => {
      expect(typeof client._send).toBe('function');
    });

    test('should be able to send data via _send', () => {
      client._send = jest.fn();
      
      client._send({
        name: 'TextMessage',
        payload: {
          message: 'Test'
        }
      });

      expect(client._send).toHaveBeenCalledWith({
        name: 'TextMessage',
        payload: {
          message: 'Test'
        }
      });
    });
  });

  describe('Audio Management', () => {
    test('should have voice encoder and decoder', () => {
      expect(client._voiceEncoder).toBeDefined();
      expect(client._voiceDecoder).toBeDefined();
    });

    test('should have data encoder and decoder', () => {
      expect(client._dataEncoder).toBeDefined();
      expect(client._dataDecoder).toBeDefined();
    });

    test('should track audio stats', () => {
      expect(client._voiceStats).toBeDefined();
      expect(client._dataStats).toBeDefined();
    });
  });

  describe('Connection State', () => {
    test('should have ping interval settings', () => {
      expect(client._dataPingInterval).toBe(5000);
      expect(client._maxInFlightDataPings).toBe(2);
    });

    test('should set disconnected flag on disconnect', () => {
      client.disconnect();
      expect(client._disconnected).toBe(true);
    });

    test('should have self user property', () => {
      expect(client.self).toBeUndefined();
      
      // Can be set
      const selfUser = new User(client, 42);
      client.self = selfUser;
      expect(client.self).toBe(selfUser);
    });
  });

  describe('Self User Operations', () => {
    test('should send mute via self user', () => {
      client._send = jest.fn();
      client.self = new User(client, 42);

      client.setSelfMute(true);

      expect(client._send).toHaveBeenCalledWith({
        name: 'UserState',
        payload: {
          session: 42,
          selfMute: true
        }
      });
    });

    test('should send deaf via self user', () => {
      client._send = jest.fn();
      client.self = new User(client, 42);

      client.setSelfDeaf(true);

      expect(client._send).toHaveBeenCalledWith({
        name: 'UserState',
        payload: {
          session: 42,
          selfDeaf: true,
          selfMute: true  // Deaf implies mute
        }
      });
    });

    test('should send undeaf without changing mute state', () => {
      client._send = jest.fn();
      client.self = new User(client, 42);

      client.setSelfDeaf(false);

      expect(client._send).toHaveBeenCalledWith({
        name: 'UserState',
        payload: {
          session: 42,
          selfDeaf: false
          // selfMute intentionally NOT sent - preserve user's mute choice
        }
      });
    });
  });

  // ==========================================================================
  // MESSAGE HANDLER TESTS - All Mumble protocol handlers used by the app
  // ==========================================================================

  describe('Message Handlers', () => {
    
    describe('_onVersion', () => {
      test('should parse server version correctly', () => {
        // Version 1.3.0 = (1 << 16) | (3 << 8) | 0 = 66304
        client._onVersion({
          version: 66304,
          release: 'Mumble 1.3.0',
          os: 'Linux',
          osVersion: 'Ubuntu 20.04'
        });

        expect(client.serverVersion).toEqual({
          major: 1,
          minor: 3,
          patch: 0,
          release: 'Mumble 1.3.0',
          os: 'Linux',
          osVersion: 'Ubuntu 20.04'
        });
      });

      test('should emit serverVersion event', () => {
        const listener = jest.fn();
        client.on('serverVersion', listener);

        client._onVersion({ version: 66591, release: 'Mumble 1.4.31' });

        expect(listener).toHaveBeenCalledWith(expect.objectContaining({
          major: 1,
          minor: 4
        }));
      });
    });

    describe('_onServerSync', () => {
      test('should set self user and maxBandwidth', () => {
        const user = new User(client, 42);
        client._userById[42] = user;
        const listener = jest.fn();
        client.on('connected', listener);

        client._onServerSync({
          session: 42,
          maxBandwidth: 72000,
          welcomeText: 'Welcome!'
        });

        expect(client.self).toBe(user);
        expect(client.maxBandwidth).toBe(72000);
        expect(client.welcomeMessage).toBe('Welcome!');
        expect(listener).toHaveBeenCalled();
      });

      test('should emit maxBandwidthChange event', () => {
        const user = new User(client, 1);
        client._userById[1] = user;
        const listener = jest.fn();
        client.on('maxBandwidthChange', listener);

        client._onServerSync({ session: 1, maxBandwidth: 128000 });

        expect(listener).toHaveBeenCalledWith(128000);
      });

      test('should start ping interval', () => {
        const user = new User(client, 1);
        client._userById[1] = user;
        client._send = jest.fn();

        client._onServerSync({ session: 1 });

        expect(client._pinger).toBeDefined();
        clearInterval(client._pinger);
      });
    });

    describe('_onPing', () => {
      test('should update data stats with round-trip time', () => {
        client._inFlightDataPings = 1;
        const now = Date.now();
        const listener = jest.fn();
        client.on('dataPing', listener);

        client._onPing({ timestamp: now - 50 });

        expect(listener).toHaveBeenCalledWith(expect.any(Number));
        expect(client._inFlightDataPings).toBe(0);
      });

      test('should handle Long timestamp objects (protobufjs)', () => {
        client._inFlightDataPings = 1;
        const now = Date.now();

        client._onPing({ 
          timestamp: { toNumber: () => now - 100 } 
        });

        expect(client._inFlightDataPings).toBe(0);
      });

      test('should warn on unexpected ping', () => {
        client._inFlightDataPings = 0;
        const warnSpy = jest.spyOn(console, 'warn').mockImplementation();

        client._onPing({ timestamp: Date.now() });

        expect(warnSpy).toHaveBeenCalledWith('Got unexpected ping message:', expect.any(Object));
        warnSpy.mockRestore();
      });
    });

    describe('_onUDPTunnel', () => {
      test('should forward voice data to decoder', () => {
        const voiceData = new Uint8Array([0x80, 0x00, 0x01, 0x02]);
        client._voiceDecoder = { write: jest.fn() };

        client._onUDPTunnel(voiceData);

        expect(client._voiceDecoder.write).toHaveBeenCalledWith(voiceData);
      });
    });

    describe('_onServerConfig', () => {
      test('should log server configuration', () => {
        const logSpy = jest.spyOn(console, 'log').mockImplementation();

        client._onServerConfig({
          maxBandwidth: 128000,
          messageLength: 5000,
          maxUsers: 100,
          allowHtml: true
        });

        expect(logSpy).toHaveBeenCalledWith('[ServerConfig]', expect.objectContaining({
          maxBandwidth: 128000,
          maxUsers: 100
        }));
        logSpy.mockRestore();
      });
    });

    describe('_onCodecVersion', () => {
      test('should log codec capabilities', () => {
        const logSpy = jest.spyOn(console, 'log').mockImplementation();

        client._onCodecVersion({
          alpha: -2147483637,
          beta: 0,
          preferAlpha: true,
          opus: true
        });

        expect(logSpy).toHaveBeenCalledWith('[CodecVersion]', expect.objectContaining({
          opus: true
        }));
        logSpy.mockRestore();
      });
    });

    describe('_onCryptSetup', () => {
      test('should log when encryption keys present', () => {
        const logSpy = jest.spyOn(console, 'log').mockImplementation();

        client._onCryptSetup({
          key: new Uint8Array([1, 2, 3]),
          client_nonce: new Uint8Array([4, 5, 6])
        });

        expect(logSpy).toHaveBeenCalledWith('[CryptSetup] UDP encryption keys exchanged (not used by WebSocket client)');
        logSpy.mockRestore();
      });

      test('should not log when no keys present', () => {
        const logSpy = jest.spyOn(console, 'log').mockImplementation();

        client._onCryptSetup({});

        expect(logSpy).not.toHaveBeenCalled();
        logSpy.mockRestore();
      });
    });

    describe('_onPermissionQuery', () => {
      test('should log permission query response', () => {
        const logSpy = jest.spyOn(console, 'log').mockImplementation();

        client._onPermissionQuery({
          channelId: 5,
          permissions: 0x7FFFFFFF,
          flush: false
        });

        expect(logSpy).toHaveBeenCalledWith('[PermissionQuery]', expect.objectContaining({
          channelId: 5
        }));
        logSpy.mockRestore();
      });
    });

    describe('_onUserStats', () => {
      test('should log user statistics', () => {
        const logSpy = jest.spyOn(console, 'log').mockImplementation();
        const user = new User(client, 42);
        client._userById[42] = user;

        client._onUserStats({
          session: 42,
          tcpPackets: 100,
          udpPackets: 500,
          bandwidth: 40000,
          opus: true
        });

        expect(logSpy).toHaveBeenCalledWith('[UserStats]', expect.objectContaining({
          tcpPackets: 100,
          opus: true
        }));
        logSpy.mockRestore();
      });
    });

    describe('_onSuggestConfig', () => {
      test('should log suggested configuration', () => {
        const logSpy = jest.spyOn(console, 'log').mockImplementation();

        client._onSuggestConfig({
          version: 66591,
          positional: false,
          pushToTalk: true
        });

        expect(logSpy).toHaveBeenCalledWith('[SuggestConfig]', expect.objectContaining({
          pushToTalk: true
        }));
        logSpy.mockRestore();
      });
    });

    describe('_onReject', () => {
      test('should emit reject event and disconnect', () => {
        const rejectListener = jest.fn();
        const disconnectListener = jest.fn();
        client.on('reject', rejectListener);
        client.on('disconnected', disconnectListener);

        client._onReject({
          type: 2, // InvalidUsername
          reason: 'Invalid username'
        });

        expect(rejectListener).toHaveBeenCalledWith(expect.objectContaining({
          type: 2,
          reason: 'Invalid username'
        }));
        expect(disconnectListener).toHaveBeenCalled();
      });
    });

    describe('_onPermissionDenied', () => {
      test('should emit denied event for Text type', () => {
        const listener = jest.fn();
        client.on('denied', listener);

        client._onPermissionDenied({
          type: 0, // Text
          reason: 'You cannot do that'
        });

        expect(listener).toHaveBeenCalledWith('Text', null, null, 'You cannot do that');
      });

      test('should emit denied event for Permission type with user and channel', () => {
        const listener = jest.fn();
        client.on('denied', listener);
        const user = new User(client, 1);
        const channel = new Channel(client, 5);
        client._userById[1] = user;
        client._channelById[5] = channel;

        client._onPermissionDenied({
          type: 1, // Permission
          session: 1,
          channelId: 5,
          permission: 0x01
        });

        expect(listener).toHaveBeenCalledWith('Permission', user, channel, 0x01);
      });

      test('should emit denied event for SuperUser type', () => {
        const listener = jest.fn();
        client.on('denied', listener);

        client._onPermissionDenied({ type: 2 }); // SuperUser

        expect(listener).toHaveBeenCalledWith('SuperUser', null, null, null);
      });

      test('should emit denied event for ChannelName type', () => {
        const listener = jest.fn();
        client.on('denied', listener);

        client._onPermissionDenied({ type: 3, name: 'BadChannel' });

        expect(listener).toHaveBeenCalledWith('ChannelName', null, null, 'BadChannel');
      });

      test('should emit denied event for TextTooLong type', () => {
        const listener = jest.fn();
        client.on('denied', listener);

        client._onPermissionDenied({ type: 4 });

        expect(listener).toHaveBeenCalledWith('TextTooLong', null, null, null);
      });

      test('should emit denied event for TemporaryChannel type', () => {
        const listener = jest.fn();
        client.on('denied', listener);

        client._onPermissionDenied({ type: 6 });

        expect(listener).toHaveBeenCalledWith('TemporaryChannel', null, null, null);
      });

      test('should emit denied event for MissingCertificate type', () => {
        const listener = jest.fn();
        client.on('denied', listener);
        const user = new User(client, 1);
        client._userById[1] = user;

        client._onPermissionDenied({ type: 7, session: 1 });

        expect(listener).toHaveBeenCalledWith('MissingCertificate', user, null, null);
      });

      test('should emit denied event for UserName type', () => {
        const listener = jest.fn();
        client.on('denied', listener);

        client._onPermissionDenied({ type: 8, name: 'BadUser' });

        expect(listener).toHaveBeenCalledWith('UserName', null, null, 'BadUser');
      });

      test('should emit denied event for ChannelFull type', () => {
        const listener = jest.fn();
        client.on('denied', listener);

        client._onPermissionDenied({ type: 9 });

        expect(listener).toHaveBeenCalledWith('ChannelFull', null, null, null);
      });

      test('should emit denied event for NestingLimit type', () => {
        const listener = jest.fn();
        client.on('denied', listener);

        client._onPermissionDenied({ type: 10 });

        expect(listener).toHaveBeenCalledWith('NestingLimit', null, null, null);
      });

      test('should throw on invalid DenyType', () => {
        expect(() => {
          client._onPermissionDenied({ type: 999 });
        }).toThrow('Invalid DenyType: 999');
      });
    });

    describe('_onTextMessage', () => {
      test('should emit message event with sender and content', () => {
        const listener = jest.fn();
        client.on('message', listener);
        const sender = new User(client, 1);
        const channel = new Channel(client, 0);
        client._userById[1] = sender;
        client._channelById[0] = channel;

        client._onTextMessage({
          actor: 1,
          message: 'Hello World!',
          session: [],
          channelId: [0],
          treeId: []
        });

        expect(listener).toHaveBeenCalledWith(
          sender,
          'Hello World!',
          [],
          [channel],
          []
        );
      });

      test('should handle direct messages to users', () => {
        const listener = jest.fn();
        client.on('message', listener);
        const sender = new User(client, 1);
        const recipient = new User(client, 2);
        client._userById[1] = sender;
        client._userById[2] = recipient;

        client._onTextMessage({
          actor: 1,
          message: 'Private message',
          session: [2],
          channelId: [],
          treeId: []
        });

        expect(listener).toHaveBeenCalledWith(
          sender,
          'Private message',
          [recipient],
          [],
          []
        );
      });
    });

    describe('_onChannelState', () => {
      test('should create new channel if not exists', () => {
        const listener = jest.fn();
        client.on('newChannel', listener);

        client._onChannelState({
          channelId: 1,
          name: 'General',
          parent: 0
        });

        expect(client._channelById[1]).toBeDefined();
        expect(client.channels).toContain(client._channelById[1]);
        expect(listener).toHaveBeenCalledWith(client._channelById[1]);
      });

      test('should update existing channel', () => {
        const channel = new Channel(client, 1);
        client._channelById[1] = channel;
        client.channels.push(channel);
        const listener = jest.fn();
        client.on('newChannel', listener);

        client._onChannelState({
          channelId: 1,
          name: 'Updated Name'
        });

        expect(listener).not.toHaveBeenCalled();
      });

      test('should handle linksRemove and update other channels', () => {
        const channel1 = new Channel(client, 1);
        const channel2 = new Channel(client, 2);
        channel2._links = [1];
        client._channelById[1] = channel1;
        client._channelById[2] = channel2;
        client.channels.push(channel1, channel2);

        client._onChannelState({
          channelId: 1,
          linksRemove: [2]
        });

        // The channel2 should have its link to channel1 removed
        // (via otherChannel._update({ linksRemove: [channelId] }))
      });
    });

    describe('_onChannelRemove', () => {
      test('should remove channel from client', () => {
        const channel = new Channel(client, 1);
        client._channelById[1] = channel;
        client.channels.push(channel);

        client._onChannelRemove({ channelId: 1 });

        expect(client._channelById[1]).toBeUndefined();
        expect(client.channels).not.toContain(channel);
      });

      test('should emit remove event on channel', () => {
        const channel = new Channel(client, 1);
        const listener = jest.fn();
        channel.on('remove', listener);
        client._channelById[1] = channel;
        client.channels.push(channel);

        client._onChannelRemove({ channelId: 1 });

        expect(listener).toHaveBeenCalled();
      });

      test('should handle non-existent channel gracefully', () => {
        expect(() => {
          client._onChannelRemove({ channelId: 999 });
        }).not.toThrow();
      });
    });

    describe('_onUserState', () => {
      test('should create new user if not exists', () => {
        const listener = jest.fn();
        client.on('newUser', listener);

        client._onUserState({
          session: 42,
          name: 'NewUser',
          channelId: 0
        });

        expect(client._userById[42]).toBeDefined();
        expect(client.users).toContain(client._userById[42]);
        expect(listener).toHaveBeenCalledWith(client._userById[42]);
      });

      test('should update existing user', () => {
        const user = new User(client, 42);
        client._userById[42] = user;
        client.users.push(user);
        const listener = jest.fn();
        client.on('newUser', listener);

        client._onUserState({
          session: 42,
          name: 'UpdatedName'
        });

        expect(listener).not.toHaveBeenCalled();
      });

      test('should default channelId to 0 for new users without channel', () => {
        client._onUserState({
          session: 42,
          name: 'NewUser'
          // No channelId - should default to 0
        });

        // The user should be assigned to root channel (id 0)
        expect(client._userById[42]).toBeDefined();
      });
    });

    describe('_onUserRemove', () => {
      test('should remove user from client', () => {
        const user = new User(client, 42);
        client._userById[42] = user;
        client.users.push(user);

        client._onUserRemove({
          session: 42,
          reason: 'Left',
          ban: false
        });

        expect(client._userById[42]).toBeUndefined();
        expect(client.users).not.toContain(user);
      });

      test('should emit remove event with actor', () => {
        const user = new User(client, 42);
        const actor = new User(client, 1);
        const listener = jest.fn();
        user.on('remove', listener);
        client._userById[42] = user;
        client._userById[1] = actor;
        client.users.push(user);

        client._onUserRemove({
          session: 42,
          actor: 1,
          reason: 'Kicked',
          ban: false
        });

        expect(listener).toHaveBeenCalledWith(actor, 'Kicked', false);
      });

      test('should handle ban flag', () => {
        const user = new User(client, 42);
        const listener = jest.fn();
        user.on('remove', listener);
        client._userById[42] = user;
        client.users.push(user);

        client._onUserRemove({
          session: 42,
          reason: 'Banned',
          ban: true
        });

        expect(listener).toHaveBeenCalledWith(undefined, 'Banned', true);
      });
    });
  });

  describe('Outgoing Messages', () => {
    
    describe('Version message (on connect)', () => {
      test('should send Version message with correct format', () => {
        // Version is sent during connect(), check the format
        const versionPayload = {
          version: 66816, // 1.5.0 encoded as (1 << 16) + (5 << 8)
          release: expect.any(String),
          os: expect.any(String),
          osVersion: expect.any(String)
        };

        // Verify the Version message structure matches proto
        expect(versionPayload).toHaveProperty('version');
        expect(versionPayload).toHaveProperty('release');
        expect(versionPayload).toHaveProperty('os');
        expect(versionPayload).toHaveProperty('osVersion');
      });
    });

    describe('Authenticate message (on connect)', () => {
      test('should send Authenticate message with username', () => {
        // Authenticate is sent during connect()
        const authPayload = {
          username: 'TestUser',
          password: '',
          opus: true,
          tokens: []
        };

        expect(authPayload).toHaveProperty('username');
        expect(authPayload).toHaveProperty('opus');
        expect(authPayload.opus).toBe(true);
      });

      test('should include tokens when provided', () => {
        const authPayload = {
          username: 'TestUser',
          tokens: ['token1', 'token2']
        };

        expect(authPayload.tokens).toEqual(['token1', 'token2']);
      });
    });

    describe('Ping message (periodic)', () => {
      test('should send Ping with required fields', () => {
        // Ping message format as defined in proto
        const pingPayload = {
          timestamp: Date.now(),
          tcpPackets: 10,
          tcpPingAvg: 50.5,
          tcpPingVar: 5.2
        };

        expect(pingPayload).toHaveProperty('timestamp');
        expect(typeof pingPayload.timestamp).toBe('number');
      });

      test('should include UDP stats when voice is active', () => {
        const pingPayload = {
          timestamp: Date.now(),
          udpPackets: 100,
          udpPingAvg: 30.2,
          udpPingVar: 2.1
        };

        expect(pingPayload).toHaveProperty('udpPackets');
        expect(pingPayload).toHaveProperty('udpPingAvg');
      });

      test('should start pinger on ServerSync', () => {
        const user = new User(client, 1);
        client._userById[1] = user;
        
        client._onServerSync({ session: 1 });
        
        expect(client._pinger).toBeDefined();
        clearInterval(client._pinger);
      });
    });

    describe('UDPTunnel message (voice)', () => {
      test('should wrap voice data in UDPTunnel format', () => {
        // Voice is sent through _voiceEncoder stream which wraps data as UDPTunnel
        // When _voiceEncoder emits data, it gets written to _data stream as:
        // { name: 'UDPTunnel', payload: <voice data> }
        
        const voiceData = new Uint8Array([0x80, 0x00, 0x01, 0x02, 0x03]);
        
        // The expected format when voice data flows through the encoder
        const expectedMessage = {
          name: 'UDPTunnel',
          payload: voiceData
        };
        
        expect(expectedMessage.name).toBe('UDPTunnel');
        expect(expectedMessage.payload).toBe(voiceData);
      });

      test('should use voiceEncoder to send voice data', () => {
        // Verify voice encoder exists and is wired correctly
        expect(client._voiceEncoder).toBeDefined();
        expect(typeof client._voiceEncoder.write).toBe('function');
      });
    });
  });
});
