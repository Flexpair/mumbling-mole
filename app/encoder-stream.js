import { Transform } from "stream";
import createPool from "reuse-pool";

// Lazy Worker factory function with Dynamic Import
async function createEncodeWorker() {
  const workerModule = await import('./encode-worker.js');
  return new Worker(new URL('./encode-worker.js', import.meta.url), { type: 'classic' });
}

// Lazy pool initialization
let pool = null;
async function getPool() {
  if (!pool) {
    pool = createPool(createEncodeWorker);
    // Prepare first worker asynchronously
    pool.recycle(await pool.get());
  }
  return pool;
}

class EncoderStream extends Transform {
  constructor(codec) {
    super({ objectMode: true });

    this._codec = codec;
    this._worker = null;
    this._workerReady = false;
    
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
      
      // Process any queued encoding requests
      if (this._queuedData) {
        this._queuedData.forEach(({ data, callback }) => {
          this._transform(data, null, callback);
        });
        this._queuedData = null;
      }
    } catch (error) {
      this.emit('error', new Error(`Failed to initialize encoder worker: ${error.message}`));
    }
  }

    _onMessage(data) {
    if (data.reset) {
      if (pool) {
        pool.recycle(this._worker);
      }
      this._finalCallback();
    } else {
      this.push({
        target: data.target,
        frame: data.frame,
        position: data.position,
      });
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

    this._transformCallback = callback;
    this._worker.postMessage({
      cmd: "encode",
      codec: this._codec,
      frame: chunk,
    });
  }

  _final(callback) {
    this._finalCallback = callback;
    if (this._workerReady && this._worker) {
      this._worker.postMessage({ action: "reset" });
    } else {
      // Worker not ready, complete immediately
      callback();
    }
  }
}

export default EncoderStream;
