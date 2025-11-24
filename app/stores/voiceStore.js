import { defineStore } from 'pinia';
import { ref, shallowRef } from 'vue';
import { useAudioStore } from './audioStore';
import { useConnectionStore } from './connectionStore';
import {
  ContinuousVoiceHandler,
  PushToTalkVoiceHandler,
  initVoice,
  onAudioMixerReady,
} from '../audio/voice';
import { translate } from '../localize';
import { debugLog } from '../composables/debug-utils';

export const useVoiceStore = defineStore('voice', () => {
  const audioStore = useAudioStore();
  const connectionStore = useConnectionStore();

  // Voice handler instance (reactive ref)
  const voiceHandler = shallowRef(null);
  
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
   * Setup audio/voice for connection
   * @param {boolean} audioEnabled - Whether audio is enabled
   * @param {number} sampleRate - Current sample rate
   */
  async function setupVoiceForConnection(audioEnabled, sampleRate) {
    if (audioEnabled) {
      initVoiceInput(
        (data) => {
          if (connectionStore.getClient()) {
            writeVoiceData(data);
          } else {
            endVoiceHandler();
          }
        },
        (err) => {
          console.log(translate('logentry.mic_init_error'), err);
        },
        () => {
          audioStore.initializePersistentBeeper();
        }
      );
    } else {
      audioStore.activateAudioLock('sample-rate', { sampleRate });
      endVoiceHandler();
    }

    try {
      await audioStore.resumeAudioContext();
      
      try {
        await audioStore.loadAudioWorkletModule('playback-buffer-processor.js');
      } catch (err) {
        console.warn('[AUDIO-INIT] Playback AudioWorklet pre-warm failed:', err);
      }
    } catch (error) {
      console.warn('AudioContext resume failed, continuing anyway:', error);
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
    if (voiceHandler.value) {
      try {
        voiceHandler.value.end();
      } catch (err) {
        console.error('[VOICE-HANDLER] Error during cleanup:', err);
      }
      voiceHandler.value = null;
    }
    
    // Reset ready state during recreation
    voiceHandlerReady.value = false;
    debugLog('[VOICE-HANDLER]', 'Recreating voice handler...');
    
    let mode = settings.voiceMode.value;
    
    // Determine voice routing target
    // target=31 routes to server loopback for echo testing
    // target=0 routes normally to channel/user
    let target = isLoopbackMode.value ? 31 : 0;
    
    // Create appropriate handler based on voice activation mode
    let newHandler;
    if (mode === 'cont') {
      newHandler = new ContinuousVoiceHandler(client, settings, target);
    } else if (mode === 'ptt') {
      newHandler = new PushToTalkVoiceHandler(client, settings, target);
    } else {
      console.error(translate('logentry.unknown_voice_mode'), mode);
      return;
    }
    
    voiceHandler.value = newHandler;
    
    // Connect voice handler events
    if (onStartedTalking) {
      voiceHandler.value.on('started_talking', onStartedTalking);
    }
    if (onStoppedTalking) {
      voiceHandler.value.on('stopped_talking', onStoppedTalking);
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
    if (voiceHandler.value) {
      voiceHandler.value.setMute(muted);
    }
  }

  /**
   * Write voice data to handler
   * @param {ArrayBuffer} data - Voice data to send
   */
  function writeVoiceData(data) {
    if (voiceHandler.value) {
      voiceHandler.value.write(data);
    }
  }

  /**
   * Get current voice handler instance
   * @returns {object|null}
   */
  function getVoiceHandler() {
    return voiceHandler.value;
  }

  /**
   * End voice handler
   */
  function endVoiceHandler() {
    if (voiceHandler.value) {
      voiceHandler.value.end();
      voiceHandler.value = null;
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

  return {
    // State
    voiceHandler,
    isLoopbackMode,
    voiceHandlerReady,
    loopbackDominantFrequency,
    
    // Methods
    initVoiceInput,
    setupVoiceForConnection,
    updateVoiceHandler,
    updateLoopbackFrequency,
    setMute,
    writeVoiceData,
    getVoiceHandler,
    endVoiceHandler,
    reset
  };
});
