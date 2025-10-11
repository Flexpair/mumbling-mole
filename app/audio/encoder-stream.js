import { Transform } from "stream";
import createPool from "reuse-pool";
import performanceMonitor from '../performance-monitor';

// Native Worker factory function (Webpack 5 compatible)
function createEncodeWorker() {
  return new Worker(new URL('./encode-worker.js', import.meta.url), { type: 'classic' });
}

const pool = createPool(createEncodeWorker);
// Prepare first worker
pool.recycle(pool.get());

class EncoderStream extends Transform {
  constructor(codec) {
    super({ objectMode: true });

    this._codec = codec;

    this._worker = pool.get();
    this._worker.onmessage = (msg) => {
      this._onMessage(msg.data);
    };
  }

  _onMessage(data) {
    if (data.reset) {
      pool.recycle(this._worker);
      this._finalCallback();
    } else {
      // PERFORMANCE-MONITORING: Track encoding completion
      if (data._encodeId) {
        performanceMonitor.mark(`${data._encodeId}.end`);
        const duration = performanceMonitor.measure(
          'encode.duration', 
          `${data._encodeId}.start`, 
          `${data._encodeId}.end`
        );
        
        // Warn if encoding is slow (> 20ms is problematic for real-time audio)
        if (duration > 20) {
          console.warn(`[PERF] Slow encoding: ${duration.toFixed(2)}ms`);
        }
      }
      
      this.push({
        target: data.target,
        codec: this._codec,
        frame: Buffer.from(data.buffer, data.byteOffset, data.byteLength),
        position: data.position,
      });
    }
  }

  _transform(chunk, encoding, callback) {
    // PERFORMANCE-MONITORING: Track encoding start
    const encodeId = `encode.${Date.now()}.${Math.random()}`;
    chunk._encodeId = encodeId;
    performanceMonitor.mark(`${encodeId}.start`);
    
    var buffer = chunk.pcm.slice().buffer;
    this._worker.postMessage(
      {
        action: "encode" + this._codec,
        target: chunk.target,
        buffer: buffer,
        numberOfChannels: chunk.numberOfChannels,
        bitrate: chunk.bitrate,
        position: chunk.position,
        _encodeId: encodeId,  // Pass ID for timing
      },
      [buffer]
    );
    callback();
  }

  _final(callback) {
    this._worker.postMessage({ action: "reset" });
    this._finalCallback = callback;
  }
}

export default EncoderStream;
