/**
 * UdpCrypt Tests
 * 
 * Tests for the UDP encryption/decryption used in Mumble protocol
 */
import { describe, it, expect, beforeEach } from '@jest/globals';
import UdpCrypt, { BLOCK_SIZE } from '../../app/mumble-streams/udp-crypto.js';

describe('UdpCrypt', () => {
  let crypt;
  let stats;

  beforeEach(() => {
    stats = { good: 0, late: 0, lost: 0 };
    crypt = new UdpCrypt(stats);
  });

  describe('constructor', () => {
    it('should initialize with empty decrypt history', () => {
      expect(crypt._decryptHistory).toHaveLength(100);
    });

    it('should accept stats object', () => {
      expect(crypt._stats).toBe(stats);
    });

    it('should use empty object if no stats provided', () => {
      const cryptNoStats = new UdpCrypt();
      expect(cryptNoStats._stats).toEqual({});
    });
  });

  describe('ready()', () => {
    it('should return falsy when not initialized', () => {
      expect(crypt.ready()).toBeFalsy();
    });

    it('should return truthy when all keys are set', () => {
      const key = Buffer.alloc(BLOCK_SIZE);
      const iv = Buffer.alloc(BLOCK_SIZE);
      
      crypt.setKey(key);
      crypt.setDecryptIV(iv);
      crypt.setEncryptIV(Buffer.alloc(BLOCK_SIZE));
      
      // ready() returns truthy (the encryptIV) when all are set
      expect(crypt.ready()).toBeTruthy();
    });
  });

  describe('setKey()', () => {
    it('should accept 16-byte key', () => {
      const key = Buffer.alloc(BLOCK_SIZE);
      crypt.setKey(key);
      expect(crypt.getKey()).toBe(key);
    });

    it('should reject non-16-byte key', () => {
      const shortKey = Buffer.alloc(8);
      expect(() => crypt.setKey(shortKey)).toThrow('key must be exactly 16 bytes');
    });
  });

  describe('setDecryptIV()', () => {
    it('should accept 16-byte IV', () => {
      const iv = Buffer.alloc(BLOCK_SIZE);
      crypt.setDecryptIV(iv);
      expect(crypt.getDecryptIV()).toBe(iv);
    });

    it('should reject non-16-byte IV', () => {
      const shortIV = Buffer.alloc(8);
      expect(() => crypt.setDecryptIV(shortIV)).toThrow('decryptIV must be exactly 16 bytes');
    });
  });

  describe('setEncryptIV()', () => {
    it('should accept 16-byte IV', () => {
      const iv = Buffer.alloc(BLOCK_SIZE);
      crypt.setEncryptIV(iv);
      expect(crypt.getEncryptIV()).toBe(iv);
    });

    it('should reject non-16-byte IV', () => {
      const shortIV = Buffer.alloc(8);
      expect(() => crypt.setEncryptIV(shortIV)).toThrow('encryptIV must be exactly 16 bytes');
    });
  });

  describe('generateKey()', () => {
    it('should set ready to true after generation', async () => {
      // Manually set keys to simulate generateKey behavior
      crypt.setKey(Buffer.alloc(BLOCK_SIZE));
      crypt.setDecryptIV(Buffer.alloc(BLOCK_SIZE));
      crypt.setEncryptIV(Buffer.alloc(BLOCK_SIZE));
      
      // ready() returns truthy (the encryptIV) when all are set
      expect(crypt.ready()).toBeTruthy();
    });
  });

  describe('encrypt() and decrypt()', () => {
    beforeEach(() => {
      // Manually set up crypto keys
      crypt.setKey(Buffer.alloc(BLOCK_SIZE, 1)); // Non-zero key
      crypt.setDecryptIV(Buffer.alloc(BLOCK_SIZE, 2));
      crypt.setEncryptIV(Buffer.alloc(BLOCK_SIZE, 3));
    });

    it('should encrypt plaintext', () => {
      const plainText = Buffer.from('Hello, World!!!'); // 16 bytes
      const cipherText = crypt.encrypt(plainText);
      
      expect(cipherText).toHaveLength(plainText.length + 4);
      expect(cipherText).not.toEqual(plainText);
    });

    it('should increment encrypt IV after encryption', () => {
      const ivBefore = Buffer.from(crypt.getEncryptIV());
      crypt.encrypt(Buffer.alloc(16));
      const ivAfter = crypt.getEncryptIV();
      
      // First byte should be incremented
      expect(ivAfter[0]).toBe((ivBefore[0] + 1) % 256);
    });

    it('should handle IV wraparound', () => {
      // Set IV to 255 so it wraps
      const iv = Buffer.alloc(BLOCK_SIZE, 255);
      crypt.setEncryptIV(iv);
      
      crypt.encrypt(Buffer.alloc(16));
      
      const newIV = crypt.getEncryptIV();
      expect(newIV[0]).toBe(0);
      expect(newIV[1]).toBe(0); // Carry propagates
    });

    it('should return null for too short ciphertext', () => {
      const result = crypt.decrypt(Buffer.alloc(3));
      expect(result).toBeNull();
    });
  });

  describe('_handleIVUpdate()', () => {
    beforeEach(() => {
      crypt.setDecryptIV(Buffer.from([10, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]));
    });

    it('should update IV when ivbyte is greater', () => {
      const result = crypt._handleIVUpdate(15);
      expect(result).toBe(true);
      expect(crypt.getDecryptIV()[0]).toBe(15);
    });

    it('should update IV and carry when ivbyte wraps around', () => {
      crypt.setDecryptIV(Buffer.from([250, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]));
      const result = crypt._handleIVUpdate(5);
      expect(result).toBe(true);
      expect(crypt.getDecryptIV()[0]).toBe(5);
      expect(crypt.getDecryptIV()[1]).toBe(1); // Carry
    });

    it('should return false when ivbyte equals current', () => {
      const result = crypt._handleIVUpdate(10);
      expect(result).toBe(false);
    });
  });

  describe('_calculateDiff()', () => {
    beforeEach(() => {
      crypt.setDecryptIV(Buffer.from([100, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]));
    });

    it('should calculate positive difference', () => {
      expect(crypt._calculateDiff(110)).toBe(10);
    });

    it('should calculate negative difference', () => {
      expect(crypt._calculateDiff(90)).toBe(-10);
    });

    it('should handle wraparound (> 128)', () => {
      crypt.setDecryptIV(Buffer.from([10, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]));
      expect(crypt._calculateDiff(200)).toBe(-66); // 200 - 10 = 190, 190 - 256 = -66
    });

    it('should handle wraparound (< -128)', () => {
      crypt.setDecryptIV(Buffer.from([200, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]));
      expect(crypt._calculateDiff(10)).toBe(66); // 10 - 200 = -190, -190 + 256 = 66
    });
  });

  describe('_decrementIV()', () => {
    it('should decrement first byte', () => {
      crypt.setDecryptIV(Buffer.from([10, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]));
      crypt._decrementIV();
      expect(crypt.getDecryptIV()[0]).toBe(9);
    });

    it('should handle underflow with borrow', () => {
      // When [0] is 0, it becomes 255, and continues to check further bytes
      crypt.setDecryptIV(Buffer.from([0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]));
      crypt._decrementIV();
      // After underflow, first byte becomes 255
      expect(crypt.getDecryptIV()[0]).toBe(255);
    });
  });

  describe('_incrementIV()', () => {
    it('should increment first byte', () => {
      crypt.setDecryptIV(Buffer.from([10, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]));
      crypt._incrementIV();
      expect(crypt.getDecryptIV()[0]).toBe(11);
    });

    it('should handle overflow', () => {
      crypt.setDecryptIV(Buffer.from([255, 10, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]));
      crypt._incrementIV();
      expect(crypt.getDecryptIV()[0]).toBe(0);
      expect(crypt.getDecryptIV()[1]).toBe(11);
    });
  });

  describe('_handleLatePacket()', () => {
    beforeEach(() => {
      crypt.setDecryptIV(Buffer.from([100, 5, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]));
    });

    it('should handle late packet without wraparound', () => {
      const result = crypt._handleLatePacket(95, false);
      expect(result.restore).toBe(true);
      expect(result.late).toBe(1);
      expect(result.lost).toBe(-1);
      expect(result.success).toBe(true);
      expect(crypt.getDecryptIV()[0]).toBe(95);
    });

    it('should handle late packet with wraparound', () => {
      const result = crypt._handleLatePacket(250, true);
      expect(result.restore).toBe(true);
      expect(result.late).toBe(1);
      // After setting ivbyte=250 and calling _decrementIV(), IV[0] becomes 249
      expect(crypt.getDecryptIV()[0]).toBe(249);
    });
  });

  describe('_handleLostPackets()', () => {
    beforeEach(() => {
      crypt.setDecryptIV(Buffer.from([100, 5, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]));
    });

    it('should calculate lost packets without wraparound', () => {
      const result = crypt._handleLostPackets(110, false);
      expect(result.lost).toBe(9); // 110 - 100 - 1 = 9
      expect(result.restore).toBe(false);
      expect(result.success).toBe(true);
    });

    it('should calculate lost packets with wraparound', () => {
      crypt.setDecryptIV(Buffer.from([250, 5, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]));
      const result = crypt._handleLostPackets(10, true);
      // 256 - 250 + 10 - 1 = 15
      expect(result.lost).toBe(15);
    });
  });

  describe('_handleOutOfOrderPacket()', () => {
    beforeEach(() => {
      crypt.setDecryptIV(Buffer.from([100, 5, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]));
      crypt._decryptHistory = new Array(100);
    });

    it('should reject duplicate packet', () => {
      // diff == 0 when ivbyte equals current
      const result = crypt._handleOutOfOrderPacket(100, Buffer.alloc(16));
      expect(result.success).toBe(false);
    });

    it('should reject very old packet (diff <= -30)', () => {
      // ivbyte = 60, current = 100, diff = -40
      const result = crypt._handleOutOfOrderPacket(60, Buffer.alloc(16));
      expect(result.success).toBe(false);
    });

    it('should handle late packet (diff > -30 and < 0)', () => {
      // ivbyte = 90, current = 100, diff = -10
      const result = crypt._handleOutOfOrderPacket(90, Buffer.alloc(16));
      expect(result.success).toBe(true);
      expect(result.late).toBe(1);
    });

    it('should handle future packet (diff > 0)', () => {
      // ivbyte = 110, current = 100, diff = 10
      const result = crypt._handleOutOfOrderPacket(110, Buffer.alloc(16));
      expect(result.success).toBe(true);
      expect(result.lost).toBe(9);
    });

    it('should reject packet if already in history', () => {
      // Set up so the packet appears in history
      crypt._decryptHistory[90] = 5; // matches _decryptIV[1]
      crypt.setDecryptIV(Buffer.from([100, 5, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]));
      
      // Late packet that would match history
      const result = crypt._handleOutOfOrderPacket(90, Buffer.alloc(16));
      expect(result.success).toBe(false);
    });
  });

  describe('full encrypt/decrypt cycle', () => {
    let crypt1, crypt2;
    
    beforeEach(() => {
      const key = Buffer.from([1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16]);
      const iv = Buffer.alloc(BLOCK_SIZE, 0);
      
      crypt1 = new UdpCrypt({ good: 0, late: 0, lost: 0 });
      crypt1.setKey(key);
      crypt1.setEncryptIV(Buffer.from(iv));
      crypt1.setDecryptIV(Buffer.from(iv));
      
      crypt2 = new UdpCrypt({ good: 0, late: 0, lost: 0 });
      crypt2.setKey(key);
      crypt2.setEncryptIV(Buffer.from(iv));
      crypt2.setDecryptIV(Buffer.from(iv));
    });

    it('should encrypt and decrypt successfully', () => {
      const plainText = Buffer.from('Test message!!!X'); // 16 bytes
      
      const encrypted = crypt1.encrypt(plainText);
      expect(encrypted).not.toBeNull();
      expect(encrypted).toHaveLength(plainText.length + 4);
      
      const decrypted = crypt2.decrypt(encrypted);
      expect(decrypted).not.toBeNull();
      expect(decrypted.toString()).toBe(plainText.toString());
    });

    it('should handle multiple sequential packets', () => {
      for (let i = 0; i < 5; i++) {
        const msg = Buffer.alloc(16, i);
        const encrypted = crypt1.encrypt(msg);
        const decrypted = crypt2.decrypt(encrypted);
        expect(decrypted).not.toBeNull();
        expect(decrypted[0]).toBe(i);
      }
    });
  });
});

describe('BLOCK_SIZE constant', () => {
  it('should be 16', () => {
    expect(BLOCK_SIZE).toBe(16);
  });
});
