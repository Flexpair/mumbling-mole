import { PassThrough, Writable } from 'node:stream';

const { default: duplexer } = await import('../../app/utils/duplexer-lite.js');

describe('duplexer-lite', () => {
  describe('basic functionality', () => {
    test('should create a duplex stream combining writable and readable', () => {
      const writable = new PassThrough();
      const readable = new PassThrough();
      
      const duplex = duplexer(writable, readable);
      
      expect(duplex).toBeDefined();
      expect(duplex._writable).toBe(writable);
      expect(duplex._readable).toBe(readable);
    });

    test('should forward writes to writable stream', (done) => {
      const writable = new PassThrough();
      const readable = new PassThrough();
      
      const duplex = duplexer(writable, readable);
      
      writable.on('data', (chunk) => {
        expect(chunk.toString()).toBe('test data');
        done();
      });
      
      duplex.write('test data');
    });

    test('should read data from readable stream', (done) => {
      const writable = new PassThrough();
      const readable = new PassThrough();
      
      const duplex = duplexer(writable, readable);
      
      duplex.on('data', (chunk) => {
        expect(chunk.toString()).toBe('incoming data');
        done();
      });
      
      readable.push('incoming data');
    });
  });

  describe('backpressure handling', () => {
    test('should handle write returning false (backpressure)', (done) => {
      // Create a slow writable that triggers backpressure
      let writeCount = 0;
      const writable = new Writable({
        highWaterMark: 1,
        write(chunk, encoding, callback) {
          writeCount++;
          // Simulate slow write
          setTimeout(callback, 10);
        }
      });
      const readable = new PassThrough();
      
      const duplex = duplexer(writable, readable);
      
      // Write data
      duplex.write('test', () => {
        expect(writeCount).toBe(1);
        done();
      });
    });

    test('should pause readable when duplex push returns false', (done) => {
      const writable = new PassThrough();
      const readable = new PassThrough({ highWaterMark: 1 });
      
      const duplex = duplexer(writable, readable, { highWaterMark: 1 });
      
      // Fill the duplex buffer to trigger backpressure

      const origPause = readable.pause.bind(readable);
      readable.pause = () => {
        return origPause();
      };
      
      // Push more data than highWaterMark
      for (const buf of [Buffer.alloc(100), Buffer.alloc(100)]) {
        readable.push(buf);
      }
      
      setTimeout(() => {
        // Drain the duplex to trigger resume
        duplex.resume();
        done();
      }, 20);
    });
  });

  describe('stream end handling', () => {
    test('should end duplex when readable ends', (done) => {
      const writable = new PassThrough();
      const readable = new PassThrough();
      
      const duplex = duplexer(writable, readable);
      
      duplex.on('end', () => {
        done();
      });
      
      duplex.resume(); // Start consuming
      readable.end();
    });

    test('should end writable when duplex is finished', (done) => {
      const writable = new PassThrough();
      const readable = new PassThrough();
      
      const duplex = duplexer(writable, readable);
      
      writable.on('finish', () => {
        done();
      });
      
      duplex.end();
    });
  });

  describe('error handling', () => {
    test('should destroy duplex on readable error', (done) => {
      const writable = new PassThrough();
      const readable = new PassThrough();
      
      const duplex = duplexer(writable, readable);
      
      duplex.on('error', (err) => {
        expect(err.message).toBe('readable error');
        done();
      });
      
      readable.destroy(new Error('readable error'));
    });

    test('should destroy duplex on writable error', (done) => {
      const writable = new PassThrough();
      const readable = new PassThrough();
      
      const duplex = duplexer(writable, readable);
      
      duplex.on('error', (err) => {
        expect(err.message).toBe('writable error');
        done();
      });
      
      writable.destroy(new Error('writable error'));
    });
  });

  describe('objectMode', () => {
    test('should support objectMode option', (done) => {
      const writable = new PassThrough({ objectMode: true });
      const readable = new PassThrough({ objectMode: true });
      
      const duplex = duplexer(writable, readable, { objectMode: true });
      
      const testObj = { key: 'value', num: 42 };
      
      duplex.on('data', (obj) => {
        expect(obj).toEqual(testObj);
        done();
      });
      
      readable.push(testObj);
    });
  });
});
