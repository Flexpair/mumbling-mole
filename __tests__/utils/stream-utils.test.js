/**
 * Utils Stream Tests
 * 
 * Tests for lightweight stream utilities:
 * - websocket-stream-lite
 * - duplexer-lite
 * - through2-lite
 * - chunker-lite
 * - to-arraybuffer-lite
 * - drop-stream
 * - stats-lite
 */
import { jest, describe, it, expect, beforeEach } from '@jest/globals';
import { Writable, PassThrough } from 'node:stream';

// Import the modules under test
import websocketStream from '../../app/utils/websocket-stream-lite.js';
import duplexer from '../../app/utils/duplexer-lite.js';
import through2 from '../../app/utils/through2-lite.js';
import chunker from '../../app/utils/chunker-lite.js';
import toArrayBuffer from '../../app/utils/to-arraybuffer-lite.js';
import DropStream from '../../app/utils/drop-stream.js';
import Stats from '../../app/utils/stats-lite.js';

describe('websocket-stream-lite', () => {
  let mockSocket;

  beforeEach(() => {
    mockSocket = {
      send: jest.fn(),
      close: jest.fn(),
      readyState: 1, // WebSocket.OPEN
      binaryType: 'blob',
      onopen: null,
      onclose: null,
      onmessage: null,
      onerror: null,
    };
    
    // Mock WebSocket constructor
    globalThis.WebSocket = jest.fn(() => mockSocket);
    globalThis.WebSocket.OPEN = 1;
    globalThis.WebSocket.CONNECTING = 0;
    globalThis.WebSocket.CLOSING = 2;
    globalThis.WebSocket.CLOSED = 3;
  });

  it('should create stream from WebSocket URL', () => {
    const stream = websocketStream('wss://example.com');
    
    expect(globalThis.WebSocket).toHaveBeenCalledWith('wss://example.com', undefined);
    expect(stream).toBeDefined();
    expect(stream.socket).toBe(mockSocket);
  });

  it('should create stream from existing WebSocket', () => {
    const existingSocket = { send: jest.fn(), readyState: 1 };
    const stream = websocketStream(existingSocket);
    
    expect(stream.socket).toBe(existingSocket);
  });

  it('should set binaryType to arraybuffer for new sockets', () => {
    websocketStream('wss://example.com');
    
    expect(mockSocket.binaryType).toBe('arraybuffer');
  });

  it('should handle protocols parameter', () => {
    websocketStream('wss://example.com', ['proto1', 'proto2']);
    
    expect(globalThis.WebSocket).toHaveBeenCalledWith('wss://example.com', ['proto1', 'proto2']);
  });

  it('should handle options object as second parameter', () => {
    websocketStream('wss://example.com', { protocol: 'mumble' });
    
    expect(globalThis.WebSocket).toHaveBeenCalledWith('wss://example.com', 'mumble');
  });

  it('should send data through write()', (done) => {
    // Create stream from existing socket to ensure it's already OPEN
    const existingSocket = {
      send: jest.fn(),
      close: jest.fn(),
      readyState: 1, // OPEN
      onmessage: null,
      onerror: null,
      onclose: null,
      onopen: null,
    };
    
    const stream = websocketStream(existingSocket);
    const data = Buffer.from([1, 2, 3, 4]);
    
    stream.write(data, null, (err) => {
      expect(err).toBeFalsy(); // null or undefined means no error
      expect(existingSocket.send).toHaveBeenCalled();
      done();
    });
  });

  it('should error on write when socket not open', (done) => {
    mockSocket.readyState = 3; // CLOSED
    const stream = websocketStream('wss://example.com');
    
    // Need to handle error event to prevent unhandled error
    stream.on('error', () => {
      // Expected - the error will be passed to write callback
    });
    
    stream.write(Buffer.from([1, 2, 3]), null, (err) => {
      expect(err).toBeInstanceOf(Error);
      expect(err.message).toContain('not open');
      done();
    });
  });

  it('should push data on message', (done) => {
    const stream = websocketStream('wss://example.com');
    
    stream.on('data', (chunk) => {
      expect(Buffer.isBuffer(chunk)).toBe(true);
      done();
    });
    
    // Simulate incoming message
    mockSocket.onmessage({ data: new ArrayBuffer(4) });
  });

  it('should emit connect on socket open', (done) => {
    const stream = websocketStream('wss://example.com');
    
    stream.on('connect', () => {
      expect(stream.destroyed).toBe(false);
      done();
    });
    
    mockSocket.onopen();
  });

  it('should emit connect immediately for already-open socket', (done) => {
    mockSocket.readyState = 1; // Already open
    const stream = websocketStream(mockSocket);
    
    stream.on('connect', () => {
      expect(stream.destroyed).toBe(false);
      done();
    });
  });

  it('should push null on socket close', (done) => {
    const stream = websocketStream('wss://example.com');
    
    // Put stream in flowing mode to receive 'end' event
    stream.on('data', () => {});
    
    stream.on('end', () => {
      expect(stream.readableEnded).toBe(true);
      done();
    });
    
    mockSocket.onclose();
  });

  it('should destroy stream on socket error', (done) => {
    const stream = websocketStream('wss://example.com');
    
    stream.on('error', (err) => {
      expect(err.message).toBe('WebSocket error');
      done();
    });
    
    mockSocket.onerror({});
  });

  it('should close socket on stream end', (done) => {
    const stream = websocketStream('wss://example.com');
    
    stream.end(() => {
      expect(mockSocket.close).toHaveBeenCalled();
      done();
    });
  });
});

