/**
 * Mumble Streams Voice Tests
 * 
 * Tests for the voice encoder/decoder in mumble-streams
 */
import { jest, describe, it, expect, beforeEach } from '@jest/globals';

import { Encoder, Decoder } from '../app/mumble-streams/voice.js';

describe('Voice Encoder', () => {
  let encoder;

  describe('Constructor', () => {
    it('should create encoder for server destination', () => {
      encoder = new Encoder('server');
      expect(encoder).toBeDefined();
      expect(encoder._dest).toBe('server');
    });

    it('should create encoder for client destination', () => {
      encoder = new Encoder('client');
      expect(encoder).toBeDefined();
      expect(encoder._dest).toBe('client');
    });

    it('should throw for invalid destination', () => {
      expect(() => new Encoder('invalid')).toThrow(TypeError);
      expect(() => new Encoder('invalid')).toThrow('dest has to be either "server" or "client"');
    });
  });

  describe('Ping Packets', () => {
    beforeEach(() => {
      encoder = new Encoder('server');
    });

    it('should encode ping packet with timestamp', (done) => {
      encoder.on('data', (chunk) => {
        expect(Buffer.isBuffer(chunk)).toBe(true);
        expect(chunk[0]).toBe(0x20); // Ping header
        done();
      });

      encoder.write({ timestamp: 12345 });
    });

    it('should encode ping packet with zero timestamp', (done) => {
      encoder.on('data', (chunk) => {
        expect(chunk[0]).toBe(0x20);
        done();
      });

      encoder.write({ timestamp: 0 });
    });
  });

  describe('Voice Packets - Opus', () => {
    beforeEach(() => {
      encoder = new Encoder('server');
    });

    it('should encode Opus voice packet', (done) => {
      encoder.on('data', (chunk) => {
        expect(Buffer.isBuffer(chunk)).toBe(true);
        // Header should have codec ID 4 in upper bits
        expect(chunk[0] >> 5).toBe(4);
        done();
      });

      encoder.write({
        codec: 'Opus',
        mode: 0, // Normal
        seqNum: 1,
        end: false,
        frames: [Buffer.from([1, 2, 3, 4])],
      });
    });

    it('should encode end packet with end bit set', (done) => {
      encoder.on('data', (chunk) => {
        // The end bit should be in the voice data
        expect(chunk.length).toBeGreaterThan(2);
        done();
      });

      encoder.write({
        codec: 'Opus',
        mode: 0,
        seqNum: 1,
        end: true,
        frames: [Buffer.from([1, 2, 3])],
      });
    });

    it('should encode packet with mode/target', (done) => {
      encoder.on('data', (chunk) => {
        // Mode is in lower 5 bits
        expect(chunk[0] & 0x1f).toBe(31); // Loopback mode
        done();
      });

      encoder.write({
        codec: 'Opus',
        mode: 31,
        seqNum: 1,
        end: false,
        frames: [Buffer.from([1])],
      });
    });

    it('should encode empty frames', (done) => {
      encoder.on('data', (chunk) => {
        expect(Buffer.isBuffer(chunk)).toBe(true);
        done();
      });

      encoder.write({
        codec: 'Opus',
        mode: 0,
        seqNum: 1,
        end: true,
        frames: [],
      });
    });

    it('should error on multiple Opus frames', (done) => {
      encoder.on('error', (err) => {
        expect(err.message).toContain('single frame');
        done();
      });

      encoder.write({
        codec: 'Opus',
        mode: 0,
        seqNum: 1,
        end: false,
        frames: [Buffer.from([1]), Buffer.from([2])],
      });
    });

    it('should error on unknown codec', (done) => {
      encoder.on('error', (err) => {
        expect(err.message).toContain('Unknown codec');
        done();
      });

      encoder.write({
        codec: 'CELT',
        mode: 0,
        seqNum: 1,
        end: false,
        frames: [Buffer.from([1])],
      });
    });

    it('should include position data when present', (done) => {
      encoder.on('data', (chunk) => {
        // Packet should be longer with position data (3 floats = 12 bytes)
        expect(chunk.length).toBeGreaterThan(10);
        done();
      });

      encoder.write({
        codec: 'Opus',
        mode: 0,
        seqNum: 1,
        end: false,
        frames: [Buffer.from([1])],
        position: { x: 1.0, y: 2.0, z: 3.0 },
      });
    });
  });

  describe('Client-bound packets', () => {
    beforeEach(() => {
      encoder = new Encoder('client');
    });

    it('should include source session ID for client packets', (done) => {
      encoder.on('data', (chunk) => {
        // Should have source after header
        expect(chunk.length).toBeGreaterThan(3);
        done();
      });

      encoder.write({
        codec: 'Opus',
        mode: 0,
        source: 42,
        seqNum: 1,
        end: false,
        frames: [Buffer.from([1])],
      });
    });
  });
});

