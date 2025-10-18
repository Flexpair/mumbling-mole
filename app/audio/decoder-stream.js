import { Transform } from "stream";
import createPool from "reuse-pool";
import toArrayBuffer from "to-arraybuffer";

// Native Worker factory function (Webpack 5 compatible)
function newWorker () {
  // Use relative path instead of import.meta.url for esbuild IIFE compatibility
  return new Worker('./audio/decode-worker.js', { type: 'classic' });
}

const pool = createPool(newWorker);
// Prepare first worker
pool.recycle(pool.get());

class DecoderStream extends Transform {
  constructor() {
    super({ objectMode: true });

    this._worker = pool.get();
    this._ended = false;
    this._finalCallback = null;
    this._messageId = 0;
    this._worker.onmessage = (msg) => {
      this._onMessage(msg.data);
    };
  }

  _onMessage(data) {
    // RESET-PRIORITY: Handle reset messages first, before checking stream state
    // This ensures cleanup happens even after stream has ended
    if (data.action === "reset") {
      const finalize = this._finalCallback;
      this._finalCallback = null;
      if (finalize) {
        finalize();
      }
      return;
    }

    // EOF-GUARD: Prevent push after EOF by checking multiple stream states
    // Worker may send decoded frames after stream.end() was called
    if (this._ended || this.destroyed || this.readableEnded) {
      console.warn('[DecoderStream] Message received after stream ended, ignoring');
      return;
    }
    
    if (data.action === "decoded") {
      const pcm = new Float32Array(data.buffer);
      
      this.push({
        target: data.target,
        pcm: pcm,
        numberOfChannels: data.numberOfChannels,
        position: data.position,
      });
    } else {
      throw new Error("unexpected message:" + data);
    }
  }

  _transform(chunk, encoding, callback) {
    if (chunk.frame) {
      const buffer = toArrayBuffer(chunk.frame);
      this._worker.postMessage(
        {
          action: "decode" + chunk.codec,
          buffer: buffer,
          target: chunk.target,
          position: chunk.position,
        },
        [buffer]
      );
    } else {
      this._worker.postMessage({
        action: "decode" + chunk.codec,
        buffer: null,
        target: chunk.target,
        position: chunk.position,
      });
    }
    callback();
  }

  _final(callback) {
    console.log('[DecoderStream] _final() called - stream ending');
    this._ended = true;
    
    if (!this._worker) {
      callback();
      return;
    }

    this._finalCallback = () => {
      if (this._worker) {
        pool.recycle(this._worker);
        this._worker = null;
      }
      callback();
    };

    try {
      this._worker.postMessage({ id: this._messageId++, action: "reset" });
    } catch (err) {
      console.warn('[DecoderStream] Failed to post reset message; recycling worker immediately', err);
      this._finalCallback();
    }
  }
}

export default DecoderStream;