describe('duplexer-lite', () => {
  it('should create duplex from writable and readable', () => {
    const writable = new PassThrough();
    const readable = new PassThrough();
    
    const duplex = duplexer(writable, readable);
    
    expect(duplex).toBeDefined();
    expect(duplex._writable).toBe(writable);
    expect(duplex._readable).toBe(readable);
  });

  it('should forward writes to writable', (done) => {
    const writable = new PassThrough();
    const readable = new PassThrough();
    const duplex = duplexer(writable, readable);
    
    writable.on('data', (chunk) => {
      expect(chunk.toString()).toBe('hello');
      done();
    });
    
    duplex.write('hello');
  });

  it('should forward readable data to duplex', (done) => {
    const writable = new PassThrough();
    const readable = new PassThrough();
    const duplex = duplexer(writable, readable);
    
    duplex.on('data', (chunk) => {
      expect(chunk.toString()).toBe('world');
      done();
    });
    
    readable.push('world');
  });

  it('should end duplex when readable ends', (done) => {
    const writable = new PassThrough();
    const readable = new PassThrough();
    const duplex = duplexer(writable, readable);
    
    // Need to put duplex in flowing mode to receive 'end' event
    duplex.on('data', () => {}); // consume data
    
    duplex.on('end', () => {
      expect(duplex.readableEnded).toBe(true);
      done();
    });
    
    readable.push(null);
  });

  it('should end writable when duplex finishes', (done) => {
    const writable = new PassThrough();
    const readable = new PassThrough();
    const duplex = duplexer(writable, readable);
    
    writable.on('finish', () => {
      expect(writable.writableFinished).toBe(true);
      done();
    });
    
    duplex.end();
  });

  it('should destroy duplex on writable error', (done) => {
    const writable = new PassThrough();
    const readable = new PassThrough();
    const duplex = duplexer(writable, readable);
    
    duplex.on('error', (err) => {
      expect(err.message).toBe('writable error');
      done();
    });
    
    writable.emit('error', new Error('writable error'));
  });

  it('should destroy duplex on readable error', (done) => {
    const writable = new PassThrough();
    const readable = new PassThrough();
    const duplex = duplexer(writable, readable);
    
    duplex.on('error', (err) => {
      expect(err.message).toBe('readable error');
      done();
    });
    
    readable.emit('error', new Error('readable error'));
  });

  it('should handle backpressure from writable', (done) => {
    const slowWritable = new Writable({
      write(chunk, enc, cb) {
        setTimeout(cb, 10); // Simulate slow write
      }
    });
    const readable = new PassThrough();
    const duplex = duplexer(slowWritable, readable);
    
    let writeCount = 0;
    const interval = setInterval(() => {
      if (writeCount < 5) {
        duplex.write('data');
        writeCount++;
      } else {
        clearInterval(interval);
        duplex.end(() => {
          expect(writeCount).toBe(5);
          done();
        });
      }
    }, 5);
  });
});

