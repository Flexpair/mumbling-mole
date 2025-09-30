const { Writable } = require('stream');const { Writable } = require('stream');

const extend = require('extend');const extend = require('extend');



let sharedAudioContext = null;let sharedAudioContext = null;



function resolveDefaultAudioContext() {function resolveDefaultAudioContext() {

  if (sharedAudioContext) {  if (sharedAudioContext) {

    return sharedAudioContext;    return sharedAudioContext;

  }  }

  if (typeof window === 'undefined') {  if (typeof window === 'undefined') {

    return null;    return null;

  }  }

  const AudioContextClass = window.AudioContext || window.webkitAudioContext;  const AudioContextClass = window.AudioContext || window.webkitAudioContext;

  if (!AudioContextClass) {  if (!AudioContextClass) {

    return null;    return null;

  }  }

  sharedAudioContext = new AudioContextClass();  sharedAudioContext = new AudioContextClass();

  return sharedAudioContext;  return sharedAudioContext;

}}



class AudioBufferBuffer {class BufferQueueNode extends Writable {

  constructor(audioBuffer) {  constructor(options = {}) {

    this._buffer = audioBuffer;    const opts = extend({

  }      dataType: Float32ArrayBuffer,

      objectMode: false,

  copyTo(target, targetOffset, sourceOffset, length) {      interleaved: true,

    for (let channel = 0; channel < this._buffer.numberOfChannels; channel += 1) {      channels: 1,

      const source = this._buffer.getChannelData(channel);      bufferSize: 0,

      const slice = source.subarray(sourceOffset, sourceOffset + length);      audioContext: undefined,

      target.copyToChannel(slice, channel, targetOffset);    }, options);

    }

  }    super({

      objectMode: opts.objectMode,

  get length() {      highWaterMark: opts.highWaterMark,

    return this._buffer.length;      decodeStrings: opts.decodeStrings,

  }    });

}

    this._dataType = opts.dataType;

class TypedArrayBuffer {    this._objectMode = Boolean(opts.objectMode);

  constructor(channels, interleaved, data) {    this._interleaved = Boolean(opts.interleaved);

    this._channels = channels;    this._channels = opts.channels;

    this._interleaved = interleaved;    this._queue = [];

    this._data = data;

  }    const audioContext = opts.audioContext || resolveDefaultAudioContext();

    if (!audioContext) {

  _get(index) {      throw new Error('AudioContext is not available; pass options.audioContext explicitly.');

    return this._data[index];    }

  }    this._audioContext = audioContext;



  _bulkCopy(target, targetOffset, sourceOffset, length) {    const processorNode = audioContext.createScriptProcessor(opts.bufferSize, 0, this._channels);

    const view = this._data.subarray(sourceOffset, sourceOffset + length);    const inputNode = audioContext.createBufferSource();

    target.set(view, targetOffset);    inputNode.loop = true;

  }

    let shuttingDown = false;

  copyTo(target, targetOffset, sourceOffset, length) {    let shutDown = false;

    for (let channel = 0; channel < this._channels; channel += 1) {    let currentBuffer = null;

      const channelData = target.getChannelData(channel);    let currentBufferOffset = 0;

      if (this._interleaved && this._channels > 1) {

        for (let i = 0; i < length; i += 1) {    processorNode.addEventListener('audioprocess', (event) => {

          const actualSourceOffset = (sourceOffset + i) * this._channels + channel;      if (shutDown) {

          channelData[targetOffset + i] = this._get(actualSourceOffset);        return;

        }      }

      } else {      const out = event.outputBuffer;

        const offset = this.length * channel + sourceOffset;      let outOffset = 0;

        this._bulkCopy(channelData, targetOffset, offset, length);

      }      while (outOffset < out.length) {

    }        if (!currentBuffer && this._queue.length > 0) {

  }          currentBuffer = this._queue.shift();

          currentBufferOffset = 0;

  get length() {        }

    return this._data.length / this._channels;

  }        if (!currentBuffer) {

}          for (let channel = 0; channel < this._channels; channel += 1) {

            out.getChannelData(channel).fill(0, outOffset);

class Float32ArrayBuffer extends TypedArrayBuffer {          }

  constructor(channels, interleaved, data) {          if (shuttingDown) {

    let view = data;            shutDown = true;

    if (Buffer.isBuffer(data)) {            process.nextTick(() => this.emit('close'));

      view = new Float32Array(data.buffer, data.byteOffset, data.byteLength / 4);          }

    } else if (!(data instanceof Float32Array)) {          break;

      throw new Error(`Unsupported buffer type: ${data}`);        }

    }

    super(channels, interleaved, view);        const remainingOutput = out.length - outOffset;

  }        const remainingInput = currentBuffer.length - currentBufferOffset;

}        const remaining = Math.min(remainingOutput, remainingInput);

        currentBuffer.copyTo(out, outOffset, currentBufferOffset, remaining);

class Int16ArrayBuffer extends TypedArrayBuffer {        currentBufferOffset += remaining;

  constructor(channels, interleaved, data) {        outOffset += remaining;

    let view = data;

    if (Buffer.isBuffer(data)) {        if (currentBufferOffset >= currentBuffer.length) {

      view = new Int16Array(data.buffer, data.byteOffset, data.byteLength / 2);          currentBuffer = null;

    } else if (!(data instanceof Int16Array)) {        }

      throw new Error(`Unsupported buffer type: ${data}`);      }

    }    });

    super(channels, interleaved, view);

  }    this._node = processorNode;



