/**
 * decoder-stream.js - Tests
 * 
 * Tests Transform stream that decodes Opus to PCM using worker pool:
 * - Worker pool management (reuse-pool)
 * - Transform stream protocol (objectMode)
 * - Decode worker communication
 * - EOF guards (critical safety feature)
 * - Packet loss handling (null frames)
 * - Reset/cleanup with finalization guards
 */

import { jest } from '@jest/globals';

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

// Mock to-arraybuffer
jest.unstable_mockModule('to-arraybuffer', () => ({
  default: jest.fn((buf) => {
    if (buf instanceof ArrayBuffer) return buf;
    if (buf.buffer instanceof ArrayBuffer) return buf.buffer;
    return new ArrayBuffer(0);
  })
}));

const DecoderStream = (await import('../../app/audio/decoder-stream.js')).default;

describe('DecoderStream - Initialization', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockWorkerInstances.length = 0;
  });

  test('creates objectMode Transform stream', () => {
    const mockWorker = new MockWorker();
    mockPool.get.mockReturnValue(mockWorker);
    
    const stream = new DecoderStream();
    
    expect(stream._readableState.objectMode).toBe(true);
    expect(stream._writableState.objectMode).toBe(true);
  });

  test('acquires worker from pool', () => {
    const mockWorker = new MockWorker();
    mockPool.get.mockReturnValue(mockWorker);
    
    new DecoderStream();
    
    expect(mockPool.get).toHaveBeenCalled();
  });

  test('initializes stream state flags', () => {
    const mockWorker = new MockWorker();
    mockPool.get.mockReturnValue(mockWorker);
    
    const stream = new DecoderStream();
    
    expect(stream._ended).toBe(false);
    expect(stream._finalized).toBe(false);
    expect(stream._finalCallback).toBe(null);
    expect(stream._messageId).toBe(0);
  });

  test('sets up worker message handler', () => {
    const mockWorker = new MockWorker();
    mockPool.get.mockReturnValue(mockWorker);
    
    const stream = new DecoderStream();
    
    expect(mockWorker.onmessage).toBeInstanceOf(Function);
  });
});

describe('DecoderStream - Transform', () => {
  let mockWorker;
  let stream;

  beforeEach(() => {
    jest.clearAllMocks();
    mockWorkerInstances.length = 0;
    mockWorker = new MockWorker();
    mockPool.get.mockReturnValue(mockWorker);
    stream = new DecoderStream();
  });

  test('transforms encoded chunk to worker message', (done) => {
    const frame = Buffer.from([0x01, 0x02, 0x03, 0x04]);
    const chunk = {
      codec: 'Opus',
      frame: frame,
      target: 31,
      position: 100
    };

    stream._transform(chunk, 'utf8', () => {
      expect(mockWorker.postMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'decodeOpus',
          target: 31,
          position: 100
        }),
        expect.any(Array) // Transferable ArrayBuffer
      );
      done();
    });
  });

  test('handles null frame (packet loss)', (done) => {
    const chunk = {
      codec: 'Opus',
      frame: null,
      target: 0,
      position: 100
    };

    stream._transform(chunk, 'utf8', () => {
      expect(mockWorker.postMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'decodeOpus',
          buffer: null,
          target: 0,
          position: 100
        })
      );
      done();
    });
  });

  test('transfers ArrayBuffer ownership to worker', (done) => {
    const frame = Buffer.from([0x01, 0x02]);
    const chunk = {
      codec: 'Opus',
      frame: frame,
      target: 0,
      position: 0
    };

    stream._transform(chunk, 'utf8', () => {
      const call = mockWorker.postMessage.mock.calls[0];
      expect(call[1]).toEqual([expect.any(ArrayBuffer)]);
      done();
    });
  });

  test('uses correct codec in action string', (done) => {
    const chunk = {
      codec: 'CELT',
      frame: Buffer.from([0x01]),
      target: 0,
      position: 0
    };

    stream._transform(chunk, 'utf8', () => {
      expect(mockWorker.postMessage).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'decodeCELT' }),
        expect.any(Array)
      );
      done();
    });
  });

  test('calls callback after posting to worker', (done) => {
    const chunk = {
      codec: 'Opus',
      frame: Buffer.from([0x01]),
      target: 0,
      position: 0
    };

    stream._transform(chunk, 'utf8', () => {
      expect(mockWorker.postMessage).toHaveBeenCalled();
      done();
    });
  });
});

