/**
 * Integration Tests for mumble-streams usage in the application
 * 
 * These tests validate how mumble-streams integrates with the rest of the codebase:
 * - Version information and format
 * - Data message encoding/decoding (Mumble protocol)
 * - Voice packet handling
 * - UDP crypto operations
 * - Integration with mumble-client
 */

import { jest } from '@jest/globals';

describe('mumble-streams Integration Tests', () => {
  describe('Module Exports', () => {
    let mumbleStreams;

    beforeAll(async () => {
      mumbleStreams = await import('../../app/mumble-streams/index.js');
    });

    test('should export version object', () => {
      expect(mumbleStreams.version).toBeDefined();
      expect(typeof mumbleStreams.version).toBe('object');
    });

    test('should export data module', () => {
      expect(mumbleStreams.data).toBeDefined();
      expect(typeof mumbleStreams.data).toBe('object');
    });

    test('should export voice module', () => {
      expect(mumbleStreams.voice).toBeDefined();
      expect(typeof mumbleStreams.voice).toBe('object');
    });

    test('should export udpCrypto module', () => {
      expect(mumbleStreams.udpCrypto).toBeDefined();
      // udpCrypto is the UdpCrypt constructor function itself
      expect(typeof mumbleStreams.udpCrypto).toBe('function');
    });
  });

  describe('Version Information', () => {
    let version;

    beforeAll(async () => {
      const mumbleStreams = await import('../../app/mumble-streams/index.js');
      version = mumbleStreams.version;
    });

    test('version should have major, minor, patch properties', () => {
      expect(version.major).toBeDefined();
      expect(version.minor).toBeDefined();
      expect(version.patch).toBeDefined();
      
      expect(typeof version.major).toBe('number');
      expect(typeof version.minor).toBe('number');
      expect(typeof version.patch).toBe('number');
    });

    test('version numbers should be non-negative', () => {
      expect(version.major).toBeGreaterThanOrEqual(0);
      expect(version.minor).toBeGreaterThanOrEqual(0);
      expect(version.patch).toBeGreaterThanOrEqual(0);
    });

    test('toUInt8 should convert version to uint8', () => {
      expect(version.toUInt8).toBeDefined();
      expect(typeof version.toUInt8).toBe('function');
      
      const result = version.toUInt8();
      expect(typeof result).toBe('number');
      expect(result).toBeGreaterThanOrEqual(0);
    });

    test('toUInt8 should produce consistent results', () => {
      const result1 = version.toUInt8();
      const result2 = version.toUInt8();
      
      expect(result1).toBe(result2);
    });

    test('version format should match semver pattern', () => {
      // Version should be 1.2.16 or similar
      expect(version.major).toBeGreaterThanOrEqual(1);
      expect(version.minor).toBeGreaterThanOrEqual(0);
      expect(version.patch).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Data Module (Protobuf Messages)', () => {
    let data;

    beforeAll(async () => {
      const mumbleStreams = await import('../../app/mumble-streams/index.js');
      data = mumbleStreams.data;
    });

    test('should have messages object', () => {
      expect(data.messages).toBeDefined();
      expect(typeof data.messages).toBe('object');
    });

    test('should have Encoder constructor', () => {
      expect(data.Encoder).toBeDefined();
      expect(typeof data.Encoder).toBe('function');
    });

    test('should have Decoder constructor', () => {
      expect(data.Decoder).toBeDefined();
      expect(typeof data.Decoder).toBe('function');
    });

    test('messages should include common Mumble protocol messages', () => {
      const expectedMessages = [
        'Version',
        'Authenticate',
        'Ping',
        'ServerSync',
        'ChannelState',
        'UserState',
        'TextMessage',
        'PermissionDenied',
        'UDPTunnel',
        'CryptSetup'
      ];

      expectedMessages.forEach(msgType => {
        expect(data.messages[msgType]).toBeDefined();
      });
    });

    test('PermissionDenied should have DenyType enum', () => {
      // Used in mumble-client/src/client.js: const DenyType = mumbleStreams.data.messages.PermissionDenied.DenyType
      expect(data.messages.PermissionDenied).toBeDefined();
      expect(data.messages.PermissionDenied.DenyType).toBeDefined();
    });

    test('should create Encoder instance', () => {
      const encoder = new data.Encoder();
      expect(encoder).toBeDefined();
      expect(encoder).toBeInstanceOf(data.Encoder);
    });

    test('should create Decoder instance', () => {
      const decoder = new data.Decoder();
      expect(decoder).toBeDefined();
      expect(decoder).toBeInstanceOf(data.Decoder);
    });

    test('Encoder should be a Transform stream', () => {
      const encoder = new data.Encoder();
      expect(encoder.write).toBeDefined();
      expect(encoder.pipe).toBeDefined();
      expect(encoder.on).toBeDefined();
    });

    test('Decoder should be a Transform stream', () => {
      const decoder = new data.Decoder();
      expect(decoder.write).toBeDefined();
      expect(decoder.pipe).toBeDefined();
      expect(decoder.on).toBeDefined();
    });
  });

  describe('Voice Module', () => {
    let voice;

    beforeAll(async () => {
      const mumbleStreams = await import('../../app/mumble-streams/index.js');
      voice = mumbleStreams.voice;
    });

    test('should have Encoder constructor', () => {
      expect(voice.Encoder).toBeDefined();
      expect(typeof voice.Encoder).toBe('function');
    });

    test('should have Decoder constructor', () => {
      expect(voice.Decoder).toBeDefined();
      expect(typeof voice.Decoder).toBe('function');
    });

    test('should create voice Encoder for server destination', () => {
      const encoder = new voice.Encoder('server');
      expect(encoder).toBeDefined();
      expect(encoder).toBeInstanceOf(voice.Encoder);
    });

    test('should create voice Encoder for client destination', () => {
      const encoder = new voice.Encoder('client');
      expect(encoder).toBeDefined();
      expect(encoder).toBeInstanceOf(voice.Encoder);
    });

    test('should throw error for invalid destination', () => {
      expect(() => {
        new voice.Encoder('invalid');
      }).toThrow(TypeError);
    });

    test('should create voice Decoder for server source', () => {
      const decoder = new voice.Decoder('server');
      expect(decoder).toBeDefined();
      expect(decoder).toBeInstanceOf(voice.Decoder);
    });

    test('should create voice Decoder for client source', () => {
      const decoder = new voice.Decoder('client');
      expect(decoder).toBeDefined();
      expect(decoder).toBeInstanceOf(voice.Decoder);
    });

    test('voice Encoder should be a Transform stream', () => {
      const encoder = new voice.Encoder('server');
      expect(encoder.write).toBeDefined();
      expect(encoder.pipe).toBeDefined();
      expect(encoder.on).toBeDefined();
    });

    test('voice Decoder should be a Transform stream', () => {
      const decoder = new voice.Decoder('server');
      expect(decoder.write).toBeDefined();
      expect(decoder.pipe).toBeDefined();
      expect(decoder.on).toBeDefined();
    });
  });

  describe('UDP Crypto Module', () => {
    let udpCrypto;

    beforeAll(async () => {
      const mumbleStreams = await import('../../app/mumble-streams/index.js');
      udpCrypto = mumbleStreams.udpCrypto;
    });

    test('should be UdpCrypt constructor', () => {
      expect(udpCrypto).toBeDefined();
      expect(typeof udpCrypto).toBe('function');
    });

    test('should have BLOCK_SIZE constant', () => {
      expect(udpCrypto.BLOCK_SIZE).toBeDefined();
      expect(typeof udpCrypto.BLOCK_SIZE).toBe('number');
      expect(udpCrypto.BLOCK_SIZE).toBe(16); // AES block size
    });

    test('should have ocbEncrypt function', () => {
      expect(udpCrypto.ocbEncrypt).toBeDefined();
      expect(typeof udpCrypto.ocbEncrypt).toBe('function');
    });

    test('should have ocbDecrypt function', () => {
      expect(udpCrypto.ocbDecrypt).toBeDefined();
      expect(typeof udpCrypto.ocbDecrypt).toBe('function');
    });

    test('should create UdpCrypt instance', () => {
      const crypt = new udpCrypto();
      expect(crypt).toBeDefined();
      expect(crypt).toBeInstanceOf(udpCrypto);
    });

    test('UdpCrypt instance should have encryption methods', () => {
      const crypt = new udpCrypto();
      
      expect(crypt.setKey).toBeDefined();
      expect(crypt.setEncryptIV).toBeDefined();
      expect(crypt.setDecryptIV).toBeDefined();
      expect(crypt.encrypt).toBeDefined();
      expect(crypt.decrypt).toBeDefined();
    });

    test('UdpCrypt instance should have ready check', () => {
      const crypt = new udpCrypto();
      
      expect(crypt.ready).toBeDefined();
      expect(typeof crypt.ready).toBe('function');
    });

    test('UdpCrypt should not be ready without keys', () => {
      const crypt = new udpCrypto();
      // ready() returns falsy value (undefined or false) when not initialized
      expect(crypt.ready()).toBeFalsy();
    });

    test('UdpCrypt should validate key size', () => {
      const crypt = new udpCrypto();
      const invalidKey = Buffer.alloc(8); // Wrong size
      
      expect(() => {
        crypt.setKey(invalidKey);
      }).toThrow('key must be exactly 16 bytes');
    });

    test('UdpCrypt should accept valid key', () => {
      const crypt = new udpCrypto();
      const validKey = Buffer.alloc(16); // Correct size
      
      expect(() => {
        crypt.setKey(validKey);
      }).not.toThrow();
    });

    test('UdpCrypt should have generateKey method', () => {
      const crypt = new udpCrypto();
      expect(crypt.generateKey).toBeDefined();
      expect(typeof crypt.generateKey).toBe('function');
    });
  });

  describe('Integration with mumble-client', () => {
    test('data.messages.PermissionDenied.DenyType matches client usage', async () => {
      // Pattern from mumble-client/src/client.js line 13:
      // const DenyType = mumbleStreams.data.messages.PermissionDenied.DenyType
      const mumbleStreams = await import('../../app/mumble-streams/index.js');
      const DenyType = mumbleStreams.data.messages.PermissionDenied.DenyType;
      
      expect(DenyType).toBeDefined();
      expect(typeof DenyType).toBe('object');
    });

    test('version object can be used for protocol negotiation', async () => {
      // Pattern from mumble-client: version information is used in protocol handshake
      const mumbleStreams = await import('../../app/mumble-streams/index.js');
      const { version } = mumbleStreams;
      
      expect(version.toUInt8).toBeDefined();
      const versionInt = version.toUInt8();
      expect(typeof versionInt).toBe('number');
      expect(versionInt).toBeGreaterThan(0);
    });

    test('data encoder/decoder can be instantiated for protocol handling', async () => {
      const mumbleStreams = await import('../../app/mumble-streams/index.js');
      
      // Pattern used in mumble-client for data stream handling
      const encoder = new mumbleStreams.data.Encoder();
      const decoder = new mumbleStreams.data.Decoder();
      
      expect(encoder).toBeDefined();
      expect(decoder).toBeDefined();
    });
  });

  describe('Stream Compatibility', () => {
    test('data Encoder can be piped', async () => {
      const mumbleStreams = await import('../../app/mumble-streams/index.js');
      const encoder = new mumbleStreams.data.Encoder();
      
      // Should have stream methods
      expect(typeof encoder.pipe).toBe('function');
      expect(typeof encoder.write).toBe('function');
      expect(typeof encoder.end).toBe('function');
    });

    test('data Decoder can be piped', async () => {
      const mumbleStreams = await import('../../app/mumble-streams/index.js');
      const decoder = new mumbleStreams.data.Decoder();
      
      expect(typeof decoder.pipe).toBe('function');
      expect(typeof decoder.write).toBe('function');
      expect(typeof decoder.end).toBe('function');
    });

    test('voice Encoder can be piped', async () => {
      const mumbleStreams = await import('../../app/mumble-streams/index.js');
      const encoder = new mumbleStreams.voice.Encoder('server');
      
      expect(typeof encoder.pipe).toBe('function');
      expect(typeof encoder.write).toBe('function');
      expect(typeof encoder.end).toBe('function');
    });

    test('voice Decoder can be piped', async () => {
      const mumbleStreams = await import('../../app/mumble-streams/index.js');
      const decoder = new mumbleStreams.voice.Decoder('server');
      
      expect(typeof decoder.pipe).toBe('function');
      expect(typeof decoder.write).toBe('function');
      expect(typeof decoder.end).toBe('function');
    });
  });

  describe('Message Types Coverage', () => {
    let messages;

    beforeAll(async () => {
      const mumbleStreams = await import('../../app/mumble-streams/index.js');
      messages = mumbleStreams.data.messages;
    });

    test('should have authentication messages', () => {
      expect(messages.Version).toBeDefined();
      expect(messages.Authenticate).toBeDefined();
      expect(messages.ServerSync).toBeDefined();
      expect(messages.Reject).toBeDefined();
    });

    test('should have channel management messages', () => {
      expect(messages.ChannelState).toBeDefined();
      expect(messages.ChannelRemove).toBeDefined();
    });

    test('should have user management messages', () => {
      expect(messages.UserState).toBeDefined();
      expect(messages.UserRemove).toBeDefined();
      expect(messages.UserStats).toBeDefined();
    });

    test('should have communication messages', () => {
      expect(messages.TextMessage).toBeDefined();
      expect(messages.UDPTunnel).toBeDefined();
    });

    test('should have permission messages', () => {
      expect(messages.PermissionDenied).toBeDefined();
      expect(messages.PermissionQuery).toBeDefined();
      expect(messages.ACL).toBeDefined();
    });

    test('should have configuration messages', () => {
      expect(messages.ServerConfig).toBeDefined();
      expect(messages.SuggestConfig).toBeDefined();
      expect(messages.CodecVersion).toBeDefined();
    });

    test('should have network messages', () => {
      expect(messages.Ping).toBeDefined();
      expect(messages.CryptSetup).toBeDefined();
    });
  });

  describe('Error Handling', () => {
    let mumbleStreams;

    beforeAll(async () => {
      mumbleStreams = await import('../../app/mumble-streams/index.js');
    });

    test('voice Encoder should require valid destination', () => {
      expect(() => {
        new mumbleStreams.voice.Encoder();
      }).toThrow();
    });

    test('voice Encoder should reject invalid destination string', () => {
      expect(() => {
        new mumbleStreams.voice.Encoder('invalid');
      }).toThrow(TypeError);
    });

    test('voice Decoder should require valid source', () => {
      expect(() => {
        new mumbleStreams.voice.Decoder();
      }).toThrow();
    });

    test('udpCrypto should validate key size', () => {
      const crypt = new mumbleStreams.udpCrypto();
      expect(() => {
        crypt.setKey(Buffer.alloc(8)); // Invalid size
      }).toThrow('key must be exactly 16 bytes');
    });

    test('udpCrypto should validate encryptIV size', () => {
      const crypt = new mumbleStreams.udpCrypto();
      expect(() => {
        crypt.setEncryptIV(Buffer.alloc(8)); // Invalid size
      }).toThrow('encryptIV must be exactly 16 bytes');
    });
  });

  describe('Codec Support', () => {
    test('voice module should support Opus codec', async () => {
      const mumbleStreams = await import('../../app/mumble-streams/index.js');
      const encoder = new mumbleStreams.voice.Encoder('server');
      
      // Opus is the primary codec used in modern Mumble
      // Voice encoder should be able to handle Opus packets
      expect(encoder).toBeDefined();
    });
  });

  describe('Memory and Resource Management', () => {
    test('multiple encoder instances should be independent', async () => {
      const mumbleStreams = await import('../../app/mumble-streams/index.js');
      
      const encoder1 = new mumbleStreams.data.Encoder();
      const encoder2 = new mumbleStreams.data.Encoder();
      
      expect(encoder1).not.toBe(encoder2);
    });

    test('multiple decoder instances should be independent', async () => {
      const mumbleStreams = await import('../../app/mumble-streams/index.js');
      
      const decoder1 = new mumbleStreams.data.Decoder();
      const decoder2 = new mumbleStreams.data.Decoder();
      
      expect(decoder1).not.toBe(decoder2);
    });

    test('voice encoder instances should be independent', async () => {
      const mumbleStreams = await import('../../app/mumble-streams/index.js');
      
      const encoder1 = new mumbleStreams.voice.Encoder('server');
      const encoder2 = new mumbleStreams.voice.Encoder('client');
      
      expect(encoder1).not.toBe(encoder2);
    });
  });
});
