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
      // PERFORMANCE-MONITORING: Track encoding end
      if (data._encodeId) {
        console.log('[ENCODER] Finished encode:', data._encodeId);
        performanceMonitor.mark(`${data._encodeId}.end`);
        console.log('[ENCODER] About to call measure for:', data._encodeId);
        performanceMonitor.measure(
          'encode.duration', 
          `${data._encodeId}.start`, 
          `${data._encodeId}.end`
        );
        console.log('[ENCODER] Measure called for:', data._encodeId);
        // Note: Warnings removed - use Dashboard for performance analysis
      } else {
        console.warn('[ENCODER] No _encodeId in data:', data);
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
    console.log('[ENCODER] Starting encode:', encodeId);
    
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
