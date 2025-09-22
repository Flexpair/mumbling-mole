import { Transform } from "stream";
import createPool from "reuse-pool";
import toArrayBuffer from "to-arraybuffer";

// Lazy Worker factory function with Dynamic Import
async function createDecodeWorker() {
  const workerModule = await import('./decode-worker.js');
  return new Worker(new URL('./decode-worker.js', import.meta.url), { type: 'classic' });
}

// Lazy pool initialization
let pool = null;
async function getPool() {
  if (!pool) {
    pool = createPool(createDecodeWorker);
    // Prepare first worker asynchronously
    pool.recycle(await pool.get());
  }
  return pool;
}

class DecoderStream extends Transform {
  constructor() {
    super({ objectMode: true });

    this._worker = null;
    this._workerReady = false;
    this._id = 0;
    
    // Initialize worker asynchronously
    this._initWorker();
  }

  async _initWorker() {
    try {
      const workerPool = await getPool();
      this._worker = await workerPool.get();
      this._worker.onmessage = (msg) => {
        this._onMessage(msg.data);
      };
      this._workerReady = true;
      
      // Process any queued decoding requests
      if (this._queuedData) {
        this._queuedData.forEach(({ data, callback }) => {
          this._transform(data, null, callback);
        });
        this._queuedData = null;
      }
    } catch (error) {
      this.emit('error', new Error(`Failed to initialize decoder worker: ${error.message}`));
    }
  }

  _onMessage(data) {
    if (data.action === "decoded") {
      this.push({
        target: data.target,
        pcm: new Float32Array(data.buffer),
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
    // Queue data if worker not ready yet
    if (!this._workerReady) {
      if (!this._queuedData) {
        this._queuedData = [];
      }
      this._queuedData.push({ data: chunk, callback });
      return;
    }

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
    this._finalCallback = () => {
      if (pool) {
        pool.recycle(this._worker);
      }
      this._worker = null;
      callback();
    };
    
    if (this._workerReady && this._worker) {
      this._worker.postMessage({ id: this._id++, action: "reset" });
    } else {
      // Worker not ready, complete immediately
      this._finalCallback();
    }
  }
}

export default DecoderStream;
