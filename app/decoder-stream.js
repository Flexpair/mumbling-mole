import { Transform } from "stream";
import createPool from "reuse-pool";
import toArrayBuffer from "to-arraybuffer";

// Debug flag for verbose decoder logging (set to false for production)
const DEBUG_DECODER = false;

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
    if (DEBUG_DECODER) console.log("[DEBUG-DECODER] Received message from worker:", data.action);
    if (data.action === "decoded") {
      if (DEBUG_DECODER) console.log("[DEBUG-DECODER] Decoded audio - buffer size:", data.buffer?.byteLength, "channels:", data.numberOfChannels);
      this.push({
        target: data.target,
        pcm: new Float32Array(data.buffer),
        numberOfChannels: data.numberOfChannels,
        position: data.position,
      });
    } else if (data.action === "reset") {
      if (DEBUG_DECODER) console.log("[DEBUG-DECODER] Reset action received");
      this._finalCallback();
    } else {
      throw new Error("unexpected message:" + data);
    }
  }

  _transform(chunk, encoding, callback) {
    if (DEBUG_DECODER) console.log("[DEBUG-DECODER] Transform called - codec:", chunk.codec, "frame size:", chunk.frame?.length);
    if (chunk.frame) {
      const buffer = toArrayBuffer(chunk.frame);
      if (DEBUG_DECODER) console.log("[DEBUG-DECODER] Posting message to worker - action: decode" + chunk.codec);
      this._worker.postMessage(
        {
          action: "decode" + chunk.codec,
          buffer: buffer,
          target: chunk.target,
          position: chunk.position,
        },
        [buffer]
      );
      if (DEBUG_DECODER) console.log("[DEBUG-DECODER] Message posted to worker");
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
