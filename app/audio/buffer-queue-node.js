/**
 * BufferQueueNode - AudioWorklet-based replacement for web-audio-buffer-queue
 * Maintains API compatibility while using modern AudioWorkletNode instead of deprecated ScriptProcessorNode
 */

/**
 * Simple EventEmitter for browser compatibility (replaces Node.js Writable)
 */
class EventEmitter {
  constructor() {
    this._listeners = {};
  }

  on(event, callback) {
    if (!this._listeners[event]) {
      this._listeners[event] = [];
    }
    this._listeners[event].push(callback);
    return this;
  }

  once(event, callback) {
    const wrapper = (...args) => {
      callback(...args);
      this.removeListener(event, wrapper);
    };
    return this.on(event, wrapper);
  }

  emit(event, ...args) {
    if (this._listeners[event]) {
      for (const callback of this._listeners[event]) {
        try {
          callback(...args);
        } catch (err) {
          console.error(`Error in ${event} listener:`, err);
        }
      }
    }
    return this;
  }

  removeListener(event, callback) {
    if (this._listeners[event]) {
      this._listeners[event] = this._listeners[event].filter(cb => cb !== callback);
    }
    return this;
  }
}

/**
 * Wrapper classes for different audio buffer formats
 */
class AudioBufferWrapper {
  constructor(audioBuffer) {
    this._buffer = audioBuffer;
  }

  toChannelData() {
    const channels = [];
    for (let i = 0; i < this._buffer.numberOfChannels; i++) {
      channels.push(this._buffer.getChannelData(i));
    }
    return {
      channels,
      length: this._buffer.length
    };
  }

  get length() {
    return this._buffer.length;
  }
}

class TypedArrayWrapper {
  constructor(channels, interleaved, data) {
    this._channels = channels;
    this._interleaved = interleaved;
    this._data = data;
  }

  _get(index) {
    return this._data[index];
  }

  toChannelData() {
    const channels = [];
    const length = this.length;
    
    for (let channel = 0; channel < this._channels; channel++) {
      const channelData = new Float32Array(length);
      
      if (this._interleaved && this._channels > 1) {
        for (let i = 0; i < length; i++) {
          const sourceIndex = i * this._channels + channel;
          channelData[i] = this._get(sourceIndex);
        }
      } else {
        const offset = length * channel;
        for (let i = 0; i < length; i++) {
          channelData[i] = this._get(offset + i);
        }
      }
      
      channels.push(channelData);
    }
    
    return {
      channels,
      length
    };
  }

  get length() {
    return this._data.length / this._channels;
  }
}

class Float32ArrayWrapper extends TypedArrayWrapper {
  constructor(channels, interleaved, data) {
    let view = data;
    if (typeof Buffer !== 'undefined' && Buffer.isBuffer(data)) {
      view = new Float32Array(data.buffer, data.byteOffset, data.byteLength / 4);
    } else if (!(data instanceof Float32Array)) {
      throw new TypeError('Unsupported buffer type for Float32ArrayWrapper');
    }
    super(channels, interleaved, view);
  }
}

class Int16ArrayWrapper extends TypedArrayWrapper {
  constructor(channels, interleaved, data) {
    let view = data;
    if (typeof Buffer !== 'undefined' && Buffer.isBuffer(data)) {
      view = new Int16Array(data.buffer, data.byteOffset, data.byteLength / 2);
    } else if (!(data instanceof Int16Array)) {
      throw new TypeError('Unsupported buffer type for Int16ArrayWrapper');
    }
    super(channels, interleaved, view);
  }

  _get(index) {
    const value = this._data[index];
    return value / ((1 << 15) - (value > 0 ? 1 : 0));
  }
}

/**
 * BufferQueueNode - AudioWorklet-based audio playback queue
 */
class BufferQueueNode extends EventEmitter {
  constructor(options = {}) {
    super();
    
    const opts = {
      dataType: Float32ArrayWrapper,
      objectMode: false,
      interleaved: true,
      channels: 1,
      bufferSize: 4096, // Not used by AudioWorklet but kept for API compatibility
      audioContext: undefined,
      ...options
    };

    this._dataType = opts.dataType;
    this._objectMode = Boolean(opts.objectMode);
    this._interleaved = Boolean(opts.interleaved);
    this._channels = opts.channels;
    this._audioContext = opts.audioContext;
    this._workletNode = null;
    this._isReady = false;
    this._isFinished = false;
    this._isInitializing = false; // PROMISE-CACHING: Flag to prevent duplicate async initialization

    if (!this._audioContext) {
      throw new Error('AudioContext is required; pass options.audioContext explicitly.');
    }

    this.on('finish', () => {
      this._isFinished = true;
      if (this._workletNode) {
        this._workletNode.port.postMessage({ type: 'finish' });
      }
    });

    this.on('close', () => {
      if (this._workletNode) {
        this._workletNode.port.postMessage({ type: 'close' });
        this._workletNode.disconnect();
      }
    });
  }

