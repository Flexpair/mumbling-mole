/**
 * Lightweight through2.obj replacement using native Node.js Transform stream
 * Replaces through2 (~220KB with readable-stream) with ~1KB implementation
 * 
 * Only implements through2.obj() which is what we use in client.js
 */
import { Transform } from 'node:stream';

/**
 * Creates a Transform stream in object mode
 * @param {Function} transform - Transform function (chunk, encoding, callback)
 * @param {Function} [flush] - Optional flush function (callback)
 * @returns {Transform} - A Transform stream in object mode
 */
export function obj(transform, flush) {
  return new Transform({
    objectMode: true,
    transform(chunk, encoding, callback) {
      transform.call(this, chunk, encoding, callback);
    },
    flush: flush ? function(callback) {
      flush.call(this, callback);
    } : undefined
  });
}

export default { obj };
