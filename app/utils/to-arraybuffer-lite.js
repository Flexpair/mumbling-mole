/**
 * Lightweight to-arraybuffer replacement
 * Converts Buffer/Uint8Array to ArrayBuffer
 */

/**
 * Converts a Buffer or Uint8Array to an ArrayBuffer
 * @param {Buffer|Uint8Array} buf - Input buffer
 * @returns {ArrayBuffer} - The underlying or copied ArrayBuffer
 */
export default function toArrayBuffer(buf) {
  // Fast path for Uint8Array (includes Buffer in modern Node.js)
  if (buf instanceof Uint8Array) {
    // Return underlying buffer if it's not a subarray
    if (buf.byteOffset === 0 && buf.byteLength === buf.buffer.byteLength) {
      return buf.buffer;
    }
    // Otherwise slice to get a proper copy
    return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
  }
  
  throw new Error('Argument must be a Buffer or Uint8Array');
}