  /**
   * Initialize AudioWorklet asynchronously
   * Uses initialization flag to prevent duplicate initialization attempts
   */
  async initialize() {
    // PROMISE-CACHING: Skip if already initializing or ready
    if (this._isInitializing || this._isReady) {
      // If ready, return immediately
      if (this._isReady) {
        return;
      }
      // If initializing, wait for completion using event emitter
      return new Promise(resolve => this.once('ready', resolve));
    }

    this._isInitializing = true;

    try {
      // LAZY-LOAD: Try to load AudioWorklet module (may already be loaded during connection)
      // Use direct path since file is copied as-is by esbuild
      // InvalidStateError means already loaded - that's fine, we can proceed
      try {
        await this._audioContext.audioWorklet.addModule('playback-buffer-processor.js');
      } catch (err) {
        // Ignore "already loaded" error - module was pre-warmed during connection
        if (err.name !== 'InvalidStateError') {
          throw err; // Re-throw other errors
        }
      }
      
      // Create the AudioWorkletNode
      this._workletNode = new AudioWorkletNode(this._audioContext, 'playback-buffer-processor', {
        numberOfInputs: 0,
        numberOfOutputs: 1,
        outputChannelCount: [this._channels]
      });
      
      // Listen for messages from the worklet
      this._workletNode.port.onmessage = (event) => {
        const { type } = event.data;
        if (type === 'close') {
          this.emit('close');
        } else if (type === 'closed') {
          // Worklet confirmed shutdown
        }
      };
      
      this._isReady = true;
      this.emit('ready');
    } catch (error) {
      console.error('[BufferQueueNode] Failed to initialize AudioWorklet:', error);
      this.emit('error', error);
    } finally {
      this._isInitializing = false;
    }
  }

  /**
   * Set the jitter buffer size (in packets)
   * @param {number} size - Number of packets to buffer (e.g., 25)
   */
  setJitterBufferSize(size) {
    if (this._workletNode) {
      this._workletNode.port.postMessage({
        type: 'setJitterBufferSize',
        size: size
      });
    } else if (this._isInitializing) {
      // Queue the operation until worklet is ready
      this.once('ready', () => this.setJitterBufferSize(size));
    }
    // If not initializing and not ready, the node might be dead or not started yet.
    // We ignore the update to prevent infinite recursion or memory leaks.
  }

  connect(...args) {
    if (!this._workletNode) {
      // If worklet not ready yet, wait for it
      this.initialize().then(() => this.connect(...args)).catch(err => this.emit('error', err));
      return this;
    }
    return this._workletNode.connect(...args);
  }

  disconnect(...args) {
    if (this._workletNode) {
      this._workletNode.disconnect(...args);
    }
    return this;
  }

  _write(chunk, encoding, callback) {
    // ASYNC-GATE: Ensure initialization before writing
    if (!this._isReady) {
      this.initialize()
        .then(() => this._write(chunk, encoding, callback))
        .catch(err => {
          if (typeof callback === 'function') {
            callback(err);
          } else {
            this.emit('error', err);
          }
        });
      return;
    }

    try {
      let formatted;
      if (this._objectMode) {
        if (chunk instanceof Float32Array) {
          formatted = new Float32ArrayWrapper(this._channels, this._interleaved, chunk);
        } else if (chunk instanceof Int16Array) {
          formatted = new Int16ArrayWrapper(this._channels, this._interleaved, chunk);
        } else {
          formatted = new AudioBufferWrapper(chunk);
        }
      } else {
        formatted = new this._dataType(this._channels, this._interleaved, chunk);
      }

      // Convert to channel data format for worklet
      const channelData = formatted.toChannelData();
      
      // Send to AudioWorklet processor
      this._workletNode.port.postMessage({
        type: 'data',
        data: channelData
      });
      
      if (typeof callback === 'function') {
        callback();
      }
    } catch (error) {
      if (typeof callback === 'function') {
        callback(error);
      } else {
        this.emit('error', error);
      }
    }
  }

  /**
   * Write data to the buffer queue (public API for stream-like interface)
   */
  write(chunk, encoding, callback) {
    this._write(chunk, encoding, callback);
    return !this._isFinished;
  }

  /**
   * Signal end of stream
   */
  end(chunk, encoding, callback) {
    if (chunk === undefined) {
      this.emit('finish');
      if (typeof callback === 'function') callback();
    } else {
      this.write(chunk, encoding, () => {
        this.emit('finish');
        if (typeof callback === 'function') callback();
      });
    }
  }
}

// Export wrapper classes for compatibility
BufferQueueNode.AudioBuffer = AudioBufferWrapper;
BufferQueueNode.Float32Array = Float32ArrayWrapper;
BufferQueueNode.Int16Array = Int16ArrayWrapper;

export { AudioBufferWrapper as AudioBuffer };
export { Float32ArrayWrapper as Float32Array };
export { Int16ArrayWrapper as Int16Array };
export { BufferQueueNode };
export default BufferQueueNode;
