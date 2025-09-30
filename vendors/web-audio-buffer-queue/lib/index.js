import { Writable } from 'stream';
import extend from 'extend';

let defaultAudioContext = null;

function getDefaultAudioContext() {
  if (defaultAudioContext) {
    return defaultAudioContext;
  }

  if (typeof window === 'undefined') {
    return null;
  }

  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextClass) {
    return null;
  }

  defaultAudioContext = new AudioContextClass();
  return defaultAudioContext;
}

class AudioBufferWrapper {
  constructor(audioBuffer) {
    this._buffer = audioBuffer;
  }

  copyTo(target, targetOffset, sourceOffset, length) {
    for (let channel = 0; channel < this._buffer.numberOfChannels; channel += 1) {
      const source = this._buffer.getChannelData(channel);
      const slice = source.subarray(sourceOffset, sourceOffset + length);
      target.copyToChannel(slice, channel, targetOffset);
    }
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

  _bulkCopy(target, targetOffset, sourceOffset, length) {
    const slice = this._data.subarray(sourceOffset, sourceOffset + length);
    target.set(slice, targetOffset);
  }

  copyTo(target, targetOffset, sourceOffset, length) {
    for (let channel = 0; channel < this._channels; channel += 1) {
      const channelData = target.getChannelData(channel);
      if (this._interleaved && this._channels > 1) {
        for (let i = 0; i < length; i += 1) {
          const actualSourceOffset = (sourceOffset + i) * this._channels + channel;
          channelData[targetOffset + i] = this._get(actualSourceOffset);
        }
      } else {
        const offset = this.length * channel + sourceOffset;
        this._bulkCopy(channelData, targetOffset, offset, length);
      }
    }
  }

  get length() {
    return this._data.length / this._channels;
  }
}

class Float32ArrayWrapper extends TypedArrayWrapper {
  constructor(channels, interleaved, data) {
    let view = data;
    if (Buffer.isBuffer(data)) {
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
    if (Buffer.isBuffer(data)) {
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

  _bulkCopy(target, targetOffset, sourceOffset, length) {
    for (let i = 0; i < length; i += 1) {
      target[targetOffset + i] = this._get(sourceOffset + i);
    }
  }
}

class BufferQueueNode extends Writable {
  constructor(options = {}) {
    const opts = extend({
      dataType: Float32ArrayWrapper,
      objectMode: false,
      interleaved: true,
      channels: 1,
      bufferSize: 4096,
      audioContext: undefined,
    }, options);

    super({
      objectMode: opts.objectMode,
      highWaterMark: opts.highWaterMark,
      decodeStrings: opts.decodeStrings,
    });

    this._dataType = opts.dataType;
    this._objectMode = Boolean(opts.objectMode);
    this._interleaved = Boolean(opts.interleaved);
    this._channels = opts.channels;
    this._queue = [];

    const audioContext = opts.audioContext || getDefaultAudioContext();
    if (!audioContext) {
      throw new Error('AudioContext is not available; pass options.audioContext explicitly.');
    }
    this._audioContext = audioContext;

    this._node = audioContext.createScriptProcessor(opts.bufferSize, 0, this._channels);

    let shuttingDown = false;
    let shutDown = false;
    let currentBuffer = null;
    let currentBufferOffset = 0;

    this._node.addEventListener('audioprocess', (event) => {
      if (shutDown) {
        return;
      }

      const outputBuffer = event.outputBuffer;
      let outputOffset = 0;

      while (outputOffset < outputBuffer.length) {
        if (!currentBuffer && this._queue.length > 0) {
          currentBuffer = this._queue.shift();
          currentBufferOffset = 0;
        }

        if (!currentBuffer) {
          for (let channel = 0; channel < this._channels; channel += 1) {
            outputBuffer.getChannelData(channel).fill(0, outputOffset);
          }
          if (shuttingDown) {
            shutDown = true;
            process.nextTick(() => this.emit('close'));
          }
          break;
        }

        const remainingOutput = outputBuffer.length - outputOffset;
        const remainingInput = currentBuffer.length - currentBufferOffset;
        const remaining = Math.min(remainingOutput, remainingInput);

        currentBuffer.copyTo(outputBuffer, outputOffset, currentBufferOffset, remaining);

        currentBufferOffset += remaining;
        outputOffset += remaining;

        if (currentBufferOffset >= currentBuffer.length) {
          currentBuffer = null;
        }
      }
    });

    this.on('finish', () => {
      shuttingDown = true;
    });

    this.on('close', () => {
      this._node.disconnect();
    });
  }

  connect(...args) {
    return this._node.connect(...args);
  }

  disconnect(...args) {
    this._node.disconnect(...args);
    return this;
  }

  _write(chunk, encoding, callback) {
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

      this._queue.push(formatted);
      callback();
    } catch (error) {
      callback(error);
    }
  }
}

BufferQueueNode.AudioBuffer = AudioBufferWrapper;
BufferQueueNode.Float32Array = Float32ArrayWrapper;
BufferQueueNode.Int16Array = Int16ArrayWrapper;

export { AudioBufferWrapper as AudioBuffer };
export { Float32ArrayWrapper as Float32Array };
export { Int16ArrayWrapper as Int16Array };
export { BufferQueueNode };
export default BufferQueueNode;