describe('DecoderStream - Worker Messages', () => {
  let mockWorker;
  let stream;

  beforeEach(() => {
    jest.clearAllMocks();
    mockWorkerInstances.length = 0;
    mockWorker = new MockWorker();
    mockPool.get.mockReturnValue(mockWorker);
    stream = new DecoderStream();
  });

  test('pushes decoded PCM on data message', (done) => {
    const pcmBuffer = new Float32Array([0.1, 0.2, 0.3, 0.4]).buffer;
    
    stream.on('data', (chunk) => {
      expect(chunk).toEqual({
        target: 31,
        pcm: expect.any(Float32Array),
        numberOfChannels: 1,
        position: 200
      });
      expect(chunk.pcm.length).toBe(4);
      expect(chunk.pcm[0]).toBeCloseTo(0.1, 5);
      done();
    });

    mockWorker.onmessage({
      data: {
        action: 'decoded',
        buffer: pcmBuffer,
        target: 31,
        numberOfChannels: 1,
        position: 200
      }
    });
  });

  test('handles reset message', () => {
    const finalCallback = jest.fn();
    stream._finalCallback = finalCallback;

    mockWorker.onmessage({
      data: { action: 'reset' }
    });

    expect(finalCallback).toHaveBeenCalled();
    expect(stream._finalized).toBe(true);
  });

  test('prevents double finalization on reset', () => {
    const finalCallback = jest.fn();
    stream._finalCallback = finalCallback;

    // First reset
    mockWorker.onmessage({ data: { action: 'reset' } });
    expect(finalCallback).toHaveBeenCalledTimes(1);

    // Second reset should be ignored
    mockWorker.onmessage({ data: { action: 'reset' } });
    expect(finalCallback).toHaveBeenCalledTimes(1);
  });

  test('throws on unexpected message', () => {
    expect(() => {
      mockWorker.onmessage({
        data: { action: 'unknown' }
      });
    }).toThrow('unexpected message');
  });
});

describe('DecoderStream - EOF Guards', () => {
  let mockWorker;
  let stream;

  beforeEach(() => {
    jest.clearAllMocks();
    mockWorkerInstances.length = 0;
    mockWorker = new MockWorker();
    mockPool.get.mockReturnValue(mockWorker);
    stream = new DecoderStream();
  });

  test('ignores decoded messages after stream ended', () => {
    stream._ended = true;
    
    const pushSpy = jest.spyOn(stream, 'push');
    const pcmBuffer = new Float32Array([0.1, 0.2]).buffer;

    mockWorker.onmessage({
      data: {
        action: 'decoded',
        buffer: pcmBuffer,
        target: 0,
        numberOfChannels: 1,
        position: 0
      }
    });

    expect(pushSpy).not.toHaveBeenCalled();
  });

  test('ignores decoded messages if stream destroyed', () => {
    stream.destroy();
    
    const pushSpy = jest.spyOn(stream, 'push');
    const pcmBuffer = new Float32Array([0.1, 0.2]).buffer;

    mockWorker.onmessage({
      data: {
        action: 'decoded',
        buffer: pcmBuffer,
        target: 0,
        numberOfChannels: 1,
        position: 0
      }
    });

    expect(pushSpy).not.toHaveBeenCalled();
  });

  test('catches push errors when stream ended', (done) => {
    const consoleErrorSpy = jest.spyOn(console, 'log').mockImplementation();
    const pcmBuffer = new Float32Array([0.1, 0.2]).buffer;

    // End the stream
    stream.end(() => {
      // After stream ends, try to push data from worker
      // Should not throw
      expect(() => {
        mockWorker.onmessage({
          data: {
            action: 'decoded',
            buffer: pcmBuffer,
            target: 0,
            numberOfChannels: 1,
            position: 0
          }
        });
      }).not.toThrow();

      consoleErrorSpy.mockRestore();
      done();
    });

    // Simulate worker reset to complete end()
    mockWorker.onmessage({ data: { action: 'reset' } });
  });

  test('still processes reset after stream ended', () => {
    stream._ended = true;
    const finalCallback = jest.fn();
    stream._finalCallback = finalCallback;

    // Reset should still work even if stream ended
    mockWorker.onmessage({ data: { action: 'reset' } });

    expect(finalCallback).toHaveBeenCalled();
  });
});

