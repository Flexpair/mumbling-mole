/**
 * Unit Tests for mumble-streams vendor library
 * 
 * Tests the internal functionality of:
 * - Voice packet encoding/decoding
 * - Data (Protobuf) message encoding/decoding
 * - UDP crypto operations
 * - Transform stream behavior
 */

import { jest } from '@jest/globals';
import { PassThrough } from 'node:stream';

describe('mumble-streams Unit Tests', () => {
  describe('Voice Module - Encoder', () => {
    let voice;
    let Encoder;

    beforeAll(async () => {
      const mumbleStreams = await import('../app/mumble-streams/index.js');
      voice = mumbleStreams.voice;
      Encoder = voice.Encoder;
    });

    describe('Constructor', () => {
      test('creates encoder for server destination', () => {
        const encoder = new Encoder('server');
        expect(encoder).toBeDefined();
        expect(encoder._dest).toBe('server');
      });

      test('creates encoder for client destination', () => {
        const encoder = new Encoder('client');
        expect(encoder).toBeDefined();
        expect(encoder._dest).toBe('client');
      });

      test('works without new keyword', () => {
        const encoder = Encoder('server');
        expect(encoder).toBeInstanceOf(Encoder);
      });

      test('throws TypeError for invalid destination', () => {
        expect(() => new Encoder('invalid')).toThrow(TypeError);
        expect(() => new Encoder('invalid')).toThrow('dest has to be either "server" or "client"');
      });

      test('throws TypeError for missing destination', () => {
        expect(() => new Encoder()).toThrow(TypeError);
      });
    });

    describe('Ping Packet Encoding', () => {
      test('encodes ping packet with timestamp', (done) => {
        const encoder = new Encoder('server');
        const timestamp = 12345;

        encoder.on('data', (buffer) => {
          expect(Buffer.isBuffer(buffer)).toBe(true);
          expect(buffer[0]).toBe(0x20); // Ping packet header
          expect(buffer.length).toBeGreaterThan(1);
          done();
        });

        encoder.write({ timestamp });
      });

      test('encodes ping packet with zero timestamp', (done) => {
        const encoder = new Encoder('server');

        encoder.on('data', (buffer) => {
          expect(buffer[0]).toBe(0x20);
          done();
        });

        encoder.write({ timestamp: 0 });
      });
    });

    describe('Opus Voice Packet Encoding', () => {
      test('encodes Opus packet with single frame', (done) => {
        const encoder = new Encoder('server');
        const frame = Buffer.from([1, 2, 3, 4]);

        encoder.on('data', (buffer) => {
          expect(Buffer.isBuffer(buffer)).toBe(true);
          expect(buffer.length).toBeGreaterThan(frame.length);
          done();
        });

        encoder.write({
          mode: 0,
          codec: 'Opus',
          seqNum: 1,
          end: false,
          frames: [frame]
        });
      });

      test('encodes Opus packet with end bit set', (done) => {
        const encoder = new Encoder('server');

        encoder.on('data', (buffer) => {
          expect(buffer).toBeDefined();
          done();
        });

        encoder.write({
          mode: 0,
          codec: 'Opus',
          seqNum: 1,
          end: true,
          frames: [Buffer.from([1, 2, 3])]
        });
      });

      test('encodes empty Opus frame (end of transmission)', (done) => {
        const encoder = new Encoder('server');

        encoder.on('data', (buffer) => {
          expect(buffer).toBeDefined();
          expect(buffer.length).toBeGreaterThan(0);
          done();
        });

        encoder.write({
          mode: 0,
          codec: 'Opus',
          seqNum: 1,
          end: true,
          frames: []
        });
      });

      test('rejects Opus packet with multiple frames', (done) => {
        const encoder = new Encoder('server');

        encoder.on('error', (err) => {
          expect(err.message).toContain('Opus only supports a single frame');
          done();
        });

        encoder.write({
          mode: 0,
          codec: 'Opus',
          seqNum: 1,
          end: false,
          frames: [Buffer.from([1]), Buffer.from([2])]
        });
      });

      test('includes source for client destination', (done) => {
        const encoder = new Encoder('client');

        encoder.on('data', (buffer) => {
          // Client encoder includes source session id
          expect(buffer.length).toBeGreaterThan(5);
          done();
        });

        encoder.write({
          source: 42,
          mode: 0,
          codec: 'Opus',
          seqNum: 1,
          end: false,
          frames: [Buffer.from([1, 2, 3])]
        });
      });
    });

    describe('Loopback Mode', () => {
      test('encodes loopback packet (mode 31)', (done) => {
        const encoder = new Encoder('server');

        encoder.on('data', (buffer) => {
          const mode = buffer[0] & 0x1f;
          expect(mode).toBe(31);
          done();
        });

        encoder.write({
          mode: 31, // Loopback
          codec: 'Opus',
          seqNum: 1,
          end: false,
          frames: [Buffer.from([1, 2, 3])]
        });
      });
    });

    describe('Position Data', () => {
      test('position data encoding behavior', () => {
        const encoder = new Encoder('server');

        // Position encoding requires sufficient buffer space (12 bytes for 3 floats)
        // When buffer too small, _transform throws RangeError synchronously
        expect(() => {
          encoder.write({
            mode: 0,
            codec: 'Opus',
            seqNum: 1,
            end: false,
            frames: [Buffer.from([1, 2])], // Small frame
            position: { x: 1.0, y: 2.0, z: 3.0 }
          });
        }).toThrow('out of range');
      });
    });

    describe('Legacy Codecs', () => {
      test('encodes CELT_Alpha packet', (done) => {
        const encoder = new Encoder('server');

        encoder.on('data', (buffer) => {
          const codecId = buffer[0] >> 5;
          expect(codecId).toBe(0); // CELT_Alpha
          done();
        });

        encoder.write({
          mode: 0,
          codec: 'CELT_Alpha',
          seqNum: 1,
          end: true,
          frames: [Buffer.from([1, 2, 3])]
        });
      });

      test('encodes Speex packet', (done) => {
        const encoder = new Encoder('server');

        encoder.on('data', (buffer) => {
          const codecId = buffer[0] >> 5;
          expect(codecId).toBe(2); // Speex
          done();
        });

        encoder.write({
          mode: 0,
          codec: 'Speex',
          seqNum: 1,
          end: true,
          frames: [Buffer.from([1, 2, 3])]
        });
      });

      test('rejects CELT/Speex frame larger than 127 bytes', (done) => {
        const encoder = new Encoder('server');

        encoder.on('error', (err) => {
          expect(err.message).toContain('Frame size is greater than 127 bytes');
          done();
        });

        const largeFrame = Buffer.alloc(128);
        encoder.write({
          mode: 0,
          codec: 'Speex',
          seqNum: 1,
          end: false,
          frames: [largeFrame]
        });
      });
    });

    describe('Error Handling', () => {
      test('rejects unknown codec', (done) => {
        const encoder = new Encoder('server');

        encoder.on('error', (err) => {
          expect(err.message).toContain('Unknown codec');
          done();
        });

        encoder.write({
          mode: 0,
          codec: 'InvalidCodec',
          seqNum: 1,
          end: false,
          frames: [Buffer.from([1])]
        });
      });
    });
  });

  describe('Voice Module - Decoder', () => {
    let voice;
    let Decoder;

    beforeAll(async () => {
      const mumbleStreams = await import('../app/mumble-streams/index.js');
      voice = mumbleStreams.voice;
      Decoder = voice.Decoder;
    });

    describe('Constructor', () => {
      test('creates decoder for server origin', () => {
        const decoder = new Decoder('server');
        expect(decoder).toBeDefined();
        expect(decoder._orig).toBe('server');
      });

      test('creates decoder for client origin', () => {
        const decoder = new Decoder('client');
        expect(decoder).toBeDefined();
        expect(decoder._orig).toBe('client');
      });

      test('works without new keyword', () => {
        const decoder = Decoder('server');
        expect(decoder).toBeInstanceOf(Decoder);
      });

      test('throws TypeError for invalid origin', () => {
        expect(() => new Decoder('invalid')).toThrow(TypeError);
        expect(() => new Decoder('invalid')).toThrow('orig has to be either "server" or "client"');
      });
    });

    describe('Ping Packet Decoding', () => {
      test('decodes ping packet', (done) => {
        const decoder = new Decoder('server');

        decoder.on('data', (packet) => {
          expect(packet.timestamp).toBeDefined();
          expect(typeof packet.timestamp).toBe('number');
          done();
        });

        // Ping packet: header byte 0x20 + varint timestamp
        const buffer = Buffer.from([0x20, 0x01]);
        decoder.write(buffer);
      });
    });

    describe('Voice Packet Decoding', () => {
      test('decodes basic Opus packet from server', (done) => {
        const decoder = new Decoder('server');

        decoder.on('data', (packet) => {
          expect(packet.target).toBeDefined();
          expect(packet.source).toBeDefined();
          expect(packet.seqNum).toBeDefined();
          expect(packet.frames).toBeInstanceOf(Array);
          done();
        });

        // Simplified Opus packet structure
        // codecId=4 (Opus), mode=0 → header: (4<<5|0) = 0x80
        const buffer = Buffer.from([
          0x80,        // Header: Opus codec (4<<5), normal mode (0)
          0x01,        // Source session ID (varint: 1)
          0x01,        // Sequence number (varint: 1)
          0x03,        // Frame length (varint: 3)
          0x01, 0x02, 0x03  // Frame data
        ]);
        decoder.write(buffer);
      });

      test('identifies loopback target correctly', (done) => {
        const decoder = new Decoder('server');

        decoder.on('data', (packet) => {
          expect(packet.target).toBe('loopback');
          done();
        });

        // Mode 31 = loopback
        const buffer = Buffer.from([
          0x9F,        // Header: Opus codec (4<<5), loopback mode (31)
          0x01,        // Source session ID
          0x01,        // Sequence number
          0x03,        // Frame length
          0x01, 0x02, 0x03
        ]);
        decoder.write(buffer);
      });
    });

    describe('Error Handling', () => {
      test('handles empty buffer gracefully', (done) => {
        const decoder = new Decoder('server');
        let debugEmitted = false;

        decoder.on('debug', (msg) => {
          if (msg === 'Failed to parse voice packet') {
            debugEmitted = true;
          }
        });

        decoder.on('finish', () => {
          expect(debugEmitted).toBe(true);
          done();
        });

        decoder.write(Buffer.alloc(0));
        decoder.end();
      });

      test('emits debug event for invalid packets', (done) => {
        const decoder = new Decoder('server');

        decoder.on('debug', (msg, reason, chunk) => {
          expect(msg).toBe('Failed to parse voice packet');
          expect(reason).toBeDefined();
          done();
        });

        // Invalid packet (too short)
        decoder.write(Buffer.from([0x80]));
      });
    });
  });

  describe('Data Module - Encoder/Decoder', () => {
    let data;

    beforeAll(async () => {
      const mumbleStreams = await import('../app/mumble-streams/index.js');
      data = mumbleStreams.data;
    });

    describe('Encoder', () => {
      test('creates encoder instance', () => {
        const encoder = new data.Encoder();
        expect(encoder).toBeDefined();
      });

      test('encodes Version message', (done) => {
        const encoder = new data.Encoder();

        encoder.on('data', (buffer) => {
          expect(Buffer.isBuffer(buffer)).toBe(true);
          expect(buffer.length).toBeGreaterThan(0);
          done();
        });

        encoder.write({
          name: 'Version',
          payload: {
            version: 0x010204,
            release: 'test',
            os: 'node',
            os_version: 'v16'
          }
        });
      });

      test('encodes Ping message', (done) => {
        const encoder = new data.Encoder();

        encoder.on('data', (buffer) => {
          expect(buffer.length).toBeGreaterThan(0);
          done();
        });

        encoder.write({
          name: 'Ping',
          payload: {
            timestamp: Date.now()
          }
        });
      });

      test('handles UDPTunnel specially', (done) => {
        const encoder = new data.Encoder();

        encoder.on('data', (buffer) => {
          expect(buffer).toBeDefined();
          done();
        });

        const voiceData = Buffer.from([1, 2, 3, 4]);
        encoder.write({
          name: 'UDPTunnel',
          payload: voiceData
        });
      });

      test('handles empty payload', (done) => {
        const encoder = new data.Encoder();

        encoder.on('data', (buffer) => {
          expect(buffer).toBeDefined();
          done();
        });

        encoder.write({
          name: 'Ping',
          payload: {}
        });
      });
    });

    describe('Decoder', () => {
      test('creates decoder instance', () => {
        const decoder = new data.Decoder();
        expect(decoder).toBeDefined();
      });

      test('decodes encoded message (round-trip)', (done) => {
        const encoder = new data.Encoder();
        const decoder = new data.Decoder();

        const originalMessage = {
          name: 'Ping',
          payload: {
            timestamp: 12345
          }
        };

        decoder.on('data', (decoded) => {
          expect(decoded.name).toBe('Ping');
          expect(decoded.payload).toBeDefined();
          // Protobuf encodes numbers as Long objects for compatibility
          const timestamp = decoded.payload.timestamp;
          const timestampValue = typeof timestamp === 'object' && timestamp.low !== undefined
            ? timestamp.low
            : timestamp;
          expect(timestampValue).toBe(12345);
          done();
        });

        encoder.pipe(decoder);
        encoder.write(originalMessage);
      });

      test('handles multiple messages in sequence', (done) => {
        const encoder = new data.Encoder();
        const decoder = new data.Decoder();

        const messages = [];
        decoder.on('data', (msg) => {
          messages.push(msg);
          if (messages.length === 3) {
            expect(messages[0].name).toBe('Ping');
            expect(messages[1].name).toBe('Ping');
            expect(messages[2].name).toBe('Ping');
            done();
          }
        });

        encoder.pipe(decoder);
        encoder.write({ name: 'Ping', payload: { timestamp: 1 } });
        encoder.write({ name: 'Ping', payload: { timestamp: 2 } });
        encoder.write({ name: 'Ping', payload: { timestamp: 3 } });
      });
    });

    describe('Message Types', () => {
      test('supports Version message', () => {
        expect(data.messages.Version).toBeDefined();
      });

      test('supports Authenticate message', () => {
        expect(data.messages.Authenticate).toBeDefined();
      });

      test('supports ChannelState message', () => {
        expect(data.messages.ChannelState).toBeDefined();
      });

      test('supports UserState message', () => {
        expect(data.messages.UserState).toBeDefined();
      });

      test('supports UDPTunnel message', () => {
        expect(data.messages.UDPTunnel).toBeDefined();
      });
    });
  });

  describe('UDP Crypto Module', () => {
    let udpCrypto;

    beforeAll(async () => {
      const mumbleStreams = await import('../app/mumble-streams/index.js');
      udpCrypto = mumbleStreams.udpCrypto;
    });

    describe('UdpCrypt Constructor', () => {
      test('creates instance without stats', () => {
        const crypt = new udpCrypto();
        expect(crypt).toBeDefined();
      });

      test('creates instance with stats object', () => {
        const stats = {};
        const crypt = new udpCrypto(stats);
        expect(crypt).toBeDefined();
      });

      test('initializes with empty state', () => {
        const crypt = new udpCrypto();
        expect(crypt.ready()).toBeFalsy();
      });
    });

    describe('Key Management', () => {
      test('setKey accepts 16-byte buffer', () => {
        const crypt = new udpCrypto();
        const key = Buffer.alloc(16);
        
        expect(() => {
          crypt.setKey(key);
        }).not.toThrow();
      });

      test('setKey rejects wrong size', () => {
        const crypt = new udpCrypto();
        const key = Buffer.alloc(8);
        
        expect(() => {
          crypt.setKey(key);
        }).toThrow('key must be exactly 16 bytes');
      });

      test('setEncryptIV accepts 16-byte buffer', () => {
        const crypt = new udpCrypto();
        const iv = Buffer.alloc(16);
        
        expect(() => {
          crypt.setEncryptIV(iv);
        }).not.toThrow();
      });

      test('setEncryptIV rejects wrong size', () => {
        const crypt = new udpCrypto();
        const iv = Buffer.alloc(8);
        
        expect(() => {
          crypt.setEncryptIV(iv);
        }).toThrow('encryptIV must be exactly 16 bytes');
      });

      test('setDecryptIV accepts 16-byte buffer', () => {
        const crypt = new udpCrypto();
        const iv = Buffer.alloc(16);
        
        expect(() => {
          crypt.setDecryptIV(iv);
        }).not.toThrow();
      });

      test('setDecryptIV rejects wrong size', () => {
        const crypt = new udpCrypto();
        const iv = Buffer.alloc(32);
        
        expect(() => {
          crypt.setDecryptIV(iv);
        }).toThrow('decryptIV must be exactly 16 bytes');
      });
    });

    describe('Ready State', () => {
      test('not ready without keys', () => {
        const crypt = new udpCrypto();
        expect(crypt.ready()).toBeFalsy();
      });

      test('not ready with only key', () => {
        const crypt = new udpCrypto();
        crypt.setKey(Buffer.alloc(16));
        expect(crypt.ready()).toBeFalsy();
      });

      test('not ready with only encrypt IV', () => {
        const crypt = new udpCrypto();
        crypt.setKey(Buffer.alloc(16));
        crypt.setEncryptIV(Buffer.alloc(16));
        expect(crypt.ready()).toBeFalsy();
      });

      test('ready with all keys set', () => {
        const crypt = new udpCrypto();
        crypt.setKey(Buffer.alloc(16));
        crypt.setEncryptIV(Buffer.alloc(16));
        crypt.setDecryptIV(Buffer.alloc(16));
        expect(crypt.ready()).toBeTruthy();
      });
    });

    describe('Key Getters', () => {
      test('getKey returns set key', () => {
        const crypt = new udpCrypto();
        const key = Buffer.alloc(16, 0x42);
        crypt.setKey(key);
        expect(crypt.getKey()).toEqual(key);
      });

      test('getEncryptIV returns set IV', () => {
        const crypt = new udpCrypto();
        const iv = Buffer.alloc(16, 0x42);
        crypt.setEncryptIV(iv);
        expect(crypt.getEncryptIV()).toEqual(iv);
      });

      test('getDecryptIV returns set IV', () => {
        const crypt = new udpCrypto();
        const iv = Buffer.alloc(16, 0x42);
        crypt.setDecryptIV(iv);
        expect(crypt.getDecryptIV()).toEqual(iv);
      });
    });

    describe('Encryption', () => {
      test('encrypts plaintext when ready', () => {
        const crypt = new udpCrypto();
        crypt.setKey(Buffer.alloc(16, 0x42));
        crypt.setEncryptIV(Buffer.alloc(16));
        crypt.setDecryptIV(Buffer.alloc(16));

        const plainText = Buffer.from('Hello World');
        const cipherText = crypt.encrypt(plainText);

        expect(Buffer.isBuffer(cipherText)).toBe(true);
        expect(cipherText.length).toBeGreaterThan(plainText.length);
        expect(cipherText).not.toEqual(plainText);
      });

      test('encrypted data includes IV byte and tag', () => {
        const crypt = new udpCrypto();
        crypt.setKey(Buffer.alloc(16, 0x42));
        crypt.setEncryptIV(Buffer.alloc(16));
        crypt.setDecryptIV(Buffer.alloc(16));

        const plainText = Buffer.from('Test');
        const cipherText = crypt.encrypt(plainText);

        // OCB adds 4 bytes: 1 IV byte + 3 tag bytes
        expect(cipherText.length).toBe(plainText.length + 4);
      });

      test('encryption changes IV', () => {
        const crypt = new udpCrypto();
        crypt.setKey(Buffer.alloc(16, 0x42));
        crypt.setEncryptIV(Buffer.alloc(16));
        crypt.setDecryptIV(Buffer.alloc(16));

        const ivBefore = Buffer.from(crypt.getEncryptIV());
        crypt.encrypt(Buffer.from('Test'));
        const ivAfter = crypt.getEncryptIV();

        expect(ivAfter).not.toEqual(ivBefore);
      });
    });

    describe('Decryption', () => {
      test('decrypts valid ciphertext', () => {
        const crypt = new udpCrypto();
        const key = Buffer.alloc(16, 0x42);
        const iv = Buffer.alloc(16);

        crypt.setKey(key);
        crypt.setEncryptIV(Buffer.from(iv));
        crypt.setDecryptIV(Buffer.from(iv));

        const plainText = Buffer.from('Hello');
        const cipherText = crypt.encrypt(plainText);

        // Reset decrypt IV for testing
        crypt.setDecryptIV(Buffer.from(iv));
        const decrypted = crypt.decrypt(cipherText);

        expect(decrypted).not.toBeNull();
        expect(Buffer.isBuffer(decrypted)).toBe(true);
      });

      test('returns null for too short ciphertext', () => {
        const crypt = new udpCrypto();
        crypt.setKey(Buffer.alloc(16, 0x42));
        crypt.setEncryptIV(Buffer.alloc(16));
        crypt.setDecryptIV(Buffer.alloc(16));

        const result = crypt.decrypt(Buffer.from([1, 2, 3]));
        expect(result).toBeNull();
      });
    });

    describe('Constants', () => {
      test('BLOCK_SIZE is 16', () => {
        expect(udpCrypto.BLOCK_SIZE).toBe(16);
      });

      test('ocbEncrypt function exists', () => {
        expect(udpCrypto.ocbEncrypt).toBeDefined();
        expect(typeof udpCrypto.ocbEncrypt).toBe('function');
      });

      test('ocbDecrypt function exists', () => {
        expect(udpCrypto.ocbDecrypt).toBeDefined();
        expect(typeof udpCrypto.ocbDecrypt).toBe('function');
      });
    });

    describe('Key Generation', () => {
      test('generateKey creates random keys', (done) => {
        const crypt = new udpCrypto();

        crypt.generateKey((err) => {
          expect(err).toBeUndefined();
          expect(crypt.ready()).toBeTruthy();
          expect(crypt.getKey().length).toBe(16);
          expect(crypt.getEncryptIV().length).toBe(16);
          expect(crypt.getDecryptIV().length).toBe(16);
          done();
        });
      });

      test('generates different keys on each call', (done) => {
        const crypt1 = new udpCrypto();
        const crypt2 = new udpCrypto();

        crypt1.generateKey(() => {
          crypt2.generateKey(() => {
            expect(crypt1.getKey()).not.toEqual(crypt2.getKey());
            done();
          });
        });
      });
    });
  });

  describe('Version Object', () => {
    let version;

    beforeAll(async () => {
      const mumbleStreams = await import('../app/mumble-streams/index.js');
      version = mumbleStreams.version;
    });

    test('has major version number', () => {
      expect(version.major).toBeDefined();
      expect(typeof version.major).toBe('number');
    });

    test('has minor version number', () => {
      expect(version.minor).toBeDefined();
      expect(typeof version.minor).toBe('number');
    });

    test('has patch version number', () => {
      expect(version.patch).toBeDefined();
      expect(typeof version.patch).toBe('number');
    });

    test('toUInt8 returns number', () => {
      const result = version.toUInt8();
      expect(typeof result).toBe('number');
      expect(result).toBeGreaterThan(0);
    });

    test('toUInt8 is consistent', () => {
      const result1 = version.toUInt8();
      const result2 = version.toUInt8();
      expect(result1).toBe(result2);
    });

    test('toUInt8 encodes version correctly', () => {
      const uint8 = version.toUInt8();
      const major = (uint8 >> 16) & 0xFFFF;
      const minor = (uint8 >> 8) & 0xFF;
      const patch = uint8 & 0xFF;

      expect(major).toBe(version.major);
      expect(minor).toBe(version.minor);
      expect(patch).toBe(version.patch);
    });
  });
});
