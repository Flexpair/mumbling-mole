/**
 * BufferQueueNode - AudioWorklet-based replacement for web-audio-buffer-queue
 * Maintains API compatibility while using modern AudioWorkletNode instead of deprecated ScriptProcessorNode
 */

import { Writable } from 'stream';

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
      throw new Error('Unsupported buffer type for Float32ArrayWrapper');
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
      throw new Error('Unsupported buffer type for Int16ArrayWrapper');
    }
    super(channels, interleaved, view);
  }

  _get(index) {
    const value = this._data[index];
    return value / ((1 << 15) - (value > 0 ? 1 : 0));
  }
}

/**
 * BufferQueueNode - Writable stream that plays audio through AudioWorklet
 */
class BufferQueueNode extends Writable {
  constructor(options = {}) {
    const opts = {
      dataType: Float32ArrayWrapper,
      objectMode: false,
      interleaved: true,
      channels: 1,
      bufferSize: 4096, // Not used by AudioWorklet but kept for API compatibility
      audioContext: undefined,
      ...options
    };

    super({
      objectMode: opts.objectMode,
      highWaterMark: opts.highWaterMark,
      decodeStrings: opts.decodeStrings,
    });

    this._dataType = opts.dataType;
    this._objectMode = Boolean(opts.objectMode);
    this._interleaved = Boolean(opts.interleaved);
    this._channels = opts.channels;
    this._audioContext = opts.audioContext;
    this._workletNode = null;
    this._isReady = false;

    if (!this._audioContext) {
      throw new Error('AudioContext is required; pass options.audioContext explicitly.');
    }

    // Initialize AudioWorklet
    this._initializeWorklet();

    this.on('finish', () => {
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

  async _initializeWorklet() {
    try {
      // LAZY-LOAD: Try to load AudioWorklet module (may already be loaded during connection)
      // Use direct path since file is copied as-is by webpack
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
    }
  }

  connect(...args) {
    if (!this._workletNode) {
      // If worklet not ready yet, wait for it
      this.once('ready', () => this.connect(...args));
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
    // If worklet not ready yet, wait for it
    if (!this._isReady) {
      this.once('ready', () => this._write(chunk, encoding, callback));
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
      
      callback();
    } catch (error) {
      callback(error);
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
