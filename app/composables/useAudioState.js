import { ref } from 'vue';
import audioContextManager, { ensureAudioContext } from '../audio/audio-context-manager';
import { getCurrentMixer } from '../audio/voice';
import { debugLog } from './debug-utils';
import { createCachedInitWithCheck } from './promise-cache-utils';

/**
 * useAudioState - Vue composable for audio context, permissions, and beeper
 * 
 * Responsibilities:
 * - AudioContext lifecycle management
 * - Audio lock state (sample rate warnings)
 * - Microphone permission handling
 * - Beeper/tone generator for latency testing
 * 
 * Migration from Knockout:
 * - ko.observable() → ref()
 * - Internal state remains non-reactive (audioContext, _persistentBeeper)
 */
export function useAudioState() {
  // Audio context (internal state, not reactive)
  let audioContext = null;
  let _audioWorkletModulesLoaded = new Set();
  
  // Audio lock state (reactive)
  const audioLockActive = ref(false);
  const audioLockReason = ref(null);
  const audioLockDetails = ref(null);
  
  // Microphone permission state (reactive)
  const micPermissionDenied = ref(false);
  const micPermissionErrorMessage = ref('');
  let micPermissionRetryCount = 0;
  const maxMicPermissionRetryCount = 3;
  const micPermissionRetryDelayMs = 1000;
  
  // Beeper state (reactive)
  const isBeeping = ref(false);
  const beeperReady = ref(false);
  let _persistentBeeper = null;

  /**
   * Get AudioContext instance
   * @returns {AudioContext|null}
   */
  function getAudioContext() {
    return audioContext;
  }

  /**
   * Initialize managed AudioContext with autoplay policy handling
   * RACE-SAFE: Multiple concurrent calls will reuse the same initialization
   */
  const initializeAudioContext = createCachedInitWithCheck(
    () => audioContext,
    async () => {
      try {
        // Use managed AudioContext that handles browser autoplay restrictions
        audioContext = await ensureAudioContext({ 
          latencyHint: 'interactive' 
        });

        // Set up event handlers for audio context state changes
        audioContextManager.onSuspend(() => {
          // AudioContext suspended - audio features may be limited
        });

        audioContextManager.onResume(() => {
          // AudioContext resumed - audio features restored
        });

      } catch (error) {
        console.error('Failed to initialize AudioContext:', error);
        
        // Fallback: Try legacy AudioContext creation
        try {
          const AudioContextClass = globalThis.AudioContext || globalThis.webkitAudioContext;
          if (!AudioContextClass) {
            throw new Error('AudioContext is not supported in this browser');
          }
          audioContext = new AudioContextClass({ latencyHint: 'interactive' });
        } catch (fallbackError) {
          console.error('Both managed and legacy AudioContext initialization failed:', fallbackError);
        }
      }
      
      return audioContext;
    }
  );

  /**
   * Resume AudioContext if suspended
   */
  async function resumeAudioContext() {
    if (audioContext?.state === 'suspended') {
      await audioContext.resume();
    } else if (!audioContext) {
      await initializeAudioContext();
    }
  }

  /**
   * Load AudioWorklet module safely (prevents duplicate loading races)
   * RACE-SAFE: Multiple concurrent calls for same module will only load once
   * @param {string} moduleUrl - URL of the AudioWorklet processor module
   */
  async function loadAudioWorkletModule(moduleUrl) {
    if (!audioContext) {
      throw new Error('AudioContext not initialized');
    }
    
    // Return immediately if already loaded
    if (_audioWorkletModulesLoaded.has(moduleUrl)) {
      return;
    }
    
    try {
      await audioContext.audioWorklet.addModule(moduleUrl);
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
   * Attempt to get microphone permission
   */
  function attemptMicrophonePermission() {
    if (!navigator.mediaDevices?.getUserMedia) {
      return;
    }

    navigator.mediaDevices
      .getUserMedia({ audio: true })
      .then((stream) => {
        micPermissionRetryCount = 0;
        micPermissionDenied.value = false;
        micPermissionErrorMessage.value = '';
        for (const track of stream.getTracks()) {
          track.stop();
        }
      })
      .catch((err) => {
        console.error('Microphone permission denied on retry:', err);
        micPermissionRetryCount += 1;
        const isPermissionBlocked =
          err &&
          (err.name === 'NotAllowedError' ||
            err.name === 'SecurityError' ||
            (typeof err.message === 'string' &&
              err.message.toLowerCase().includes('denied')));

        if (isPermissionBlocked) {
          micPermissionErrorMessage.value =
            'Microphone access is blocked by the browser. Please allow it in the address bar or system settings, then try again.';
        }

        if (micPermissionRetryCount >= maxMicPermissionRetryCount) {
          return;
        }
        if (isPermissionBlocked) {
          return;
        }
        setTimeout(() => attemptMicrophonePermission(), micPermissionRetryDelayMs);
      });
  }

  /**
   * Retry microphone permission request
   */
  function retryMicrophonePermission() {
    micPermissionRetryCount = 0;
    micPermissionErrorMessage.value = '';
    attemptMicrophonePermission();
  }

  /**
   * Initialize persistent beeper for latency testing
   * 
   * EVENT-BASED: No timeouts! This method is called when audio mixer becomes available.
   * RACE-SAFE: Multiple concurrent calls will reuse the same initialization.
   */
  const initializePersistentBeeper = createCachedInitWithCheck(
    () => _persistentBeeper,
    async () => {
      // Check if mixer is available NOW (no waiting, no timeout)
      // RACE-SAFE: Use getCurrentMixer() instead of window._audioMixer to avoid race conditions
      const mixer = getCurrentMixer();
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
        
        beeperReady.value = true;
        console.log('[BEEP] Persistent beeper initialized successfully');
        return _persistentBeeper;
      } catch (err) {
        console.error('[BEEP] Failed to initialize persistent beeper:', err);
        beeperReady.value = false;
        return null;
      }
    }
  );

  /**
   * Start beeping
   */
  async function startBeep() {
    debugLog('[BEEP]', 'Start beep requested');
    
    if (_persistentBeeper) {
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
        return;
      } catch (err) {
        console.error('[BEEP] Error starting instant beep:', err);
      }
    }
    
    // Fallback: initialize and retry
    debugLog('[BEEP]', 'Beeper not ready, initializing...');
    initializePersistentBeeper().then(() => {
      if (_persistentBeeper) {
        startBeep();
      }
    });
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
   * Reset beeper state
   */
  function resetBeeper() {
    stopBeep();
    beeperReady.value = false;
    // Note: we don't destroy _persistentBeeper, it can be reused
  }

  // Return composable API
  return {
    // State (reactive)
    audioLockActive,
    audioLockReason,
    audioLockDetails,
    micPermissionDenied,
    micPermissionErrorMessage,
    isBeeping,
    beeperReady,
    
    // Getters (for internal state access)
    getAudioContext,
    
    // Methods
    initializeAudioContext,
    resumeAudioContext,
    loadAudioWorkletModule,
    activateAudioLock,
    clearAudioLock,
    attemptMicrophonePermission,
    retryMicrophonePermission,
    initializePersistentBeeper,
    startBeep,
    stopBeep,
    resetBeeper,
    
    // Expose audioContext for backward compatibility
    get audioContext() {
      return audioContext;
    }
  };
}
