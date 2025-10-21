/**
 * encoder-stream.js - Tests
 * 
 * Tests Transform stream that encodes PCM audio to Opus using worker pool:
 * - Worker pool management (reuse-pool)
 * - Transform stream protocol (objectMode)
 * - Encode worker communication
 * - Buffer transfer ownership
 * - Reset/cleanup handling
 */

import { jest } from '@jest/globals';
import { Readable, Writable } from 'stream';

// Mock Worker before importing module
const mockWorkerInstances = [];
class MockWorker {
  constructor(url, options) {
    this.url = url;
    this.options = options;
    this.onmessage = null;
    this.postMessage = jest.fn();
    mockWorkerInstances.push(this);
  }
}
global.Worker = MockWorker;

// Mock reuse-pool
const mockPool = {
  get: jest.fn(),
  recycle: jest.fn()
};
jest.unstable_mockModule('reuse-pool', () => ({
  default: jest.fn(() => mockPool)
}));

const EncoderStream = (await import('../../app/audio/encoder-stream.js')).default;

describe('EncoderStream - Initialization', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockWorkerInstances.length = 0;
  });

  test('creates objectMode Transform stream', () => {
    const mockWorker = new MockWorker();
    mockPool.get.mockReturnValue(mockWorker);
    
    const stream = new EncoderStream('Opus');
    
    expect(stream._readableState.objectMode).toBe(true);
    expect(stream._writableState.objectMode).toBe(true);
  });

  test('stores codec type', () => {
    const mockWorker = new MockWorker();
    mockPool.get.mockReturnValue(mockWorker);
    
    const stream = new EncoderStream('Opus');
    
    expect(stream._codec).toBe('Opus');
  });

  test('acquires worker from pool', () => {
    const mockWorker = new MockWorker();
    mockPool.get.mockReturnValue(mockWorker);
    
    new EncoderStream('Opus');
    
    expect(mockPool.get).toHaveBeenCalled();
  });

  test('sets up worker message handler', () => {
    const mockWorker = new MockWorker();
    mockPool.get.mockReturnValue(mockWorker);
    
    const stream = new EncoderStream('Opus');
    
    expect(mockWorker.onmessage).toBeInstanceOf(Function);
  });
});

describe('EncoderStream - Transform', () => {
  let mockWorker;
  let stream;

  beforeEach(() => {
    jest.clearAllMocks();
    mockWorkerInstances.length = 0;
    mockWorker = new MockWorker();
    mockPool.get.mockReturnValue(mockWorker);
    stream = new EncoderStream('Opus');
  });

  test('transforms PCM chunk to worker message', (done) => {
    const pcm = new Float32Array([0.1, 0.2, 0.3, 0.4]);
    const chunk = {
      pcm: pcm,
      target: 31,
      numberOfChannels: 1,
      bitrate: 40000,
      position: 100
    };

    stream._transform(chunk, 'utf8', () => {
      expect(mockWorker.postMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'encodeOpus',
          target: 31,
          numberOfChannels: 1,
          bitrate: 40000,
          position: 100
        }),
        expect.any(Array) // Transferable ArrayBuffer
      );
      done();
    });
  });

  test('transfers ArrayBuffer ownership to worker', (done) => {
    const pcm = new Float32Array([0.1, 0.2]);
    const chunk = {
      pcm: pcm,
      target: 0,
      numberOfChannels: 1,
      bitrate: 40000,
      position: 0
    };

    stream._transform(chunk, 'utf8', () => {
      const call = mockWorker.postMessage.mock.calls[0];
      expect(call[1]).toEqual([expect.any(ArrayBuffer)]);
      done();
    });
  });

  test('calls callback after posting to worker', (done) => {
    const chunk = {
      pcm: new Float32Array([0.1]),
      target: 0,
      numberOfChannels: 1,
      bitrate: 40000,
      position: 0
    };

    stream._transform(chunk, 'utf8', () => {
      expect(mockWorker.postMessage).toHaveBeenCalled();
      done();
    });
  });

  test('uses correct codec in action string', (done) => {
    const stream = new EncoderStream('CELT');
    const mockWorker2 = new MockWorker();
    mockPool.get.mockReturnValue(mockWorker2);
    stream._worker = mockWorker2;

    const chunk = {
      pcm: new Float32Array([0.1]),
      target: 0,
      numberOfChannels: 1,
      bitrate: 40000,
      position: 0
    };

    stream._transform(chunk, 'utf8', () => {
      expect(mockWorker2.postMessage).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'encodeCELT' }),
        expect.any(Array)
      );
      done();
    });
  });
});

