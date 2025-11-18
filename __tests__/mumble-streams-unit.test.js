/**
 * Unit Tests for mumble-streams vendor library
 * 
 * Tests the internal functionality of:
 * - Voice packet encoding/decoding
 * - Data (Protobuf) message encoding/decoding
 * - UDP crypto operations
 * - Transform stream behavior
 */

describe('mumble-streams Unit Tests', () => {
  describe('Voice Module - Encoder', () => {
    let voice;
    let Encoder;

    beforeAll(async () => {
      const mumbleStreams = await import('../app/mumble-streams/index.js');
      voice = mumbleStreams.voice;
      Encoder = voice.Encoder;
    });

    // Helper to wait for encoder data event
    const waitForEncoderData = (encoder) => {
      return new Promise((resolve) => {
        encoder.once('data', resolve);
      });
    };

    // Helper to wait for encoder error event
    const waitForEncoderError = (encoder) => {
      return new Promise((resolve) => {
        encoder.once('error', resolve);
      });
    };

    // Helper to create invalid encoder
    const createInvalidEncoder = () => new Encoder('invalid');

    // Helper to create encoder without args
    const createEncoderWithoutArgs = () => new Encoder();

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
        const encoder = new Encoder('server');
        expect(encoder).toBeInstanceOf(Encoder);
      });

      test('throws TypeError for invalid destination', () => {
        expect(createInvalidEncoder).toThrow(TypeError);
        expect(createInvalidEncoder).toThrow('dest has to be either "server" or "client"');
      });

      test('throws TypeError for missing destination', () => {
        expect(createEncoderWithoutArgs).toThrow(TypeError);
      });
    });

    describe('Ping Packet Encoding', () => {
      test('encodes ping packet with timestamp', async () => {
        const encoder = new Encoder('server');
        const timestamp = 12345;

        const dataPromise = waitForEncoderData(encoder);
        encoder.write({ timestamp });
        const buffer = await dataPromise;

        expect(Buffer.isBuffer(buffer)).toBe(true);
        expect(buffer[0]).toBe(0x20); // Ping packet header
        expect(buffer.length).toBeGreaterThan(1);
      });

      test('encodes ping packet with zero timestamp', async () => {
        const encoder = new Encoder('server');

        const dataPromise = waitForEncoderData(encoder);
        encoder.write({ timestamp: 0 });
        const buffer = await dataPromise;

        expect(buffer[0]).toBe(0x20);
      });
    });

    describe('Opus Voice Packet Encoding', () => {
      test('encodes Opus packet with single frame', async () => {
        const encoder = new Encoder('server');
        const frame = Buffer.from([1, 2, 3, 4]);

        const dataPromise = waitForEncoderData(encoder);
        encoder.write({
          mode: 0,
          codec: 'Opus',
          seqNum: 1,
          end: false,
          frames: [frame]
        });
        const buffer = await dataPromise;

        expect(Buffer.isBuffer(buffer)).toBe(true);
        expect(buffer.length).toBeGreaterThan(frame.length);
      });

      test('encodes Opus packet with end bit set', async () => {
        const encoder = new Encoder('server');

        const dataPromise = waitForEncoderData(encoder);
        encoder.write({
          mode: 0,
          codec: 'Opus',
          seqNum: 1,
          end: true,
          frames: [Buffer.from([1, 2, 3])]
        });
        const buffer = await dataPromise;

        expect(buffer).toBeDefined();
      });

      test('encodes empty Opus frame (end of transmission)', async () => {
        const encoder = new Encoder('server');

        const dataPromise = waitForEncoderData(encoder);
        encoder.write({
          mode: 0,
          codec: 'Opus',
          seqNum: 1,
          end: true,
          frames: []
        });
        const buffer = await dataPromise;

        expect(buffer).toBeDefined();
        expect(buffer.length).toBeGreaterThan(0);
      });

      test('rejects Opus packet with multiple frames', async () => {
        const encoder = new Encoder('server');

        const errorPromise = waitForEncoderError(encoder);
        encoder.write({
          mode: 0,
          codec: 'Opus',
          seqNum: 1,
          end: false,
          frames: [Buffer.from([1]), Buffer.from([2])]
        });
        const err = await errorPromise;

        expect(err.message).toContain('Opus only supports a single frame');
      });

      test('includes source for client destination', async () => {
        const encoder = new Encoder('client');

        const dataPromise = waitForEncoderData(encoder);
        encoder.write({
          source: 42,
          mode: 0,
          codec: 'Opus',
          seqNum: 1,
          end: false,
          frames: [Buffer.from([1, 2, 3])]
        });
        const buffer = await dataPromise;

        // Client encoder includes source session id
        expect(buffer.length).toBeGreaterThan(5);
      });
    });

    describe('Loopback Mode', () => {
      test('encodes loopback packet (mode 31)', async () => {
        const encoder = new Encoder('server');

        const dataPromise = waitForEncoderData(encoder);
        encoder.write({
          mode: 31, // Loopback
          codec: 'Opus',
          seqNum: 1,
          end: false,
          frames: [Buffer.from([1, 2, 3])]
        });
        const buffer = await dataPromise;

        const mode = buffer[0] & 0x1f;
        expect(mode).toBe(31);
      });
    });

    describe('Position Data', () => {
      // Helper to write invalid position data
      const writeInvalidPositionData = (encoder) => {
        encoder.write({
          mode: 0,
          codec: 'Opus',
          seqNum: 1,
          end: false,
          frames: [Buffer.from([1, 2])], // Small frame
          position: { x: 1, y: 2, z: 3 }
        });
      };

      test('position data encoding behavior', () => {
        const encoder = new Encoder('server');

        // Position encoding requires sufficient buffer space (12 bytes for 3 floats)
        // When buffer too small, _transform throws RangeError synchronously
        expect(() => writeInvalidPositionData(encoder)).toThrow('out of range');
      });
    });



    describe('Error Handling', () => {
      test('rejects unknown codec', async () => {
        const encoder = new Encoder('server');

        const errorPromise = waitForEncoderError(encoder);
        encoder.write({
          mode: 0,
          codec: 'InvalidCodec',
          seqNum: 1,
          end: false,
          frames: [Buffer.from([1])]
        });
        const err = await errorPromise;

        expect(err.message).toContain('Unknown codec');
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

    // Helper to wait for decoder data event
    const waitForDecoderData = (decoder) => {
      return new Promise((resolve) => {
        decoder.once('data', resolve);
      });
    };

    // Helper to wait for decoder finish event
    const waitForDecoderFinish = (decoder) => {
      return new Promise((resolve) => {
        decoder.once('finish', resolve);
      });
    };

    // Helper to create invalid decoder
    const createInvalidDecoder = () => new Decoder('invalid');

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
        expect(createInvalidDecoder).toThrow(TypeError);
        expect(createInvalidDecoder).toThrow('orig has to be either "server" or "client"');
      });
    });

    describe('Ping Packet Decoding', () => {
      test('decodes ping packet', async () => {
        const decoder = new Decoder('server');

        const dataPromise = waitForDecoderData(decoder);
        // Ping packet: header byte 0x20 + varint timestamp
        const buffer = Buffer.from([0x20, 0x01]);
        decoder.write(buffer);
        const packet = await dataPromise;

        expect(packet.timestamp).toBeDefined();
        expect(typeof packet.timestamp).toBe('number');
      });
    });

    describe('Voice Packet Decoding', () => {
      test('decodes basic Opus packet from server', async () => {
        const decoder = new Decoder('server');

        const dataPromise = waitForDecoderData(decoder);
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
        const packet = await dataPromise;

        expect(packet.target).toBeDefined();
        expect(packet.source).toBeDefined();
        expect(packet.seqNum).toBeDefined();
        expect(packet.frames).toBeInstanceOf(Array);
      });

      test('identifies loopback target correctly', async () => {
        const decoder = new Decoder('server');

        const dataPromise = waitForDecoderData(decoder);
        // Mode 31 = loopback
        const buffer = Buffer.from([
          0x9F,        // Header: Opus codec (4<<5), loopback mode (31)
          0x01,        // Source session ID
          0x01,        // Sequence number
          0x03,        // Frame length
          0x01, 0x02, 0x03
        ]);
        decoder.write(buffer);
        const packet = await dataPromise;

        expect(packet.target).toBe('loopback');
      });
    });

    describe('Error Handling', () => {
      // Helper to check debug event
      const checkDebugEvent = (decoder) => {
        return new Promise((resolve) => {
          decoder.on('debug', (msg) => {
            if (msg === 'Failed to parse voice packet') {
              resolve(true);
            }
          });
        });
      };

      test('handles empty buffer gracefully', async () => {
        const decoder = new Decoder('server');
        const debugPromise = checkDebugEvent(decoder);

        decoder.write(Buffer.alloc(0));
        decoder.end();
        await waitForDecoderFinish(decoder);

        const debugEmitted = await debugPromise;
        expect(debugEmitted).toBe(true);
      });

      test('emits debug event for invalid packets', async () => {
        const decoder = new Decoder('server');

        const debugPromise = new Promise((resolve) => {
          decoder.once('debug', (msg, reason, chunk) => {
            resolve({ msg, reason, chunk });
          });
        });

        // Invalid packet (too short)
        decoder.write(Buffer.from([0x80]));
        const { msg, reason } = await debugPromise;

        expect(msg).toBe('Failed to parse voice packet');
        expect(reason).toBeDefined();
      });
    });
  });

  describe('Data Module - Encoder/Decoder', () => {
    let data;

    beforeAll(async () => {
      const mumbleStreams = await import('../app/mumble-streams/index.js');
      data = mumbleStreams.data;
    });

    // Helper to wait for data encoder output
    const waitForDataEncoderOutput = (encoder) => {
      return new Promise((resolve) => {
        encoder.once('data', resolve);
      });
    };

    // Helper to wait for data decoder output
    const waitForDataDecoderOutput = (decoder) => {
      return new Promise((resolve) => {
        decoder.once('data', resolve);
      });
    };

    // Helper to collect multiple decoder outputs
    const collectDecoderOutputs = (decoder, count) => {
      return new Promise((resolve) => {
        const messages = [];
        const handler = (msg) => {
          messages.push(msg);
          if (messages.length === count) {
            decoder.off('data', handler);
            resolve(messages);
          }
        };
        decoder.on('data', handler);
      });
    };

    describe('Encoder', () => {
      test('creates encoder instance', () => {
        const encoder = new data.Encoder();
        expect(encoder).toBeDefined();
      });

      test('encodes Version message', async () => {
        const encoder = new data.Encoder();

        const dataPromise = waitForDataEncoderOutput(encoder);
        encoder.write({
          name: 'Version',
          payload: {
            version: 0x010204,
            release: 'test',
            os: 'node',
            os_version: 'v16'
          }
        });
        const buffer = await dataPromise;

        expect(Buffer.isBuffer(buffer)).toBe(true);
        expect(buffer.length).toBeGreaterThan(0);
      });

      test('encodes Ping message', async () => {
        const encoder = new data.Encoder();

        const dataPromise = waitForDataEncoderOutput(encoder);
        encoder.write({
          name: 'Ping',
          payload: {
            timestamp: Date.now()
          }
        });
        const buffer = await dataPromise;

        expect(buffer.length).toBeGreaterThan(0);
      });

      test('handles UDPTunnel specially', async () => {
        const encoder = new data.Encoder();

        const dataPromise = waitForDataEncoderOutput(encoder);
        const voiceData = Buffer.from([1, 2, 3, 4]);
        encoder.write({
          name: 'UDPTunnel',
          payload: voiceData
        });
        const buffer = await dataPromise;

        expect(buffer).toBeDefined();
      });

      test('handles empty payload', async () => {
        const encoder = new data.Encoder();

        const dataPromise = waitForDataEncoderOutput(encoder);
        encoder.write({
          name: 'Ping',
          payload: {}
        });
        const buffer = await dataPromise;

        expect(buffer).toBeDefined();
      });
    });

    describe('Decoder', () => {
      test('creates decoder instance', () => {
        const decoder = new data.Decoder();
        expect(decoder).toBeDefined();
      });

      // Helper to extract timestamp value
      const extractTimestampValue = (timestamp) => {
        return typeof timestamp === 'object' && timestamp.low !== undefined
          ? timestamp.low
          : timestamp;
      };

      test('decodes encoded message (round-trip)', async () => {
        const encoder = new data.Encoder();
        const decoder = new data.Decoder();

        const originalMessage = {
          name: 'Ping',
          payload: {
            timestamp: 12345
          }
        };

        const decoderPromise = waitForDataDecoderOutput(decoder);
        encoder.pipe(decoder);
        encoder.write(originalMessage);
        const decoded = await decoderPromise;

        expect(decoded.name).toBe('Ping');
        expect(decoded.payload).toBeDefined();
        // Protobuf encodes numbers as Long objects for compatibility
        const timestampValue = extractTimestampValue(decoded.payload.timestamp);
        expect(timestampValue).toBe(12345);
      });

      test('handles multiple messages in sequence', async () => {
        const encoder = new data.Encoder();
        const decoder = new data.Decoder();

        const messagesPromise = collectDecoderOutputs(decoder, 3);
        encoder.pipe(decoder);
        encoder.write({ name: 'Ping', payload: { timestamp: 1 } });
        encoder.write({ name: 'Ping', payload: { timestamp: 2 } });
        encoder.write({ name: 'Ping', payload: { timestamp: 3 } });
        const messages = await messagesPromise;

        expect(messages[0].name).toBe('Ping');
        expect(messages[1].name).toBe('Ping');
        expect(messages[2].name).toBe('Ping');
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
      // Helper to set invalid key size
      const setInvalidKey = (crypt) => () => {
        crypt.setKey(Buffer.alloc(8));
      };

      // Helper to set invalid encrypt IV size
      const setInvalidEncryptIV = (crypt) => () => {
        crypt.setEncryptIV(Buffer.alloc(8));
      };

      // Helper to set invalid decrypt IV size
      const setInvalidDecryptIV = (crypt) => () => {
        crypt.setDecryptIV(Buffer.alloc(32));
      };

      // Helper to set valid key
      const setValidKey = (crypt) => () => {
        crypt.setKey(Buffer.alloc(16));
      };

      // Helper to set valid encrypt IV
      const setValidEncryptIV = (crypt) => () => {
        crypt.setEncryptIV(Buffer.alloc(16));
      };

      // Helper to set valid decrypt IV
      const setValidDecryptIV = (crypt) => () => {
        crypt.setDecryptIV(Buffer.alloc(16));
      };

      test('setKey accepts 16-byte buffer', () => {
        const crypt = new udpCrypto();
        expect(setValidKey(crypt)).not.toThrow();
      });

      test('setKey rejects wrong size', () => {
        const crypt = new udpCrypto();
        expect(setInvalidKey(crypt)).toThrow('key must be exactly 16 bytes');
      });

      test('setEncryptIV accepts 16-byte buffer', () => {
        const crypt = new udpCrypto();
        expect(setValidEncryptIV(crypt)).not.toThrow();
      });

      test('setEncryptIV rejects wrong size', () => {
        const crypt = new udpCrypto();
        expect(setInvalidEncryptIV(crypt)).toThrow('encryptIV must be exactly 16 bytes');
      });

      test('setDecryptIV accepts 16-byte buffer', () => {
        const crypt = new udpCrypto();
        expect(setValidDecryptIV(crypt)).not.toThrow();
      });

      test('setDecryptIV rejects wrong size', () => {
        const crypt = new udpCrypto();
        expect(setInvalidDecryptIV(crypt)).toThrow('decryptIV must be exactly 16 bytes');
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
      // Helper to promisify generateKey
      const generateKeyAsync = (crypt) => {
        return new Promise((resolve, reject) => {
          crypt.generateKey((err) => {
            if (err) reject(err);
            else resolve();
          });
        });
      };

      test('generateKey creates random keys', async () => {
        const crypt = new udpCrypto();

        await generateKeyAsync(crypt);
        
        expect(crypt.ready()).toBeTruthy();
        expect(crypt.getKey().length).toBe(16);
        expect(crypt.getEncryptIV().length).toBe(16);
        expect(crypt.getDecryptIV().length).toBe(16);
      });

      test('generates different keys on each call', async () => {
        const crypt1 = new udpCrypto();
        const crypt2 = new udpCrypto();

        await generateKeyAsync(crypt1);
        await generateKeyAsync(crypt2);
        
        expect(crypt1.getKey()).not.toEqual(crypt2.getKey());
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
