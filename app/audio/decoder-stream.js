import { Transform } from "stream";
import createPool from "reuse-pool";
import toArrayBuffer from "to-arraybuffer";
import performanceMonitor from '../performance-monitor';

// Native Worker factory function (Webpack 5 compatible)
function createDecodeWorker() {
  return new Worker(new URL('./decode-worker.js', import.meta.url), { type: 'classic' });
}

const pool = createPool(createDecodeWorker);
// Prepare first worker
pool.recycle(pool.get());

class DecoderStream extends Transform {
  constructor() {
    super({ objectMode: true });

    this._worker = pool.get();
    this._worker.onmessage = (msg) => {
      this._onMessage(msg.data);
    };
  }

  _onMessage(data) {
    if (data.action === "decoded") {
      // PERFORMANCE-MONITORING: Track decoding completion
      if (data._decodeId) {
        performanceMonitor.mark(`${data._decodeId}.end`);
        const duration = performanceMonitor.measure(
          'decode.duration', 
          `${data._decodeId}.start`, 
          `${data._decodeId}.end`
        );
        
        // Warn if decoding is slow (> 20ms is problematic for real-time audio)
        if (duration > 20) {
          console.warn(`[PERF] Slow decoding: ${duration.toFixed(2)}ms`);
        }
      }
      
      const pcm = new Float32Array(data.buffer);
      
      this.push({
        target: data.target,
        pcm: pcm,
        numberOfChannels: data.numberOfChannels,
        position: data.position,
      });
    } else if (data.action === "reset") {
      this._finalCallback();
    } else {
      throw new Error("unexpected message:" + data);
    }
  }

  _transform(chunk, encoding, callback) {
    // PERFORMANCE-MONITORING: Track decoding start
    const decodeId = `decode.${Date.now()}.${Math.random()}`;
    performanceMonitor.mark(`${decodeId}.start`);
    
    if (chunk.frame) {
      const buffer = toArrayBuffer(chunk.frame);
      this._worker.postMessage(
        {
          action: "decode" + chunk.codec,
          buffer: buffer,
          target: chunk.target,
          position: chunk.position,
          _decodeId: decodeId,  // Pass ID for timing
        },
        [buffer]
      );
    } else {
      this._worker.postMessage({
        action: "decode" + chunk.codec,
        buffer: null,
        target: chunk.target,
        position: chunk.position,
        _decodeId: decodeId,
      });
    }
    callback();
  }

  _final(callback) {
    this._worker.postMessage({ id: this._id++, action: "reset" });
    this._finalCallback = () => {
      pool.recycle(this._worker);
      this._worker = null;
      callback();
    };
  }
}

export default DecoderStream;
