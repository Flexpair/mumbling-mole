/**
 * Utilities for audio frequency analysis in loopback mode
 * Detects dominant frequency from voice streams for latency testing
 */

import { debugLog as sharedDebugLog } from './debug-utils';

/**
 * Creates a frequency analyzer that monitors an AnalyserNode
 * and reports the dominant frequency via callback
 * 
 * @param {object} config - Configuration object
 * @param {AnalyserNode} config.analyserNode - Web Audio AnalyserNode to monitor
 * @param {Function} config.onFrequencyUpdate - Callback(frequency) when frequency detected
 * @param {Function} config.isMuted - Function that returns true if audio should be ignored
 * @param {Function} config.isDeafened - Function that returns true if audio should be ignored
 * @param {number} config.updateIntervalMs - How often to check frequency (default: 100ms)
 * @param {number} config.amplitudeThreshold - Minimum amplitude to consider (default: 50)
 * @param {number} config.noAudioThreshold - Checks without audio before clearing display (default: 3)
 * @returns {object} Analyzer with start() and stop() methods
 * 
 * @example
 * const analyzer = createFrequencyAnalyzer({
 *   analyserNode: myAnalyserNode,
 *   onFrequencyUpdate: (freq) => voiceState.updateLoopbackFrequency(freq),
 *   isMuted: () => selfMute.value,
 *   isDeafened: () => selfDeaf.value
 * });
 * 
 * analyzer.start();
 * // ... later ...
 * analyzer.stop();
 */
export function createFrequencyAnalyzer({
  analyserNode,
  onFrequencyUpdate,
  isMuted,
  isDeafened,
  updateIntervalMs = 100,
  amplitudeThreshold = 50,
  noAudioThreshold = 3
}) {
  let interval = null;
  let noAudioCount = 0;
  let currentFrequency = 0;
  
  const bufferLength = analyserNode.frequencyBinCount;
  const dataArray = new Uint8Array(bufferLength);
  const sampleRate = analyserNode.context.sampleRate;

  /**
   * Start frequency analysis loop
   */
  function start() {
    if (interval) {
      return; // Already running
    }
    
    interval = setInterval(() => {
      // Skip analysis if muted or deafened
      if (isMuted() || isDeafened()) {
        if (currentFrequency > 0) {
          currentFrequency = 0;
          onFrequencyUpdate(0);
          sharedDebugLog('[LOOPBACK-FREQ]', 'Display cleared (muted or deafened)');
        }
        return;
      }
      
      // Get frequency data from analyser
      analyserNode.getByteFrequencyData(dataArray);
      
      // Find dominant frequency (bin with highest amplitude)
      let maxAmplitude = 0;
      let maxIndex = 0;
      
      for (let i = 0; i < bufferLength; i++) {
        if (dataArray[i] > maxAmplitude) {
          maxAmplitude = dataArray[i];
          maxIndex = i;
        }
      }
      
      // Convert bin index to frequency (Hz)
      // frequency = (index * sampleRate) / fftSize
      const dominantFrequency = (maxIndex * sampleRate) / analyserNode.fftSize;
      
      // Update with detected frequency (only if significant amplitude)
      if (maxAmplitude > amplitudeThreshold) {
        currentFrequency = dominantFrequency;
        onFrequencyUpdate(dominantFrequency);
        noAudioCount = 0; // Reset counter when audio detected
        sharedDebugLog('[LOOPBACK-FREQ]', 'Dominant frequency:', dominantFrequency.toFixed(1), 'Hz, amplitude:', maxAmplitude);
      } else {
        // No significant audio - increment counter
        noAudioCount++;
        
        // Only clear display after consecutive checks without audio (and only if display is visible)
        if (noAudioCount >= noAudioThreshold && currentFrequency > 0) {
          currentFrequency = 0;
          onFrequencyUpdate(0);
          sharedDebugLog('[LOOPBACK-FREQ]', 'Display cleared after', noAudioCount, 'checks, amplitude:', maxAmplitude);
        } else if (noAudioCount < noAudioThreshold) {
          sharedDebugLog('[LOOPBACK-FREQ]', 'Low audio, amplitude:', maxAmplitude, 'count:', noAudioCount, '/', noAudioThreshold);
        }
      }
    }, updateIntervalMs);
    
    sharedDebugLog('[LOOPBACK-FREQ]', 'Frequency analysis started');
  }

  /**
   * Stop frequency analysis loop
   */
  function stop() {
    if (interval) {
      clearInterval(interval);
      interval = null;
      noAudioCount = 0;
      currentFrequency = 0;
      sharedDebugLog('[LOOPBACK-FREQ]', 'Frequency analysis stopped');
    }
  }

  /**
   * Get current frequency (for testing/debugging)
   */
  function getCurrentFrequency() {
    return currentFrequency;
  }

  return {
    start,
    stop,
    getCurrentFrequency
  };
}
