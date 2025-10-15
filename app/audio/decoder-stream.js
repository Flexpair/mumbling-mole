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
    this._worker.onmessage = (msg) => {
      this._onMessage(msg.data);
    };
  }

  _onMessage(data) {
    if (data.action === "decoded") {
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
    this._worker.postMessage({ id: this._id++, action: "reset" });
    this._finalCallback = () => {
      pool.recycle(this._worker);
      this._worker = null;
      callback();
    };
  }
}

export default DecoderStream;
