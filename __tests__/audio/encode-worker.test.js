/**
 * encode-worker.js - Tests
 * 
 * Tests Web Worker that encodes PCM audio to Opus:
 * - OpusEncoder initialization (lazy, per-message)
 * - Bitrate control (OPUS_SET_BITRATE)
 * - Reset/cleanup (destroy encoder)
 * - Message protocol (encodeOpus action)
 * - Buffer transfer
 */

import { jest } from '@jest/globals';

describe('encode-worker', () => {
  let mockOpusEncoder;
  let mockLibopus;
  let mockSelf;
  let messageHandlers;

  beforeEach(async () => {
    jest.resetModules();
    jest.clearAllMocks();

    messageHandlers = [];

    // Mock OpusEncoder
    mockOpusEncoder = {
      _state: 0x12345678, // Mock encoder state pointer
      encode: jest.fn((pcm) => Buffer.from([0x01, 0x02, 0x03])),
      destroy: jest.fn()
    };

    // Mock libopus
    mockLibopus = {
      _malloc: jest.fn(() => 0x1000), // Mock memory address
      _free: jest.fn(),
      _opus_encoder_ctl: jest.fn(() => 0), // Success
      _opus_strerror: jest.fn(() => 0),
      Pointer_stringify: jest.fn((ptr) => 'Error'),
      HEAP32: new Int32Array(1024)
    };

    // Mock libopus.js exports
    jest.unstable_mockModule('libopus.js', () => ({
      Encoder: jest.fn(() => mockOpusEncoder),
      libopus: mockLibopus
    }));

    // Mock to-arraybuffer-lite (our local implementation)
    jest.unstable_mockModule('../../app/utils/to-arraybuffer-lite.js', () => ({
      default: jest.fn((buf) => {
        if (buf instanceof ArrayBuffer) return buf;
        if (buf.buffer instanceof ArrayBuffer) return buf.buffer;
        return new ArrayBuffer(0);
      })
    }));

    // Mock Web Worker environment on globalThis
    jest.spyOn(globalThis, 'addEventListener').mockImplementation((event, handler) => {
      if (event === 'message') {
        messageHandlers.push(handler);
      }
    });
    jest.spyOn(globalThis, 'postMessage').mockImplementation(jest.fn());

    // For backward compatibility with tests using mockSelf
    mockSelf = {
      addEventListener: globalThis.addEventListener,
      postMessage: globalThis.postMessage
    };

    // Import the worker code
    await import('../../app/audio/encode-worker.js');
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  afterEach(() => {
    delete globalThis.self;
  });

  describe('Initialization', () => {
    test('registers message event listener', () => {
      expect(mockSelf.addEventListener).toHaveBeenCalledWith(
        'message',
        expect.any(Function)
      );
    });

    test('creates OpusEncoder on first encode with correct config', () => {
      // First encode triggers encoder creation
      messageHandlers[0]({
        data: {
          action: 'encodeOpus',
          buffer: new Float32Array([0.1, 0.2]).buffer,
          numberOfChannels: 2,
          bitrate: 40000,
          target: 0,
          position: 0
        }
      });

      // Encoder should have been created and used
      expect(mockOpusEncoder.encode).toHaveBeenCalled();
    });
  });

  describe('Encoding', () => {
    test('encodes PCM to Opus', () => {
      const pcmData = new Float32Array([0.1, 0.2, 0.3, 0.4]);
      
      messageHandlers[0]({
        data: {
          action: 'encodeOpus',
          buffer: pcmData.buffer,
          numberOfChannels: 1,
          bitrate: 40000,
          target: 31,
          position: 100
        }
      });

      expect(mockOpusEncoder.encode).toHaveBeenCalledWith(
        expect.any(Float32Array)
      );
      
      const encodedArg = mockOpusEncoder.encode.mock.calls[0][0];
      expect(encodedArg.length).toBe(4);
    });

    test('posts encoded data with metadata', () => {
      messageHandlers[0]({
        data: {
          action: 'encodeOpus',
          buffer: new Float32Array([0.1]).buffer,
          numberOfChannels: 1,
          bitrate: 40000,
          target: 31,
          position: 200
        }
      });

      expect(mockSelf.postMessage).toHaveBeenCalledWith(
        {
          target: 31,
          buffer: expect.any(ArrayBuffer),
          position: 200
        },
        [expect.any(ArrayBuffer)]
      );
    });

    test('transfers ArrayBuffer ownership', () => {
      messageHandlers[0]({
        data: {
          action: 'encodeOpus',
          buffer: new Float32Array([0.1]).buffer,
          numberOfChannels: 1,
          bitrate: 40000,
          target: 0,
          position: 0
        }
      });

      const transferList = mockSelf.postMessage.mock.calls[0][1];
      expect(transferList).toEqual([expect.any(ArrayBuffer)]);
    });
  });

  describe('Bitrate Control', () => {
    test('sets bitrate on first encode', () => {
      messageHandlers[0]({
        data: {
          action: 'encodeOpus',
          buffer: new Float32Array([0.1]).buffer,
          numberOfChannels: 1,
          bitrate: 64000,
          target: 0,
          position: 0
        }
      });

      expect(mockLibopus._opus_encoder_ctl).toHaveBeenCalledWith(
        mockOpusEncoder._state,
        4002, // OPUS_SET_BITRATE
        expect.any(Number) // Memory address
      );
    });

    test('updates bitrate when changed', () => {
      // First encode with bitrate 40000
      messageHandlers[0]({
        data: {
          action: 'encodeOpus',
          buffer: new Float32Array([0.1]).buffer,
          numberOfChannels: 1,
          bitrate: 40000,
          target: 0,
          position: 0
        }
      });

      mockLibopus._opus_encoder_ctl.mockClear();

      // Second encode with different bitrate
      messageHandlers[0]({
        data: {
          action: 'encodeOpus',
          buffer: new Float32Array([0.2]).buffer,
          numberOfChannels: 1,
          bitrate: 64000,
          target: 0,
          position: 960
        }
      });

      expect(mockLibopus._opus_encoder_ctl).toHaveBeenCalled();
    });

    test('does not update bitrate when unchanged', () => {
      // First encode
      messageHandlers[0]({
        data: {
          action: 'encodeOpus',
          buffer: new Float32Array([0.1]).buffer,
          numberOfChannels: 1,
          bitrate: 40000,
          target: 0,
          position: 0
        }
      });

      mockLibopus._opus_encoder_ctl.mockClear();

      // Second encode with same bitrate
      messageHandlers[0]({
        data: {
          action: 'encodeOpus',
          buffer: new Float32Array([0.2]).buffer,
          numberOfChannels: 1,
          bitrate: 40000,
          target: 0,
          position: 960
        }
      });

      expect(mockLibopus._opus_encoder_ctl).not.toHaveBeenCalled();
    });

    test('frees allocated memory after bitrate set', () => {
      messageHandlers[0]({
        data: {
          action: 'encodeOpus',
          buffer: new Float32Array([0.1]).buffer,
          numberOfChannels: 1,
          bitrate: 40000,
          target: 0,
          position: 0
        }
      });

      expect(mockLibopus._free).toHaveBeenCalledWith(0x1000);
    });

    test('handles bitrate set error', () => {
      mockLibopus._opus_encoder_ctl.mockReturnValue(-1); // Error

      expect(() => {
        messageHandlers[0]({
          data: {
            action: 'encodeOpus',
            buffer: new Float32Array([0.1]).buffer,
            numberOfChannels: 1,
            bitrate: 40000,
            target: 0,
            position: 0
          }
        });
      }).toThrow();
    });
  });

  describe('Reset', () => {
    test('destroys encoder on reset', () => {
      // Create encoder first
      messageHandlers[0]({
        data: {
          action: 'encodeOpus',
          buffer: new Float32Array([0.1]).buffer,
          numberOfChannels: 1,
          bitrate: 40000,
          target: 0,
          position: 0
        }
      });

      // Reset
      messageHandlers[0]({
        data: { action: 'reset' }
      });

      expect(mockOpusEncoder.destroy).toHaveBeenCalled();
    });

    test('posts reset confirmation', () => {
      messageHandlers[0]({
        data: { action: 'reset' }
      });

      expect(mockSelf.postMessage).toHaveBeenCalledWith({ reset: true });
    });

    test('clears bitrate on reset', () => {
      // Encode with bitrate
      messageHandlers[0]({
        data: {
          action: 'encodeOpus',
          buffer: new Float32Array([0.1]).buffer,
          numberOfChannels: 1,
          bitrate: 40000,
          target: 0,
          position: 0
        }
      });

      // Reset
      messageHandlers[0]({
        data: { action: 'reset' }
      });

      mockLibopus._opus_encoder_ctl.mockClear();

      // Encode again with same bitrate - should set it again
      messageHandlers[0]({
        data: {
          action: 'encodeOpus',
          buffer: new Float32Array([0.2]).buffer,
          numberOfChannels: 1,
          bitrate: 40000,
          target: 0,
          position: 0
        }
      });

      expect(mockLibopus._opus_encoder_ctl).toHaveBeenCalled();
    });
  });
});
