/**
 * Lightweight websocket-stream replacement for browser environments
 * Replaces websocket-stream (~72KB with duplexify) with ~60 lines
 * 
 * Creates a Duplex stream from a WebSocket connection
 */
import { Duplex } from 'node:stream';

/**
 * Creates a Duplex stream wrapping a WebSocket
 * @param {string|WebSocket} target - WebSocket URL or existing WebSocket
 * @param {string|string[]} [protocols] - WebSocket subprotocols
 * @param {object} [options] - Options (not used in browser, kept for API compat)
 * @returns {Duplex} - A Duplex stream with 'connect' event
 */
export default function websocketStream(target, protocols, options) {
  let socket;
  
  // Handle overloaded arguments
  if (protocols && !Array.isArray(protocols) && typeof protocols === 'object') {
    options = protocols;
    protocols = options?.protocol;
  }

  // Create or use existing WebSocket
  if (typeof target === 'object' && target.send) {
    socket = target;
  } else {
    socket = new WebSocket(target, protocols);
    socket.binaryType = 'arraybuffer';
  }

  const stream = new Duplex({
    read() {},
    write(chunk, encoding, callback) {
      if (socket.readyState !== WebSocket.OPEN) {
        const states = ['CONNECTING', 'OPEN', 'CLOSING', 'CLOSED'];
        callback(new Error(`WebSocket is not open (state: ${states[socket.readyState]})`));
        return;
      }
      
      try {
        // Convert to ArrayBuffer if needed
        const data = chunk.buffer ? chunk.buffer.slice(chunk.byteOffset, chunk.byteOffset + chunk.byteLength) : chunk;
        socket.send(data);
        callback();
      } catch (err) {
        callback(err);
      }
    },
    final(callback) {
      socket.close();
      callback();
    },
    destroy(error, callback) {
      socket.close();
      callback(error);
    }
  });

  // Forward WebSocket events to stream
  socket.onmessage = (event) => {
    const data = event.data instanceof ArrayBuffer 
      ? Buffer.from(event.data) 
      : event.data;
    stream.push(data);
  };

  socket.onerror = (event) => {
    // Wrap the event in a proper Error object for consistent error handling
    stream.destroy(new Error('WebSocket error'));
  };

  socket.onclose = () => {
    stream.push(null);
  };

  socket.onopen = () => {
    stream.emit('connect');
  };

  // If already open, emit connect on next tick
  if (socket.readyState === WebSocket.OPEN) {
    process.nextTick(() => stream.emit('connect'));
  }

  // Store socket reference
  stream.socket = socket;

  return stream;
}
