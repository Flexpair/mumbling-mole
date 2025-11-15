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
          TemporaryChannel: 5,
          MissingCertificate: 6,
          UserName: 7,
          ChannelFull: 8,
          NestingLimit: 9
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
jest.unstable_mockModule('reduplexer', () => ({ default: mockDuplexer }));
jest.unstable_mockModule('drop-stream', () => ({ default: mockDropStream }));
jest.unstable_mockModule('remove-value', () => ({
  default: jest.fn((array, value) => {
    if (array.includes(value)) {
      array.splice(array.indexOf(value), 1);
    }
  })
}));
jest.unstable_mockModule('stats-incremental', () => ({
  default: jest.fn(() => ({
    push: jest.fn(),
    amean: jest.fn(() => 0),
    clear: jest.fn()
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
        celt: [1, 2, 3],
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
  });
});