  _get(index) {    this.on('finish', () => {

    const value = this._data[index];      shuttingDown = true;

    return value / ((1 << 15) - (value > 0 ? 1 : 0));    });

  }

    this.on('close', () => {

  _bulkCopy(target, targetOffset, sourceOffset, length) {      processorNode.disconnect();

    for (let i = 0; i < length; i += 1) {      if (typeof inputNode.stop === 'function') {

      target[targetOffset + i] = this._get(sourceOffset + i);        try {

    }          inputNode.stop();

  }        } catch (error) {

}          // ignore stop errors when the node is already stopped

        }

class BufferQueueNode extends Writable {      }

  constructor(options = {}) {    });

    const opts = extend({  }

      dataType: Float32ArrayBuffer,

      objectMode: false,  connect(...args) {

      interleaved: true,    return this._node.connect(...args);

      channels: 1,  }

      bufferSize: 0,

      audioContext: undefined,  disconnect(...args) {

    }, options);    this._node.disconnect(...args);

    return this;

    super({  }

      objectMode: opts.objectMode,

      highWaterMark: opts.highWaterMark,  _write(chunk, encoding, callback) {

      decodeStrings: opts.decodeStrings,    try {

    });      let formatted = chunk;

      if (this._objectMode) {

    this._dataType = opts.dataType;        if (chunk instanceof Float32Array) {

    this._objectMode = Boolean(opts.objectMode);          formatted = new Float32ArrayBuffer(this._channels, this._interleaved, chunk);

    this._interleaved = Boolean(opts.interleaved);        } else if (chunk instanceof Int16Array) {

    this._channels = opts.channels;          formatted = new Int16ArrayBuffer(this._channels, this._interleaved, chunk);

    this._queue = [];        } else {

          formatted = new AudioBufferBuffer(chunk);

    const audioContext = opts.audioContext || resolveDefaultAudioContext();        }

    if (!audioContext) {      } else {

      throw new Error('AudioContext is not available; pass options.audioContext explicitly.');        formatted = new this._dataType(this._channels, this._interleaved, chunk);

    }      }

    this._audioContext = audioContext;      this._queue.push(formatted);

      callback();

    const processorNode = audioContext.createScriptProcessor(opts.bufferSize, 0, this._channels);    } catch (error) {

    const inputNode = audioContext.createBufferSource();      callback(error);

    inputNode.loop = true;    }

  }

    let shuttingDown = false;}

    let shutDown = false;

