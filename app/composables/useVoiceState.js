import { ref } from 'vue';
import {
  ContinuousVoiceHandler,
  PushToTalkVoiceHandler,
  initVoice,
  onAudioMixerReady,
} from '../audio/voice';
import { translate } from '../localize';
import { debugLog } from './debug-utils';

/**
 * useVoiceState - Vue composable for voice handler and loopback testing
 * 
 * Responsibilities:
 * - Voice handler lifecycle (PTT/continuous)
 * - Loopback test mode management
 * - Voice handler ready state tracking
 * - Voice data routing (normal vs loopback target)
 * 
 * Migration from Knockout:
 * - ko.observable() → ref()
 * - Internal handler remains non-reactive
 */
export function useVoiceState() {
  // Voice handler instance (internal, not reactive)
  let voiceHandler = null;
  
  // Loopback mode - routes voice to server echo (target=31)
  const isLoopbackMode = ref(false);
  
  // Voice handler ready state
  const voiceHandlerReady = ref(false);
  
  // Loopback frequency analysis - tracks dominant frequency in returned audio
  const loopbackDominantFrequency = ref(0);

  /**
   * Initialize voice input capture
   * @param {Function} onData - Callback for voice data
   * @param {Function} onError - Callback for errors
   * @param {Function} onMixerReady - Optional callback when audio mixer becomes ready
   */
  function initVoiceInput(onData, onError, onMixerReady) {
    initVoice(onData, onError);
    
    // Register for mixer ready notification if callback provided
    if (onMixerReady) {
      onAudioMixerReady(onMixerReady);
    }
  }

  /**
   * Update/recreate voice handler based on settings
   * RACE-SAFE: Ensures previous handler cleanup completes before creating new one
   * @param {object} client - Mumble client instance
   * @param {object} settings - Settings object with voiceMode, etc.
   * @param {Function} onStartedTalking - Callback when user starts talking
   * @param {Function} onStoppedTalking - Callback when user stops talking
   */
  function updateVoiceHandler(client, settings, onStartedTalking, onStoppedTalking) {
    if (!client) {
      return;
    }
    
    // Cleanup existing handler
    // Note: .end() is synchronous but we ensure null assignment before proceeding
    if (voiceHandler) {
      try {
        voiceHandler.end();
      } catch (err) {
        console.error('[VOICE-HANDLER] Error during cleanup:', err);
      }
      voiceHandler = null;
    }
    
    // Reset ready state during recreation
    voiceHandlerReady.value = false;
    debugLog('[VOICE-HANDLER]', 'Recreating voice handler...');
    
    let mode = settings.voiceMode;
    
    // Determine voice routing target
    // target=31 routes to server loopback for echo testing
    // target=0 routes normally to channel/user
    let target = isLoopbackMode.value ? 31 : 0;
    
    // Create appropriate handler based on voice activation mode
    if (mode === 'cont') {
      voiceHandler = new ContinuousVoiceHandler(client, settings, target);
    } else if (mode === 'ptt') {
      voiceHandler = new PushToTalkVoiceHandler(client, settings, target);
    } else {
      console.error(translate('logentry.unknown_voice_mode'), mode);
      return;
    }
    
    // Connect voice handler events
    if (onStartedTalking) {
      voiceHandler.on('started_talking', onStartedTalking);
    }
    if (onStoppedTalking) {
      voiceHandler.on('stopped_talking', onStoppedTalking);
    }
    
    // Mark as ready
    voiceHandlerReady.value = true;
    debugLog('[VOICE-HANDLER]', 'Voice handler fully initialized and ready');
  }

  /**
   * Update loopback frequency display
   * @param {number} frequency - Detected dominant frequency in Hz
   */
  function updateLoopbackFrequency(frequency) {
    if (isLoopbackMode.value) {
      loopbackDominantFrequency.value = Math.round(frequency * 10) / 10;
    }
  }

  /**
   * Set mute state on voice handler
   * @param {boolean} muted - Mute state
   */
  function setMute(muted) {
    if (voiceHandler) {
      voiceHandler.setMute(muted);
    }
  }

  /**
   * Write voice data to handler
   * @param {ArrayBuffer} data - Voice data to send
   */
  function writeVoiceData(data) {
    if (voiceHandler) {
      voiceHandler.write(data);
    }
  }

  /**
   * Get current voice handler instance
   * @returns {object|null}
   */
  function getVoiceHandler() {
    return voiceHandler;
  }

  /**
   * End voice handler
   */
  function endVoiceHandler() {
    if (voiceHandler) {
      voiceHandler.end();
      voiceHandler = null;
    }
    voiceHandlerReady.value = false;
  }

  /**
   * Reset voice state
   */
  function reset() {
    endVoiceHandler();
    isLoopbackMode.value = false;
    voiceHandlerReady.value = false;
  }

  // Return composable API
  return {
    // State (reactive)
    isLoopbackMode,
    voiceHandlerReady,
    loopbackDominantFrequency,
    
    // Methods
    initVoiceInput,
    updateVoiceHandler,
    updateLoopbackFrequency,
    setMute,
    writeVoiceData,
    getVoiceHandler,
    endVoiceHandler,
    reset,
    
    // Expose voiceHandler for backward compatibility
    get voiceHandler() {
      return voiceHandler;
    }
  };
}