describe('through2-lite', () => {
  it('should create object mode transform stream', () => {
    const stream = through2.obj((chunk, enc, cb) => cb(null, chunk));
    
    expect(stream).toBeDefined();
    expect(stream.readableObjectMode).toBe(true);
    expect(stream.writableObjectMode).toBe(true);
  });

  it('should transform data', (done) => {
    const stream = through2.obj((chunk, enc, cb) => {
      cb(null, chunk * 2);
    });
    
    const results = [];
    stream.on('data', (chunk) => results.push(chunk));
    stream.on('end', () => {
      expect(results).toEqual([2, 4, 6]);
      done();
    });
    
    stream.write(1);
    stream.write(2);
    stream.write(3);
    stream.end();
  });

  it('should handle flush function', (done) => {
    let flushed = false;
    const stream = through2.obj(
      (chunk, enc, cb) => cb(null, chunk),
      (cb) => {
        flushed = true;
        cb();
      }
    );
    
    stream.on('finish', () => {
      expect(flushed).toBe(true);
      done();
    });
    
    stream.write('data');
    stream.end();
  });

  it('should allow pushing multiple items in transform', (done) => {
    const stream = through2.obj(function(chunk, enc, cb) {
      this.push(chunk);
      this.push(chunk + 1);
      cb();
    });
    
    const results = [];
    stream.on('data', (chunk) => results.push(chunk));
    stream.on('end', () => {
      expect(results).toEqual([1, 2, 2, 3]);
      done();
    });
    
    stream.write(1);
    stream.write(2);
    stream.end();
  });
});

describe('chunker-lite', () => {
  it('should split data into fixed-size chunks', (done) => {
    const stream = chunker(4);
    const chunks = [];
    
    stream.on('data', (chunk) => chunks.push(chunk));
    stream.on('end', () => {
      // "hello world" = 11 bytes, chunks of 4 = 4, 4, 3
      expect(chunks).toHaveLength(3);
      expect(chunks[0]).toHaveLength(4);
      expect(chunks[1]).toHaveLength(4);
      expect(chunks[2]).toHaveLength(3); // Remaining (11 - 8 = 3)
      done();
    });
    
    stream.write(Buffer.from('hello'));
    stream.write(Buffer.from(' world'));
    stream.end();
  });

  it('should handle exact chunk size', (done) => {
    const stream = chunker(4);
    const chunks = [];
    
    stream.on('data', (chunk) => chunks.push(chunk));
    stream.on('end', () => {
      expect(chunks).toHaveLength(2);
      expect(chunks[0]).toHaveLength(4);
      expect(chunks[1]).toHaveLength(4);
      done();
    });
    
    stream.write(Buffer.from('12345678'));
    stream.end();
  });

  it('should handle data smaller than chunk size', (done) => {
    const stream = chunker(100);
    const chunks = [];
    
    stream.on('data', (chunk) => chunks.push(chunk));
    stream.on('end', () => {
      expect(chunks).toHaveLength(1);
      expect(chunks[0].toString()).toBe('small');
      done();
    });
    
    stream.write(Buffer.from('small'));
    stream.end();
  });

  it('should handle multiple writes accumulating', (done) => {
    const stream = chunker(5);
    const chunks = [];
    
    stream.on('data', (chunk) => chunks.push(chunk.toString()));
    stream.on('end', () => {
      expect(chunks).toEqual(['hello', 'world']);
      done();
    });
    
    stream.write(Buffer.from('hel'));
    stream.write(Buffer.from('lo'));
    stream.write(Buffer.from('wor'));
    stream.write(Buffer.from('ld'));
    stream.end();
  });

  it('should handle string input', (done) => {
    const stream = chunker(3);
    const chunks = [];
    
    stream.on('data', (chunk) => chunks.push(chunk.toString()));
    stream.on('end', () => {
      expect(chunks).toEqual(['abc', 'def']);
      done();
    });
    
    stream.end('abcdef');
  });

  it('should convert non-Buffer input to Buffer', (done) => {
    const stream = chunker(3);
    const chunks = [];
    
    stream.on('data', (chunk) => {
      expect(Buffer.isBuffer(chunk)).toBe(true);
      chunks.push(chunk.toString());
    });
    stream.on('end', () => {
      expect(chunks).toEqual(['123', '456']);
      done();
    });
    
    // Write string directly (not wrapped in Buffer) - triggers Buffer.from() branch
    stream.write('123456');
    stream.end();
  });
});