    let currentBuffer = null;class AudioBufferBuffer {

    let currentBufferOffset = 0;  constructor(audioBuffer) {

    this._buffer = audioBuffer;

    processorNode.addEventListener('audioprocess', (event) => {  }

      if (shutDown) {

        return;  copyTo(target, targetOffset, sourceOffset, length) {

      }    for (let channel = 0; channel < this._buffer.numberOfChannels; channel += 1) {

      const out = event.outputBuffer;      const source = this._buffer.getChannelData(channel);

      let outOffset = 0;      const slice = source.subarray(sourceOffset, sourceOffset + length);

      target.copyToChannel(slice, channel, targetOffset);

      while (outOffset < out.length) {    }

        if (!currentBuffer && this._queue.length > 0) {  }

          currentBuffer = this._queue.shift();

          currentBufferOffset = 0;  get length() {

        }    return this._buffer.length;

  }

        if (!currentBuffer) {}

          for (let channel = 0; channel < this._channels; channel += 1) {

            out.getChannelData(channel).fill(0, outOffset);class TypedArrayBuffer {

          }  constructor(channels, interleaved, data) {

          if (shuttingDown) {    this._channels = channels;

            shutDown = true;    this._interleaved = interleaved;

            process.nextTick(() => this.emit('close'));    this._data = data;

          }  }

          break;

        }  _get(index) {

    return this._data[index];

        const remainingOutput = out.length - outOffset;  }

        const remainingInput = currentBuffer.length - currentBufferOffset;

        const remaining = Math.min(remainingOutput, remainingInput);  _bulkCopy(target, targetOffset, sourceOffset, length) {

        currentBuffer.copyTo(out, outOffset, currentBufferOffset, remaining);    const view = this._data.subarray(sourceOffset, sourceOffset + length);

        currentBufferOffset += remaining;    target.set(view, targetOffset);

        outOffset += remaining;  }



        if (currentBufferOffset >= currentBuffer.length) {  copyTo(target, targetOffset, sourceOffset, length) {

          currentBuffer = null;    for (let channel = 0; channel < this._channels; channel += 1) {

        }      const channelData = target.getChannelData(channel);

      }      if (this._interleaved && this._channels > 1) {

    });        for (let i = 0; i < length; i += 1) {

          const actualSourceOffset = (sourceOffset + i) * this._channels + channel;

    this._node = processorNode;          channelData[targetOffset + i] = this._get(actualSourceOffset);

        }

    this.on('finish', () => {      } else {

      shuttingDown = true;        const offset = this.length * channel + sourceOffset;

    });        this._bulkCopy(channelData, targetOffset, offset, length);

      }

    this.on('close', () => {    }

      processorNode.disconnect();  }

      if (typeof inputNode.stop === 'function') {

        try {  get length() {

          inputNode.stop();    return this._data.length / this._channels;

        } catch (error) {  }

          // ignore stop errors when the node is already stopped}

        }

      }class Float32ArrayBuffer extends TypedArrayBuffer {

    });  constructor(channels, interleaved, data) {

  }    let view = data;

    if (Buffer.isBuffer(data)) {

  connect(...args) {      view = new Float32Array(data.buffer, data.byteOffset, data.byteLength / 4);

    return this._node.connect(...args);    } else if (!(data instanceof Float32Array)) {

  }      throw new Error(`Unsupported buffer type: ${data}`);

    }

  disconnect(...args) {    super(channels, interleaved, view);

    this._node.disconnect(...args);  }

    return this;}

  }

class Int16ArrayBuffer extends TypedArrayBuffer {

  _write(chunk, encoding, callback) {  constructor(channels, interleaved, data) {

    try {    let view = data;

      let formatted = chunk;    if (Buffer.isBuffer(data)) {

      if (this._objectMode) {      view = new Int16Array(data.buffer, data.byteOffset, data.byteLength / 2);

        if (chunk instanceof Float32Array) {    } else if (!(data instanceof Int16Array)) {

          formatted = new Float32ArrayBuffer(this._channels, this._interleaved, chunk);      throw new Error(`Unsupported buffer type: ${data}`);

        } else if (chunk instanceof Int16Array) {    }

          formatted = new Int16ArrayBuffer(this._channels, this._interleaved, chunk);    super(channels, interleaved, view);

        } else {  }

          formatted = new AudioBufferBuffer(chunk);

        }  _get(index) {

      } else {    const value = this._data[index];

        formatted = new this._dataType(this._channels, this._interleaved, chunk);    return value / ((1 << 15) - (value > 0 ? 1 : 0));

      }  }

      this._queue.push(formatted);

      callback();  _bulkCopy(target, targetOffset, sourceOffset, length) {

    } catch (error) {    for (let i = 0; i < length; i += 1) {

      callback(error);      target[targetOffset + i] = this._get(sourceOffset + i);

    }    }

  }  }

}}



BufferQueueNode.AudioBuffer = AudioBufferBuffer;BufferQueueNode.AudioBuffer = AudioBufferBuffer;

BufferQueueNode.Float32Array = Float32ArrayBuffer;BufferQueueNode.Float32Array = Float32ArrayBuffer;

BufferQueueNode.Int16Array = Int16ArrayBuffer;BufferQueueNode.Int16Array = Int16ArrayBuffer;



module.exports = BufferQueueNode;module.exports = BufferQueueNode;

