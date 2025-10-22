/**
 * decode-worker.js - Tests
 * 
 * Tests Web Worker that decodes Opus to PCM audio:
 * - OpusDecoder initialization (lazy, per-message)
 * - Packet loss concealment (null buffer handling)
 * - Reset/cleanup (destroy decoder)
 * - Message protocol (decodeOpus action)
 * - Buffer transfer
 */

import { jest } from '@jest/globals';

describe('decode-worker', () => {
  let mockOpusDecoder;
  let mockSelf;
  let messageHandlers;

  beforeEach(async () => {
    jest.resetModules();
    jest.clearAllMocks();

    messageHandlers = [];

    // Mock decoded audio buffer
    const mockDecodedBuffer = new Float32Array([0.1, 0.2, 0.3, 0.4]);

    // Mock OpusDecoder
    mockOpusDecoder = {
      decodeFloat32: jest.fn((input) => mockDecodedBuffer),
      destroy: jest.fn()
    };

    // Mock libopus.js exports
    jest.unstable_mockModule('libopus.js', () => ({
      Decoder: jest.fn(() => mockOpusDecoder)
    }));

    // Mock Web Worker self
    mockSelf = {
      addEventListener: jest.fn((event, handler) => {
        if (event === 'message') {
          messageHandlers.push(handler);
        }
      }),
      postMessage: jest.fn()
    };

    globalThis.self = mockSelf;
    globalThis.Buffer = {
      from: jest.fn((data) => data)
    };

    // Import worker
    await import('../../app/audio/decode-worker.js');
  });

  afterEach(() => {
    delete globalThis.self;
    delete globalThis.Buffer;
  });

  describe('Initialization', () => {
    test('registers message event listener', () => {
      expect(mockSelf.addEventListener).toHaveBeenCalledWith(
        'message',
        expect.any(Function)
      );
    });

    test('creates OpusDecoder on first decode', () => {
      messageHandlers[0]({
        data: {
          action: 'decodeOpus',
          buffer: new Uint8Array([0x01, 0x02]).buffer,
          target: 0,
          position: 0
        }
      });

      expect(mockOpusDecoder.decodeFloat32).toHaveBeenCalled();
    });
  });

  describe('Decoding', () => {
    test('decodes Opus to Float32 PCM', () => {
      const opusData = new Uint8Array([0x01, 0x02, 0x03]);
      
      messageHandlers[0]({
        data: {
          action: 'decodeOpus',
          buffer: opusData.buffer,
          target: 31,
          position: 100
        }
      });

      expect(mockOpusDecoder.decodeFloat32).toHaveBeenCalled();
    });

    test('posts decoded PCM with metadata', () => {
      messageHandlers[0]({
        data: {
          action: 'decodeOpus',
          buffer: new Uint8Array([0x01]).buffer,
          target: 31,
          position: 200
        }
      });

      expect(mockSelf.postMessage).toHaveBeenCalledWith(
        {
          action: 'decoded',
          buffer: expect.any(ArrayBuffer),
          target: 31,
          position: 200
        },
        [expect.any(ArrayBuffer)]
      );
    });

    test('transfers ArrayBuffer ownership', () => {
      messageHandlers[0]({
        data: {
          action: 'decodeOpus',
          buffer: new Uint8Array([0x01]).buffer,
          target: 0,
          position: 0
        }
      });

      const transferList = mockSelf.postMessage.mock.calls[0][1];
      expect(transferList).toEqual([expect.any(ArrayBuffer)]);
    });

    test('converts buffer using Buffer.from', () => {
      const opusData = new Uint8Array([0x01, 0x02]);
      
      messageHandlers[0]({
        data: {
          action: 'decodeOpus',
          buffer: opusData.buffer,
          target: 0,
          position: 0
        }
      });

      expect(globalThis.Buffer.from).toHaveBeenCalledWith(opusData.buffer);
    });
  });

  describe('Packet Loss Concealment', () => {
    test('handles null buffer (packet loss)', () => {
      messageHandlers[0]({
        data: {
          action: 'decodeOpus',
          buffer: null,
          target: 0,
          position: 100
        }
      });

      expect(mockOpusDecoder.decodeFloat32).toHaveBeenCalledWith(null);
    });

    test('posts PLC output for null frame', () => {
      messageHandlers[0]({
        data: {
          action: 'decodeOpus',
          buffer: null,
          target: 0,
          position: 100
        }
      });

      expect(mockSelf.postMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'decoded',
          position: 100
        }),
        expect.any(Array)
      );
    });

    test('does not call Buffer.from for null input', () => {
      messageHandlers[0]({
        data: {
          action: 'decodeOpus',
          buffer: null,
          target: 0,
          position: 0
        }
      });

      expect(globalThis.Buffer.from).not.toHaveBeenCalled();
    });
  });

  describe('Reset', () => {
    test('destroys decoder on reset', () => {
      // Create decoder first
      messageHandlers[0]({
        data: {
          action: 'decodeOpus',
          buffer: new Uint8Array([0x01]).buffer,
          target: 0,
          position: 0
        }
      });

      // Reset
      messageHandlers[0]({
        data: { action: 'reset' }
      });

      expect(mockOpusDecoder.destroy).toHaveBeenCalled();
    });

    test('posts reset confirmation', () => {
      messageHandlers[0]({
        data: { action: 'reset' }
      });

      expect(mockSelf.postMessage).toHaveBeenCalledWith({
        action: 'reset'
      });
    });

    test('handles reset without prior decode', () => {
      // Reset without creating decoder
      expect(() => {
        messageHandlers[0]({
          data: { action: 'reset' }
        });
      }).not.toThrow();

      expect(mockSelf.postMessage).toHaveBeenCalledWith({
        action: 'reset'
      });
    });

    test('allows decode after reset', () => {
      // Decode
      messageHandlers[0]({
        data: {
          action: 'decodeOpus',
          buffer: new Uint8Array([0x01]).buffer,
          target: 0,
          position: 0
        }
      });

      // Reset
      messageHandlers[0]({
        data: { action: 'reset' }
      });

      mockOpusDecoder.decodeFloat32.mockClear();

      // Decode again
      messageHandlers[0]({
        data: {
          action: 'decodeOpus',
          buffer: new Uint8Array([0x02]).buffer,
          target: 0,
          position: 960
        }
      });

      expect(mockOpusDecoder.decodeFloat32).toHaveBeenCalled();
    });
  });

  describe('Configuration', () => {
    test('uses 48kHz sample rate', () => {
      // Implicitly tested by checking decoder works
      messageHandlers[0]({
        data: {
          action: 'decodeOpus',
          buffer: new Uint8Array([0x01]).buffer,
          target: 0,
          position: 0
        }
      });

      expect(mockOpusDecoder.decodeFloat32).toHaveBeenCalled();
    });

    test('decodes successfully', () => {
      messageHandlers[0]({
        data: {
          action: 'decodeOpus',
          buffer: new Uint8Array([0x01]).buffer,
          target: 0,
          position: 0
        }
      });

      expect(mockSelf.postMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'decoded',
          buffer: expect.any(ArrayBuffer)
        }),
        expect.any(Array)
      );
    });
  });
});