describe('EncoderStream - Worker Messages', () => {
  let mockWorker;
  let stream;

  beforeEach(() => {
    jest.clearAllMocks();
    mockWorkerInstances.length = 0;
    mockWorker = new MockWorker();
    mockPool.get.mockReturnValue(mockWorker);
    stream = new EncoderStream('Opus');
  });

  test('pushes encoded frame on data message', (done) => {
    const encodedData = new ArrayBuffer(100);
    
    stream.on('data', (chunk) => {
      expect(chunk).toEqual({
        target: 31,
        codec: 'Opus',
        frame: expect.any(Buffer),
        position: 200
      });
      expect(chunk.frame.length).toBe(50);
      done();
    });

    mockWorker.onmessage({
      data: {
        buffer: encodedData,
        byteOffset: 10,
        byteLength: 50,
        target: 31,
        position: 200
      }
    });
  });

  test('creates Buffer with correct slice', (done) => {
    const encodedData = new ArrayBuffer(100);
    
    stream.on('data', (chunk) => {
      // Buffer.from should use byteOffset and byteLength
      expect(chunk.frame).toBeInstanceOf(Buffer);
      done();
    });

    mockWorker.onmessage({
      data: {
        buffer: encodedData,
        byteOffset: 20,
        byteLength: 30,
        target: 0,
        position: 0
      }
    });
  });

  test('recycles worker on reset message', (done) => {
    const finalCallback = jest.fn(() => {
      expect(mockPool.recycle).toHaveBeenCalledWith(mockWorker);
      expect(finalCallback).toHaveBeenCalled();
      done();
    });

    stream._finalCallback = finalCallback;

    mockWorker.onmessage({
      data: { reset: true }
    });
  });
});

describe('EncoderStream - Cleanup', () => {
  let mockWorker;
  let stream;

  beforeEach(() => {
    jest.clearAllMocks();
    mockWorkerInstances.length = 0;
    mockWorker = new MockWorker();
    mockPool.get.mockReturnValue(mockWorker);
    stream = new EncoderStream('Opus');
  });

  test('posts reset message on stream end', (done) => {
    stream._final(() => {
      done();
    });
    
    expect(mockWorker.postMessage).toHaveBeenCalledWith({ action: 'reset' });
    
    // Simulate worker reset to trigger callback
    mockWorker.onmessage({ data: { reset: true } });
  });

  test('waits for worker reset before final callback', (done) => {
    const finalCallback = jest.fn();
    stream._final(finalCallback);

    // Callback should not be called yet
    expect(finalCallback).not.toHaveBeenCalled();

    // Simulate worker reset response
    mockWorker.onmessage({ data: { reset: true } });

    // Now callback should be called
    setTimeout(() => {
      expect(finalCallback).toHaveBeenCalled();
      done();
    }, 10);
  });
});

describe('EncoderStream - Integration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockWorkerInstances.length = 0;
  });

  test('encodes multiple chunks sequentially', () => {
    const mockWorker = new MockWorker();
    mockPool.get.mockReturnValue(mockWorker);
    
    const stream = new EncoderStream('Opus');
    const results = [];

    stream.on('data', (chunk) => {
      results.push(chunk);
    });

    // Write 3 chunks
    stream.write({ pcm: new Float32Array(960), target: 0, numberOfChannels: 1, bitrate: 40000, position: 0 });
    stream.write({ pcm: new Float32Array(960), target: 0, numberOfChannels: 1, bitrate: 40000, position: 960 });
    stream.write({ pcm: new Float32Array(960), target: 0, numberOfChannels: 1, bitrate: 40000, position: 1920 });

    // Simulate worker responses
    mockWorker.onmessage({ data: { buffer: new ArrayBuffer(50), byteOffset: 0, byteLength: 50, target: 0, position: 0 } });
    mockWorker.onmessage({ data: { buffer: new ArrayBuffer(50), byteOffset: 0, byteLength: 50, target: 0, position: 960 } });
    mockWorker.onmessage({ data: { buffer: new ArrayBuffer(50), byteOffset: 0, byteLength: 50, target: 0, position: 1920 } });

    expect(results.length).toBe(3);
    expect(results[0].position).toBe(0);
    expect(results[1].position).toBe(960);
    expect(results[2].position).toBe(1920);
    expect(mockWorker.postMessage).toHaveBeenCalledTimes(3);
  });
});
