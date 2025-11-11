/**
 * AudioWorklet processor for audio playback buffering
 * Replaces deprecated ScriptProcessorNode from web-audio-buffer-queue
 * 
 * NOTE: This file must NOT use ES6 class syntax or any imports!
 * AudioWorklet processors run in their own scope and cannot import modules.
 */

// Define a maximum size for the playback queue to prevent unbounded memory growth and latency.
// A value of 25 packets (assuming typical ~20ms packets) corresponds to 500ms of audio buffer.
const MAX_QUEUE_PACKETS = 25;

registerProcessor('playback-buffer-processor', class extends AudioWorkletProcessor {
  constructor() {
    super();
    
    this._queue = [];
    this._currentBuffer = null;
    this._currentBufferOffset = 0;
    this._shuttingDown = false;
    this._shutDown = false;
    
    // Listen for incoming audio data from main thread
    this.port.onmessage = (event) => {
      const { type, data } = event.data;
      
      if (type === 'data') {
        // Enforce max queue size to prevent memory leaks and unbounded latency.
        // If the queue is full, drop the oldest packet before adding the new one.
        if (this._queue.length >= MAX_QUEUE_PACKETS) {
          this._queue.shift(); // Drop the oldest packet
          console.warn('[PLAYBACK] Queue overflow: Dropping oldest packet to maintain buffer size.');
        }
        // Queue incoming audio buffer
        this._queue.push(data);
      } else if (type === 'finish') {
        this._shuttingDown = true;
      } else if (type === 'close') {
        this._shutDown = true;
        this.port.postMessage({ type: 'closed' });
      }
    };
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
    
    const channels = output.length;
    const frameCount = output[0].length;
    let outputOffset = 0;
    
    while (outputOffset < frameCount) {
      // Get next buffer from queue if needed
      if (!this._currentBuffer && this._queue.length > 0) {
        this._currentBuffer = this._queue.shift();
        this._currentBufferOffset = 0;
      }
      
      // If no buffer available, fill with silence
      if (!this._currentBuffer) {
        for (let channel = 0; channel < channels; channel++) {
          output[channel].fill(0, outputOffset);
        }
        
        // If shutting down and queue is empty, signal completion
        if (this._shuttingDown) {
          this._shutDown = true;
          this.port.postMessage({ type: 'close' });
        }
        break;
      }
      
      const remainingOutput = frameCount - outputOffset;
      const remainingInput = this._currentBuffer.length - this._currentBufferOffset;
      const remaining = Math.min(remainingOutput, remainingInput);
      
      // Copy audio data from buffer to output
      for (let channel = 0; channel < channels; channel++) {
        const outputChannel = output[channel];
        const inputChannel = this._currentBuffer.channels[channel] || this._currentBuffer.channels[0];
        
        for (let i = 0; i < remaining; i++) {
          outputChannel[outputOffset + i] = inputChannel[this._currentBufferOffset + i];
        }
      }
      
      this._currentBufferOffset += remaining;
      outputOffset += remaining;
      
      // Move to next buffer if current is exhausted
      if (this._currentBufferOffset >= this._currentBuffer.length) {
        this._currentBuffer = null;
      }
    }
    
    return true;
  }
});