describe('to-arraybuffer-lite', () => {
  it('should convert Uint8Array to ArrayBuffer', () => {
    const uint8 = new Uint8Array([1, 2, 3, 4]);
    const result = toArrayBuffer(uint8);
    
    expect(result).toBeInstanceOf(ArrayBuffer);
    expect(result.byteLength).toBe(4);
  });

  // Note: Buffer instanceof Uint8Array is true in Node.js but jsdom may not behave the same
  // This test verifies the Uint8Array path works (Buffer inherits Uint8Array in real Node.js)
  it('should convert Uint8Array to ArrayBuffer (which handles Buffer in Node.js)', () => {
    const uint8 = new Uint8Array([1, 2, 3, 4]);
    const result = toArrayBuffer(uint8);
    
    expect(result).toBeInstanceOf(ArrayBuffer);
    expect(result.byteLength).toBe(4);
    
    // Verify content was preserved
    const view = new Uint8Array(result);
    expect(view[0]).toBe(1);
    expect(view[1]).toBe(2);
    expect(view[2]).toBe(3);
    expect(view[3]).toBe(4);
  });

  it('should handle subarray (offset/length)', () => {
    const original = new Uint8Array([0, 1, 2, 3, 4, 5]);
    const subarray = original.subarray(2, 4);
    const result = toArrayBuffer(subarray);
    
    expect(result.byteLength).toBe(2);
    const view = new Uint8Array(result);
    expect(view[0]).toBe(2);
    expect(view[1]).toBe(3);
  });

  it('should return underlying buffer for full array', () => {
    const uint8 = new Uint8Array([1, 2, 3]);
    const result = toArrayBuffer(uint8);
    
    expect(result).toBe(uint8.buffer);
  });

  it('should throw for non-Uint8Array/Buffer', () => {
    expect(() => toArrayBuffer('string')).toThrow('Argument must be a Buffer or Uint8Array');
    expect(() => toArrayBuffer(123)).toThrow('Argument must be a Buffer or Uint8Array');
    expect(() => toArrayBuffer([])).toThrow('Argument must be a Buffer or Uint8Array');
  });
});

describe('drop-stream', () => {
  it('should consume all data without output', (done) => {
    const stream = new DropStream();
    
    stream.on('finish', () => {
      expect(stream.writableFinished).toBe(true);
      done();
    });
    
    stream.write('data1');
    stream.write('data2');
    stream.end();
  });

  it('should create object mode stream via static method', (done) => {
    const stream = DropStream.obj();
    
    expect(stream.writableObjectMode).toBe(true);
    
    stream.on('finish', done);
    stream.write({ obj: true });
    stream.end();
  });

  it('should not emit data events', (done) => {
    const stream = new DropStream();
    let dataEmitted = false;
    
    stream.on('data', () => {
      dataEmitted = true;
    });
    
    stream.on('finish', () => {
      expect(dataEmitted).toBe(false);
      done();
    });
    
    stream.write('test');
    stream.end();
  });
});

describe('stats-lite', () => {
  it('should initialize with zero values', () => {
    const stats = new Stats();
    
    expect(stats.n).toBe(0);
    expect(stats.mean).toBe(0);
    expect(stats.variance).toBe(0);
    expect(stats.standardDeviation).toBe(0);
  });

  it('should calculate mean correctly', () => {
    const stats = new Stats();
    
    stats.update(10);
    stats.update(20);
    stats.update(30);
    
    expect(stats.n).toBe(3);
    expect(stats.mean).toBe(20);
  });

  it('should calculate variance correctly', () => {
    const stats = new Stats();
    
    // Values: 2, 4, 4, 4, 5, 5, 7, 9
    // Mean: 5, Sample Variance: 4.571
    [2, 4, 4, 4, 5, 5, 7, 9].forEach(v => stats.update(v));
    
    expect(stats.mean).toBe(5);
    // Sample variance with Welford's method
    expect(stats.variance).toBeCloseTo(4.571, 2);
  });

  it('should calculate standard deviation', () => {
    const stats = new Stats();
    
    [2, 4, 4, 4, 5, 5, 7, 9].forEach(v => stats.update(v));
    
    // sqrt(4.571) ≈ 2.138
    expect(stats.standardDeviation).toBeCloseTo(2.138, 2);
  });

  it('should return 0 variance for single value', () => {
    const stats = new Stats();
    stats.update(42);
    
    expect(stats.n).toBe(1);
    expect(stats.variance).toBe(0);
  });

  it('should return null from getAll() when empty', () => {
    const stats = new Stats();
    
    expect(stats.getAll()).toBeNull();
  });

  it('should return all stats from getAll()', () => {
    const stats = new Stats();
    stats.update(10);
    stats.update(20);
    
    const all = stats.getAll();
    
    expect(all).toEqual({
      n: 2,
      mean: 15,
      variance: 50,
      standardDeviation: Math.sqrt(50),
    });
  });

  it('should reset all values', () => {
    const stats = new Stats();
    stats.update(10);
    stats.update(20);
    
    stats.reset();
    
    expect(stats.n).toBe(0);
    expect(stats.mean).toBe(0);
    expect(stats.variance).toBe(0);
  });

  it('should handle large numbers of updates', () => {
    const stats = new Stats();
    
    for (let i = 1; i <= 1000; i++) {
      stats.update(i);
    }
    
    expect(stats.n).toBe(1000);
    expect(stats.mean).toBe(500.5);
  });
});