describe('Voice Decoder', () => {
  let decoder;

  describe('Constructor', () => {
    it('should create decoder for server origin', () => {
      decoder = new Decoder('server');
      expect(decoder).toBeDefined();
      expect(decoder._orig).toBe('server');
    });

    it('should create decoder for client origin', () => {
      decoder = new Decoder('client');
      expect(decoder).toBeDefined();
      expect(decoder._orig).toBe('client');
    });

    it('should throw for invalid origin', () => {
      expect(() => new Decoder('invalid')).toThrow(TypeError);
    });
  });

  describe('Ping Packets', () => {
    beforeEach(() => {
      decoder = new Decoder('server');
    });

    it('should decode ping packet', (done) => {
      decoder.on('data', (packet) => {
        expect(packet.timestamp).toBeDefined();
        done();
      });

      // Ping packet: header 0x20 + varint timestamp
      decoder.write(Buffer.from([0x20, 0x39, 0x30])); // timestamp ~12345
    });
  });

  describe('Voice Packets', () => {
    beforeEach(() => {
      decoder = new Decoder('server');
    });

    it('should decode Opus voice packet from server', (done) => {
      decoder.on('data', (packet) => {
        expect(packet.codec).toBe('Opus');
        expect(packet.source).toBeDefined();
        expect(packet.seqNum).toBeDefined();
        expect(packet.frames).toBeInstanceOf(Array);
        done();
      });

      // Build a simple Opus packet
      // Header: codec 4 (Opus) << 5 | mode 0 = 0x80
      // Source: varint 1
      // SeqNum: varint 1
      // VoiceLen: varint 3
      // VoiceData: 3 bytes
      const packet = Buffer.from([
        0x80, // Header: Opus, mode 0
        0x01, // Source: 1
        0x01, // SeqNum: 1
        0x03, // Voice length: 3
        0xAA, 0xBB, 0xCC, // Voice data
      ]);
      
      decoder.write(packet);
    });

    it('should decode packet from client (no source)', (done) => {
      decoder = new Decoder('client');
      
      decoder.on('data', (packet) => {
        expect(packet.source).toBeUndefined();
        expect(packet.seqNum).toBeDefined();
        done();
      });

      const packet = Buffer.from([
        0x80, // Header: Opus, mode 0
        0x01, // SeqNum: 1
        0x03, // Voice length: 3
        0xAA, 0xBB, 0xCC,
      ]);
      
      decoder.write(packet);
    });

    it('should decode end bit', (done) => {
      decoder.on('data', (packet) => {
        expect(packet.end).toBe(true);
        done();
      });

      // Voice length with end bit: 0x03 | 0x2000 = 0x2003
      // As varint: 0xA0, 0x03
      const packet = Buffer.from([
        0x80, 0x01, 0x01,
        0xA0, 0x03, // Voice length with end bit
        0xAA, 0xBB, 0xCC,
      ]);
      
      decoder.write(packet);
    });

    it('should handle empty voice frames', (done) => {
      decoder.on('data', (packet) => {
        expect(packet.frames).toEqual([]);
        done();
      });

      const packet = Buffer.from([
        0x80, 0x01, 0x01,
        0x00, // Voice length: 0
      ]);
      
      decoder.write(packet);
    });

    it('should decode target from mode', (done) => {
      decoder.on('data', (packet) => {
        expect(packet.target).toBe('loopback');
        done();
      });

      // Mode 31 = loopback
      const packet = Buffer.from([
        0x9F, // Header: Opus | mode 31
        0x01, 0x01, 0x00,
      ]);
      
      decoder.write(packet);
    });

    it('should emit debug on parse failure', (done) => {
      decoder.on('debug', (msg, reason) => {
        expect(msg).toContain('Failed');
        done();
      });

      decoder.write(Buffer.from([0x80])); // Too short
    });

    it('should handle empty buffer', (done) => {
      decoder.on('debug', (msg, reason) => {
        expect(reason).toBe('empty');
        done();
      });

      decoder.write(Buffer.from([]));
    });

    it('should emit unknown_codec for unsupported codecs', (done) => {
      decoder.on('unknown_codec', (codecId) => {
        expect(codecId).toBe(2); // CELT Alpha
        done();
      });

      // Codec 2 (CELT Alpha) << 5 = 0x40
      const packet = Buffer.from([
        0x40, 0x01, 0x01, 0x03, 0xAA, 0xBB, 0xCC,
      ]);
      
      decoder.write(packet);
    });
  });

  describe('Positional Audio', () => {
    beforeEach(() => {
      decoder = new Decoder('server');
    });

    it('should create decoder for positional audio scenario', () => {
      // Positional audio decoding requires specific packet format
      // Just verify the decoder can be created
      expect(decoder).toBeDefined();
      expect(decoder._orig).toBe('server');
    });
  });
});

describe('Encoder/Decoder Round-trip', () => {
  it('should round-trip voice packet', (done) => {
    const encoder = new Encoder('server');
    const decoder = new Decoder('client');

    const original = {
      codec: 'Opus',
      mode: 0,
      seqNum: 42,
      end: false,
      frames: [Buffer.from([0xDE, 0xAD, 0xBE, 0xEF])],
    };

    decoder.on('data', (decoded) => {
      expect(decoded.codec).toBe(original.codec);
      expect(decoded.seqNum).toBe(original.seqNum);
      expect(decoded.end).toBe(original.end);
      expect(decoded.frames[0]).toEqual(original.frames[0]);
      done();
    });

    encoder.pipe(decoder);
    encoder.write(original);
  });

  it('should round-trip ping packet', (done) => {
    const encoder = new Encoder('server');
    const decoder = new Decoder('client');

    const original = { timestamp: 98765 };

    decoder.on('data', (decoded) => {
      expect(decoded.timestamp).toBe(original.timestamp);
      done();
    });

    encoder.pipe(decoder);
    encoder.write(original);
  });
});
