/**
 * codecs-browser.js - Tests
 * 
 * Tests codec utility functions:
 * - Opus support flag
 * - Duration calculation
 * - Stream factory functions
 */

import { jest } from '@jest/globals';

// Mock dependencies
jest.unstable_mockModule('libopus.js', () => ({
  Decoder: {
    getNumberOfSamples: jest.fn((buffer, sampleRate) => 480), // 10ms @ 48kHz
  }
}));

jest.unstable_mockModule('../../app/audio/decoder-stream.js', () => ({
  default: jest.fn(function DecoderStream() {
    this.name = 'DecoderStream';
  })
}));

jest.unstable_mockModule('../../app/audio/encoder-stream.js', () => ({
  default: jest.fn(function EncoderStream(codec) {
    this.codec = codec;
    this.name = 'EncoderStream';
  })
}));

const codecsModule = await import('../../app/audio/codecs-browser.js');

describe('codecs-browser - Opus Support', () => {
  test('opus flag is true', () => {
    expect(codecsModule.opus).toBe(true);
  });
});

describe('codecs-browser - Duration Calculation', () => {
  test('getDuration calculates Opus duration correctly', () => {
    const buffer = new ArrayBuffer(8);
    const duration = codecsModule.getDuration('Opus', buffer);
    
    // 480 samples / 48 = 10ms
    expect(duration).toBe(10);
  });

  test('getDuration returns default for non-Opus codec', () => {
    const buffer = new ArrayBuffer(8);
    const duration = codecsModule.getDuration('Unknown', buffer);
    
    expect(duration).toBe(10);
  });

  test('getDuration calls OpusDecoder.getNumberOfSamples', async () => {
    const { Decoder } = await import('libopus.js');
    const buffer = new ArrayBuffer(8);
    
    codecsModule.getDuration('Opus', buffer);
    
    expect(Decoder.getNumberOfSamples).toHaveBeenCalledWith(buffer, 48000);
  });
});

describe('codecs-browser - Stream Factories', () => {
  test('createDecoderStream returns DecoderStream instance', async () => {
    const DecoderStream = (await import('../../app/audio/decoder-stream.js')).default;
    DecoderStream.mockClear();
    
    const stream = codecsModule.createDecoderStream({ id: 1, name: 'User' });
    
    expect(DecoderStream).toHaveBeenCalled();
    expect(stream.name).toBe('DecoderStream');
  });

  test('createEncoderStream returns EncoderStream instance', async () => {
    const EncoderStream = (await import('../../app/audio/encoder-stream.js')).default;
    EncoderStream.mockClear();
    
    const stream = codecsModule.createEncoderStream('Opus');
    
    expect(EncoderStream).toHaveBeenCalledWith('Opus');
    expect(stream.codec).toBe('Opus');
    expect(stream.name).toBe('EncoderStream');
  });

  test('createDecoderStream accepts user parameter', async () => {
    const DecoderStream = (await import('../../app/audio/decoder-stream.js')).default;
    DecoderStream.mockClear();
    
    const user = { id: 123, name: 'TestUser' };
    const stream = codecsModule.createDecoderStream(user);
    
    // User parameter is accepted but not used in current implementation
    expect(DecoderStream).toHaveBeenCalled();
  });
});
