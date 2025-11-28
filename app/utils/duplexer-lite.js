/**
 * Lightweight reduplexer replacement using native Node.js Duplex stream
 * Replaces reduplexer (~200KB with readable-stream) with ~2KB implementation
 * 
 * Creates a Duplex stream that pipes writes to a writable and reads from a readable
 */
import { Duplex } from 'node:stream';

/**
 * Creates a Duplex stream that combines a writable and readable stream
 * @param {Writable} writable - The writable stream (data written to duplex goes here)
 * @param {Readable} readable - The readable stream (data read from duplex comes from here)
 * @param {object} [options] - Stream options (objectMode, etc.)
 * @returns {Duplex} - A Duplex stream combining both
 */
export default function duplexer(writable, readable, options = {}) {
  const duplex = new Duplex({
    ...options,
    read(size) {
      // Reading is handled by piping from readable
    },
    write(chunk, encoding, callback) {
      // Forward writes to the writable stream
      const result = writable.write(chunk, encoding);
      if (result) {
        callback();
      } else {
        writable.once('drain', callback);
      }
    },
    final(callback) {
      // End the writable when duplex is finished
      writable.end(callback);
    }
  });

  // Pipe readable data to the duplex's push
  readable.on('data', (chunk) => {
    if (!duplex.push(chunk)) {
      readable.pause();
    }
  });

  duplex.on('drain', () => {
    readable.resume();
  });

  readable.on('end', () => {
    duplex.push(null);
  });

  readable.on('error', (err) => {
    duplex.destroy(err);
  });

  writable.on('error', (err) => {
    duplex.destroy(err);
  });

  // Store references for potential direct access
  duplex._writable = writable;
  duplex._readable = readable;

  return duplex;
}
