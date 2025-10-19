import { Transform } from "stream";
import createPool from "reuse-pool";
import toArrayBuffer from "to-arraybuffer";

// Native Worker factory function (esbuild compatible)
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
    this._finalized = false;
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
      // Atomic check-and-set to prevent double execution of finalCallback
      if (this._finalized) {
        return;
      }
      this._finalized = true;
      
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
      // Safe check for debug flag (works in both browser and worker contexts)
      const debugEnabled = typeof window !== 'undefined' && window.MUMBLE_DEBUG_AUDIO;
      if (debugEnabled) {
        console.warn('[DEBUG-DECODER] Ignoring message, stream ended');
      }
      return;
    }
    
    if (data.action === "decoded") {
      const pcm = new Float32Array(data.buffer);
      const debugEnabled = typeof window !== 'undefined' && window.MUMBLE_DEBUG_AUDIO;
      if (debugEnabled) {
        console.warn('[DEBUG-DECODER] Decoded audio received, PCM length:', pcm.length, 'channels:', data.numberOfChannels, 'target:', data.target);
      }
      
      this.push({
        target: data.target,
        pcm: pcm,
        numberOfChannels: data.numberOfChannels,
        position: data.position,
      });
      if (debugEnabled) {
        console.warn('[DEBUG-DECODER] Pushed decoded data to stream');
      }
    } else {
      throw new Error("unexpected message:" + data);
    }
  }

  _transform(chunk, encoding, callback) {
    const debugEnabled = typeof window !== 'undefined' && window.MUMBLE_DEBUG_AUDIO;
    if (debugEnabled) {
      console.warn('[DEBUG-DECODER] Transform called, codec:', chunk.codec, 'has frame:', !!chunk.frame, 'frame length:', chunk.frame?.length);
    }
    if (chunk.frame) {
      const buffer = toArrayBuffer(chunk.frame);
      if (debugEnabled) {
        console.warn('[DEBUG-DECODER] Sending decode request to worker, action:', 'decode' + chunk.codec, 'buffer size:', buffer.byteLength);
      }
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
      if (debugEnabled) {
        console.warn('[DEBUG-DECODER] Sending null frame (packet loss) to worker');
      }
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
    this._ended = true;
    
    if (!this._worker) {
      callback();
      return;
    }

    this._finalCallback = () => {
      pool.recycle(this._worker);
      this._worker = null;
      callback();
    };

    try {
      this._worker.postMessage({ id: this._messageId++, action: "reset" });
    } catch (err) {
      // Worker might be terminated already, recycle immediately
      this._finalCallback();
    }
  }
}

export default DecoderStream;
