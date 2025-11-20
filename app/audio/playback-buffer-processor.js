/**
 * AudioWorklet processor for audio playback buffering
 * Replaces deprecated ScriptProcessorNode from web-audio-buffer-queue
 * 
 * NOTE: This file must NOT use ES6 class syntax or any imports!
 * AudioWorklet processors run in their own scope and cannot import modules.
 * 
 * FIX for Issue #201: Queue size limiting to prevent memory leaks
 * - MAX_QUEUE_SIZE = 25 packets (~500ms @ 50 packets/sec = 20ms frames)
 * - Drops oldest packets (FIFO) when queue is full
 * - Prevents unbounded growth during high jitter/packet loss
 */

registerProcessor('playback-buffer-processor', class extends AudioWorkletProcessor {
  constructor() {
    super();
    
    // FIX #201: Maximum queue size to prevent memory leak
    // 25 packets = 500ms jitter buffer (25 * 20ms frames @ 48kHz)
    // Provides balance between latency and robustness
    this._MAX_QUEUE_SIZE = 25;
    
    this._queue = [];
    this._currentBuffer = null;
    this._currentBufferOffset = 0;
    this._shuttingDown = false;
    this._shutDown = false;
    this._droppedPackets = 0; // Counter for monitoring
    
    // Listen for incoming audio data from main thread
    this.port.onmessage = (event) => {
      const { type, data } = event.data;
      
      if (type === 'data') {
        // FIX #201: Drop oldest packet if queue is full (FIFO strategy)
        // This prevents unbounded memory growth during network issues
        if (this._queue.length >= this._MAX_QUEUE_SIZE) {
          this._queue.shift(); // Drop oldest packet
          this._droppedPackets++;
          
          // Log warning every 100 drops (avoid console spam)
          if (this._droppedPackets % 100 === 0) {
            console.warn(
              '[PlaybackBuffer] Queue full - dropped',
              this._droppedPackets,
              'packets. Consider network quality or increasing MAX_QUEUE_SIZE.'
            );
          }
        }
        
        // Queue incoming audio buffer
        this._queue.push(data);
      } else if (type === 'setJitterBufferSize') {
        // FIX #202: Configurable jitter buffer
        const newSize = parseInt(event.data.size, 10);
        if (!isNaN(newSize) && newSize > 0) {
          this._MAX_QUEUE_SIZE = newSize;
          // Trim queue if new size is smaller than current length
          while (this._queue.length > this._MAX_QUEUE_SIZE) {
            this._queue.shift();
            this._droppedPackets++;
          }
        }
      } else if (type === 'finish') {
        this._shuttingDown = true;
      } else if (type === 'close') {
        this._shutDown = true;
        this.port.postMessage({ type: 'closed' });
      }
    };
  }
  
  _getNextBuffer() {
    if (!this._currentBuffer && this._queue.length > 0) {
      this._currentBuffer = this._queue.shift();
      this._currentBufferOffset = 0;
    }
    return this._currentBuffer;
  }
  
  _fillSilence(output, outputOffset) {
    const channels = output.length;
    for (let channel = 0; channel < channels; channel++) {
      output[channel].fill(0, outputOffset);
    }
  }
  
  _shouldShutDown() {
    if (this._shuttingDown && !this._currentBuffer && this._queue.length === 0) {
      this._shutDown = true;
      this.port.postMessage({ type: 'close' });
      return true;
    }
    return false;
  }
  
  _copyAudioData(output, outputOffset, sampleCount) {
    const channels = output.length;
    
    for (let channel = 0; channel < channels; channel++) {
      const outputChannel = output[channel];
      const inputChannel = this._currentBuffer.channels[channel] || this._currentBuffer.channels[0];
      
      for (let i = 0; i < sampleCount; i++) {
        outputChannel[outputOffset + i] = inputChannel[this._currentBufferOffset + i];
      }
    }
    
    this._currentBufferOffset += sampleCount;
    
    // Clear current buffer if exhausted
    if (this._currentBufferOffset >= this._currentBuffer.length) {
      this._currentBuffer = null;
    }
  }
  
  process(inputs, outputs, parameters) {
    // If shut down, stop processing
    if (this._shutDown) {
      return false;
    }
    
    const output = outputs[0];
    if (!output || output.length === 0) {
      return true;
    }
    
    const frameCount = output[0].length;
    let outputOffset = 0;
    
    while (outputOffset < frameCount) {
      this._getNextBuffer();
      
      if (!this._currentBuffer) {
        this._fillSilence(output, outputOffset);
        this._shouldShutDown();
        break;
      }
      
      const remainingOutput = frameCount - outputOffset;
      const remainingInput = this._currentBuffer.length - this._currentBufferOffset;
      const sampleCount = Math.min(remainingOutput, remainingInput);
      
      this._copyAudioData(output, outputOffset, sampleCount);
      outputOffset += sampleCount;
    }
    
    return true;
  }
});