describe('DecoderStream - Cleanup', () => {
  let mockWorker;
  let stream;

  beforeEach(() => {
    jest.clearAllMocks();
    mockWorkerInstances.length = 0;
    mockWorker = new MockWorker();
    mockPool.get.mockReturnValue(mockWorker);
    stream = new DecoderStream();
  });

  test('posts reset message on stream end', () => {
    stream._final(() => {});
    
    expect(mockWorker.postMessage).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'reset' })
    );
  });

  test('sets _ended flag', () => {
    stream._final(() => {});
    
    expect(stream._ended).toBe(true);
  });

  test('waits for worker reset before final callback', () => {
    const finalCallback = jest.fn();
    stream._final(finalCallback);

    // Callback should not be called yet
    expect(finalCallback).not.toHaveBeenCalled();

    // Simulate worker reset response
    mockWorker.onmessage({ data: { action: 'reset' } });

    // Now callback should be called
    expect(finalCallback).toHaveBeenCalled();
  });

  test('recycles worker after reset', () => {
    const finalCallback = jest.fn();
    stream._final(finalCallback);

    mockWorker.onmessage({ data: { action: 'reset' } });

    expect(mockPool.recycle).toHaveBeenCalledWith(mockWorker);
    expect(stream._worker).toBe(null);
  });

  test('handles missing worker gracefully', () => {
    stream._worker = null;
    const finalCallback = jest.fn();

    stream._final(finalCallback);

    expect(finalCallback).toHaveBeenCalled();
  });

  test('handles worker postMessage error', () => {
    mockWorker.postMessage.mockImplementation(() => {
      throw new Error('Worker terminated');
    });

    const finalCallback = jest.fn();
    stream._final(finalCallback);

    // Should call finalCallback immediately on error
    expect(finalCallback).toHaveBeenCalled();
  });

  test('increments message ID on reset', () => {
    stream._messageId = 5;
    stream._final(() => {});

    expect(mockWorker.postMessage).toHaveBeenCalledWith(
      expect.objectContaining({ id: 5 })
    );
    expect(stream._messageId).toBe(6);
  });
});

describe('DecoderStream - Integration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockWorkerInstances.length = 0;
  });

  test('decodes multiple chunks sequentially', () => {
    const mockWorker = new MockWorker();
    mockPool.get.mockReturnValue(mockWorker);
    
    const stream = new DecoderStream();
    const results = [];

    stream.on('data', (chunk) => {
      results.push(chunk);
    });

    // Write 3 encoded chunks
    stream.write({ codec: 'Opus', frame: Buffer.from([0x01]), target: 0, position: 0 });
    stream.write({ codec: 'Opus', frame: Buffer.from([0x02]), target: 0, position: 960 });
    stream.write({ codec: 'Opus', frame: Buffer.from([0x03]), target: 0, position: 1920 });

    // Simulate worker responses
    mockWorker.onmessage({ data: { action: 'decoded', buffer: new Float32Array(960).buffer, target: 0, numberOfChannels: 1, position: 0 } });
    mockWorker.onmessage({ data: { action: 'decoded', buffer: new Float32Array(960).buffer, target: 0, numberOfChannels: 1, position: 960 } });
    mockWorker.onmessage({ data: { action: 'decoded', buffer: new Float32Array(960).buffer, target: 0, numberOfChannels: 1, position: 1920 } });

    expect(results.length).toBe(3);
    expect(results[0].position).toBe(0);
    expect(results[1].position).toBe(960);
    expect(results[2].position).toBe(1920);
    expect(results[0].pcm).toBeInstanceOf(Float32Array);
    expect(mockWorker.postMessage).toHaveBeenCalledTimes(3);
  });

  test('handles mixed valid frames and packet loss', () => {
    const mockWorker = new MockWorker();
    mockPool.get.mockReturnValue(mockWorker);
    
    const stream = new DecoderStream();
    const results = [];

    stream.on('data', (chunk) => {
      results.push(chunk);
    });

    // Write chunks with packet loss (null frame)
    stream.write({ codec: 'Opus', frame: Buffer.from([0x01]), target: 0, position: 0 });
    stream.write({ codec: 'Opus', frame: null, target: 0, position: 960 }); // Packet loss
    stream.write({ codec: 'Opus', frame: Buffer.from([0x03]), target: 0, position: 1920 });

    // Worker responses (including PLC for null frame)
    mockWorker.onmessage({ data: { action: 'decoded', buffer: new Float32Array(960).buffer, target: 0, numberOfChannels: 1, position: 0 } });
    mockWorker.onmessage({ data: { action: 'decoded', buffer: new Float32Array(960).buffer, target: 0, numberOfChannels: 1, position: 960 } });
    mockWorker.onmessage({ data: { action: 'decoded', buffer: new Float32Array(960).buffer, target: 0, numberOfChannels: 1, position: 1920 } });

    expect(results.length).toBe(3);
    // Second chunk should have null frame in input but still produce output (PLC)
    const nullFrameCall = mockWorker.postMessage.mock.calls[1][0];
    expect(nullFrameCall.buffer).toBe(null);
  });
});

describe('DecoderStream - Worker Error Handling', () => {
  let mockWorker;
  let stream;

  beforeEach(() => {
    jest.clearAllMocks();
    mockWorkerInstances.length = 0;
    mockWorker = new MockWorker();
    mockPool.get.mockReturnValue(mockWorker);
    stream = new DecoderStream();
  });

  test('handles worker postMessage error in _final', (done) => {
    // Make postMessage throw an error (worker terminated)
    mockWorker.postMessage.mockImplementation(() => {
      throw new Error('Worker terminated');
    });

    stream.end(() => {
      // Should still complete cleanup
      expect(mockPool.recycle).toHaveBeenCalledWith(mockWorker);
      done();
    });
  });
});
