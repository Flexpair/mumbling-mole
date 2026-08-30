import { defineStore } from 'pinia';
import { ref, shallowRef } from 'vue';
import audioContextManager, { ensureAudioContext } from '../audio/audio-context-manager';
import { getCurrentMixer } from '../audio/voice';
import { debugLog } from '../utils/debug-utils';
import { createCachedInitWithCheck } from '../utils/promise-cache-utils';

export const useAudioStore = defineStore('audio', () => {
  // Audio context (reactive ref)
  const audioContext = shallowRef(null);
  const _audioWorkletModulesLoaded = new Set();
  
  // Audio lock state (reactive)
  const audioLockActive = ref(false);
  const audioLockReason = ref(null);
  const audioLockDetails = ref(null);
  
  // Microphone permission state (reactive)
  const micPermissionDenied = ref(false);
  const micPermissionErrorMessage = ref('');
  
  // Beeper state (reactive)
  const isBeeping = ref(false);
  const beeperReady = ref(false);
  let _persistentBeeper = null;
  let _persistentBeeperMixer = null;

  function resetBeeper() {
    const beeper = _persistentBeeper;
    if (!beeper) {
      beeperReady.value = false;
      isBeeping.value = false;
      return;
    }
    try {
      beeper.oscillator.stop?.();
    } catch (error) {
      debugLog('[BEEP]', 'Persistent beeper was already stopped:', error);
    }
    for (const node of [beeper.oscillator, beeper.gain, beeper.localGain]) {
      node?.disconnect?.();
    }
    _persistentBeeper = null;
    _persistentBeeperMixer = null;
    isBeeping.value = false;
    beeperReady.value = false;
  }

  // SYNC-WITH-MANAGER: Ensure store stays in sync with AudioContextManager singleton
  // This handles cases where AudioContext is initialized by other modules (e.g. voice.js)
  // and ensures the store always reflects the current AudioContext state.
  audioContextManager.onReady((ctx) => {
    if (audioContext.value !== ctx) {
      audioContext.value = ctx;
      debugLog('[AUDIO]', 'AudioStore synced with AudioContextManager (onReady)');
    }
  });

  // Check if already initialized (e.g. if store is created after AudioContext)
  if (audioContextManager.audioContext && !audioContext.value) {
    audioContext.value = audioContextManager.audioContext;
  }

  /**
   * Get AudioContext instance
   * @returns {AudioContext|null}
   */
  function getAudioContext() {
    return audioContext.value;
  }

  /**
   * Initialize managed AudioContext with autoplay policy handling
   * RACE-SAFE: Multiple concurrent calls will reuse the same initialization
   */
  const initializeAudioContext = createCachedInitWithCheck(
    () => audioContext.value,
    async () => {
      try {
        // Use managed AudioContext that handles browser autoplay restrictions
        const ctx = await ensureAudioContext({ 
          latencyHint: 'interactive' 
        });
        audioContext.value = ctx;

      } catch (error) {
        console.error('Failed to initialize AudioContext:', error);
        throw error;
      }
      
      return audioContext.value;
    }
  );

  /**
   * Resume AudioContext if suspended
   */
  async function resumeAudioContext() {
    if (!audioContext.value) {
      await initializeAudioContext();
    }
    await audioContextManager.resumeAudioContext();
  }

  /**
   * Load AudioWorklet module safely (prevents duplicate loading races)
   * RACE-SAFE: Multiple concurrent calls for same module will only load once
   * @param {string} moduleUrl - URL of the AudioWorklet processor module
   */
  async function loadAudioWorkletModule(moduleUrl) {
    if (!audioContext.value) {
      throw new Error('AudioContext not initialized');
    }
    
    // Return immediately if already loaded
    if (_audioWorkletModulesLoaded.has(moduleUrl)) {
      return;
    }
    
    try {
      await audioContext.value.audioWorklet.addModule(moduleUrl);
      _audioWorkletModulesLoaded.add(moduleUrl);
    } catch (err) {
      // InvalidStateError means module was already loaded by another concurrent call
      if (err.name === 'InvalidStateError') {
        _audioWorkletModulesLoaded.add(moduleUrl);
      } else {
        throw err;
      }
    }
  }

  /**
   * Activate audio lock (disable audio features)
   * @param {string} reason - Lock reason (e.g., 'sample-rate')
   * @param {object} details - Additional details (e.g., {sampleRate: 44100})
   */
  function activateAudioLock(reason, details = {}) {
    audioLockReason.value = reason;
    audioLockDetails.value = details;
    audioLockActive.value = true;
  }

  /**
   * Clear audio lock
   * @param {object} options - Options {resetStates: boolean}
   */
  function clearAudioLock({ resetStates = false } = {}) {
    audioLockActive.value = false;
    audioLockReason.value = null;
    audioLockDetails.value = null;
  }

  /**
   * Reset microphone permission state so user can retry
   */
  function retryMicrophonePermission() {
    micPermissionDenied.value = false;
    micPermissionErrorMessage.value = '';
  }

  /**
   * Initialize persistent beeper for latency testing
   * 
   * EVENT-BASED: No timeouts! This method is called when audio mixer becomes available.
   * RACE-SAFE: Multiple concurrent calls will reuse the same initialization.
   */
  const createPersistentBeeper = createCachedInitWithCheck(
    () => null,
    async (mixer) => {
      // Check if mixer is available NOW (no waiting, no timeout)
      if (!mixer) {
        debugLog('[BEEP]', 'Mixer not yet available, will retry when mixer is ready');
        beeperReady.value = false;
        return null;
      }
      
      const ac = await globalThis.audioContextManager.getAudioContext();
      if (!ac) {
        debugLog('[BEEP]', 'AudioContext not available');
        beeperReady.value = false;
        return null;
      }
      
      // AUTOPLAY-POLICY: Allow beeper initialization even when AudioContext is suspended
      // The Piano button click will resume the context via user gesture
      // Only block if context is closed or in an error state
      if (ac.state === 'closed') {
        debugLog('[BEEP]', 'AudioContext is closed', { state: ac.state });
        beeperReady.value = false;
        return null;
      }
      
      debugLog('[BEEP]', 'Initializing persistent beeper...', { state: ac.state });
      
      try {
        // Create permanent oscillator with split output for local+remote playback
        const oscillator = ac.createOscillator();
        const beepGain = ac.createGain();
        const localGain = ac.createGain();
        
        oscillator.frequency.setValueAtTime(440, ac.currentTime);
        oscillator.type = 'sine';
        beepGain.gain.setValueAtTime(0, ac.currentTime);
        localGain.gain.setValueAtTime(0, ac.currentTime);
        
        // Split signal for local and remote paths
        oscillator.connect(beepGain);
        beepGain.connect(mixer);
        
        oscillator.connect(localGain);
        localGain.connect(ac.destination);
        
        oscillator.start();
        
        _persistentBeeper = {
          oscillator,
          gain: beepGain,
          localGain: localGain,
          isPlaying: false
        };
        _persistentBeeperMixer = mixer;
        
        beeperReady.value = true;
        return _persistentBeeper;
      } catch (err) {
        console.error('[BEEP] Failed to initialize persistent beeper:', err);
        beeperReady.value = false;
        return null;
      }
    }
  );

  async function initializePersistentBeeper() {
    const mixer = getCurrentMixer();
    if (_persistentBeeper && _persistentBeeperMixer !== mixer) {
      resetBeeper();
    }
    if (_persistentBeeper) return _persistentBeeper;
    return createPersistentBeeper(mixer);
  }

  /**
   * Start beeping
   * 
   * GUARD: Only starts if beeper is ready. No fallback initialization - UI should
   * ensure pianoButtonReady is true before allowing startBeep() calls.
   */
  async function startBeep() {
    debugLog('[BEEP]', 'Start beep requested, beeperReady:', beeperReady.value);
    
    // Guard: Beeper must be initialized before starting
    if (!_persistentBeeper) {
      debugLog('[BEEP]', 'Beeper not ready, ignoring startBeep - UI should disable button');
      return;
    }
    
    try {
      const beeper = _persistentBeeper;
      const ac = beeper.gain.context;
      
      // AUTOPLAY-POLICY: Resume AudioContext if suspended (Piano button = user gesture)
      if (ac.state === 'suspended') {
        debugLog('[BEEP]', 'Resuming suspended AudioContext...');
        await ac.resume();
        debugLog('[BEEP]', 'AudioContext resumed:', { state: ac.state });
      }
      
      const currentTime = ac.currentTime;
      const attackTime = 0.005;
      
      beeper.gain.gain.cancelScheduledValues(currentTime);
      beeper.gain.gain.setValueAtTime(0, currentTime);
      beeper.gain.gain.linearRampToValueAtTime(0.4, currentTime + attackTime);
      
      beeper.localGain.gain.cancelScheduledValues(currentTime);
      beeper.localGain.gain.setValueAtTime(0, currentTime);
      beeper.localGain.gain.linearRampToValueAtTime(0.3, currentTime + attackTime);
      
      beeper.isPlaying = true;
      isBeeping.value = true;
      
      debugLog('[BEEP]', 'DUAL beep activated');
    } catch (err) {
      console.error('[BEEP] Error starting beep:', err);
    }
  }

  /**
   * Stop beeping
   */
  function stopBeep() {
    debugLog('[BEEP]', 'Stop beep requested');
    
    if (!_persistentBeeper?.isPlaying) {
      debugLog('[BEEP]', 'Beeper not playing, ignoring stop');
      return;
    }
    
    try {
      const beeper = _persistentBeeper;
      const ac = beeper.gain.context;
      const currentTime = ac.currentTime;
      
      const initialDeclineTime = 0.3;
      const mainDecayTime = 1;
      const totalFadeTime = initialDeclineTime + mainDecayTime;
      
      beeper.gain.gain.cancelScheduledValues(currentTime);
      beeper.gain.gain.setValueAtTime(0.4, currentTime);
      beeper.gain.gain.linearRampToValueAtTime(0.25, currentTime + initialDeclineTime);
      beeper.gain.gain.exponentialRampToValueAtTime(0.001, currentTime + totalFadeTime);
      beeper.gain.gain.setValueAtTime(0, currentTime + totalFadeTime);
      
      beeper.localGain.gain.cancelScheduledValues(currentTime);
      beeper.localGain.gain.setValueAtTime(0.3, currentTime);
      beeper.localGain.gain.linearRampToValueAtTime(0.18, currentTime + initialDeclineTime);
      beeper.localGain.gain.exponentialRampToValueAtTime(0.001, currentTime + totalFadeTime);
      beeper.localGain.gain.setValueAtTime(0, currentTime + totalFadeTime);
      
      beeper.isPlaying = false;
      isBeeping.value = false;
      
      debugLog('[BEEP]', `Dual fadeout complete with final silence at ${currentTime + totalFadeTime}`);
    } catch (err) {
      console.error('[BEEP] Error stopping beep:', err);
    }
  }

  /**
   * Notify user about audio lock
   */
  function notifyAudioLock() {
    if (audioLockActive.value) {
      const reason = audioLockReason.value;
      const details = audioLockDetails.value;
      
      if (reason === 'mic_permission') {
        micPermissionDenied.value = true;
        micPermissionErrorMessage.value = details;
      }
    }
  }

  return {
    // State
    audioContext,
    audioLockActive,
    audioLockReason,
    audioLockDetails,
    micPermissionDenied,
    micPermissionErrorMessage,
    isBeeping,
    beeperReady,
    
    // Methods
    getAudioContext,
    initializeAudioContext,
    resumeAudioContext,
    loadAudioWorkletModule,
    startBeep,
    stopBeep,
    resetBeeper,
    initializePersistentBeeper,
    retryMicrophonePermission,
    notifyAudioLock,
    activateAudioLock,
    clearAudioLock
  };
});
