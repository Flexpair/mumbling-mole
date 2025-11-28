/**
 * Lightweight stream-chunker replacement
 * Replaces stream-chunker (~76KB with dependencies) with ~40 lines
 * 
 * Splits incoming data into fixed-size chunks
 */
import { Transform } from 'node:stream';

/**
 * Creates a Transform stream that outputs fixed-size chunks
 * @param {number} chunkSize - Size of each output chunk in bytes
 * @param {object} [options] - Stream options
 * @returns {Transform} - A Transform stream that outputs fixed-size chunks
 */
export default function chunker(chunkSize, options = {}) {
  let buffer = Buffer.alloc(0);

  return new Transform({
    ...options,
    transform(chunk, encoding, callback) {
      // Append incoming data to buffer
      buffer = Buffer.concat([buffer, Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)]);

      // Output complete chunks
      while (buffer.length >= chunkSize) {
        const outputChunk = buffer.subarray(0, chunkSize);
        buffer = buffer.subarray(chunkSize);
        this.push(outputChunk);
      }

      callback();
    },
    flush(callback) {
      // Output remaining data if any (partial chunk at end)
      if (buffer.length > 0) {
        this.push(buffer);
      }
      callback();
    }
  });
}
