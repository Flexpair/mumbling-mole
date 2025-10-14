import audioContextManager, { ensureAudioContext } from "../audio/audio-context-manager";

/**
 * Utility function to wait for audio mixer to become available
 * @param {number} timeoutMs - Maximum time to wait in milliseconds (default: 5000)
 * @param {number} checkIntervalMs - How often to check in milliseconds (default: 50)
 * @returns {Promise<boolean>} - True if mixer becomes available, false if timeout
 */
async function waitForAudioMixer(timeoutMs = 5000, checkIntervalMs = 50) {
  const maxRetries = Math.floor(timeoutMs / checkIntervalMs);
  let retries = maxRetries;
  
  while (retries > 0 && !window._audioMixer) {
    await new Promise(resolve => setTimeout(resolve, checkIntervalMs));
    retries--;
  }
  
  return !!window._audioMixer;
}

// Debug flag for controlling verbose logging in audio handlers
const DEBUG_VOICE_LOGGING = false;

/**
 * Debug logging function that respects the DEBUG_VOICE_LOGGING flag
 * @param {string} tag - Log tag like '[BEEP]' 
 * @param {...any} args - Arguments to log
 */
function debugLog(tag, ...args) {
  if (DEBUG_VOICE_LOGGING) {
    console.log(tag, ...args);
  }
}

/**
 * AudioManager - Manages all audio-related functionality
 * Responsibilities:
 * - AudioContext lifecycle management
 * - Beeper (test tone) functionality
 * - Microphone permission handling
 * - Voice handler readiness tracking
 */
export class AudioManager {
  constructor(observables) {
    // Store references to observables from GlobalBindings
    this.isBeeping = observables.isBeeping;
    this.beeperReady = observables.beeperReady;
    this.voiceHandlerReady = observables.voiceHandlerReady;
    this.micPermissionDenied = observables.micPermissionDenied;
    this.micPermissionErrorMessage = observables.micPermissionErrorMessage;
    this.connected = observables.connected;
    
    // Internal state
    this.audioContext = null;
    this._persistentBeeper = null;
    this.micPermissionRetryCount = 0;
    this.maxMicPermissionRetryCount = 3;
    this.micPermissionRetryDelayMs = 1000;
  }

  /**
   * Initialize AudioContext with autoplay policy handling
   * Singleton pattern - reuses existing instance if available
   */
  async initializeAudioContext() {
    // SINGLETON-PATTERN: Prevent duplicate initialization - reuse existing instance
    if (this.audioContext) {
      return;
    }
    
    try {
      // AUTOPLAY-POLICY: Use managed AudioContext that handles browser autoplay restrictions
      this.audioContext = await ensureAudioContext({ 
        latencyHint: "interactive" 
      });

      // STATE-MONITORING: Set up event handlers for audio context state changes
      audioContextManager.onSuspend(() => {
        // AudioContext suspended - audio features may be limited until user interaction
      });

      audioContextManager.onResume(() => {
        // AudioContext resumed - audio features restored
      });

    } catch (error) {
      console.error('Failed to initialize AudioContext:', error);
      
      // FALLBACK-STRATEGY: Try legacy AudioContext creation if managed approach fails
      try {
        const AudioContextClass = window.AudioContext || window.webkitAudioContext;
        if (!AudioContextClass) {
          throw new Error("AudioContext is not supported in this browser");
        }
        this.audioContext = new AudioContextClass({ latencyHint: "interactive" });
      } catch (fallbackError) {
        console.error('Both managed and legacy AudioContext initialization failed:', fallbackError);
        // DEGRADED-MODE: AudioContext remains null, audio features will be disabled
      }
    }
  }

  /**
   * Initialize persistent beeper for audio testing
   * Creates a permanent oscillator controlled via gain
   */
  async _initializePersistentBeeper() {
    if (this._persistentBeeper) return; // Already initialized
    
    try {
      // MIXER-WAIT: Wait for audio mixer to become available
      debugLog('[BEEP]', 'Waiting for audio mixer...');
      const mixerAvailable = await waitForAudioMixer(5000, 50);
      
      if (!mixerAvailable) {
        debugLog('[BEEP]', 'Mixer not ready after timeout');
        this.beeperReady(false);
        return;
      }
      
      const mixer = window._audioMixer;
      const ac = await window.audioContextManager.getAudioContext();
      if (!ac || ac.state !== 'running') {
        debugLog(
          '[BEEP]',
          'AudioContext not ready',
          ac ? { state: ac.state, currentTime: ac.currentTime } : { ac: null }
        );
        this.beeperReady(false);
        return;
      }
      
      // DUAL-OUTPUT: Create permanent oscillator with split output for local+remote playback
      const oscillator = ac.createOscillator();
      const beepGain = ac.createGain();
      const localGain = ac.createGain();
      
      oscillator.frequency.setValueAtTime(440, ac.currentTime);
      oscillator.type = 'sine';
      beepGain.gain.setValueAtTime(0, ac.currentTime); // Start silent (remote path)
      localGain.gain.setValueAtTime(0, ac.currentTime); // Start silent (local path)
      
      // LATENCY-TEST: Split signal to hear both immediate local and delayed server echo
      oscillator.connect(beepGain);
      beepGain.connect(mixer);
      
      oscillator.connect(localGain);
      localGain.connect(ac.destination);
      
      // Start oscillator permanently
      oscillator.start();
      
      // Store references
      this._persistentBeeper = {
        oscillator,
        gain: beepGain,
        localGain: localGain,
        isPlaying: false
      };
      
      this.beeperReady(true);
      debugLog('[BEEP]', 'Persistent beeper initialized with dual output');
      
      this._checkFullBeepReadiness();
    } catch (err) {
      console.error('[BEEP] Failed to initialize persistent beeper:', err);
      this.beeperReady(false);
    }
  }

  /**
   * Verify both beeper AND voice handler are ready
   */
  _checkFullBeepReadiness() {
    const beeperOk = this.beeperReady();
    const voiceOk = this.voiceHandlerReady();
    
    debugLog('[BEEP-READY]', `Beeper: ${beeperOk}, Voice: ${voiceOk}`);
    
    if (beeperOk && voiceOk) {
      debugLog('[BEEP-READY]', '✅ Full beep system ready!');
    } else {
      debugLog('[BEEP-READY]', '⏳ Waiting for full initialization...');
    }
  }

  /**
   * Start beep tone for audio testing
   */
  startBeep() {
    debugLog('[BEEP]', 'Start beep requested');
    
    if (!this.connected()) {
      debugLog('[BEEP]', 'Not connected, ignoring beep');
      return;
    }
    
    // INSTANT-RESPONSE: If beeper is ready, start immediately
    if (this._persistentBeeper) {
      try {
        const beeper = this._persistentBeeper;
        const ac = beeper.gain.context;
        const currentTime = ac.currentTime;
        
        const attackTime = 0.005; // 5ms attack to eliminate clicks
        
        // LATENCY-TEST: Activate both local and remote paths
        beeper.gain.gain.cancelScheduledValues(currentTime);
        beeper.gain.gain.setValueAtTime(0, currentTime);
        beeper.gain.gain.linearRampToValueAtTime(0.4, currentTime + attackTime);
        
        beeper.localGain.gain.cancelScheduledValues(currentTime);
        beeper.localGain.gain.setValueAtTime(0, currentTime);
        beeper.localGain.gain.linearRampToValueAtTime(0.3, currentTime + attackTime);
        
        beeper.isPlaying = true;
        this.isBeeping(true);
        
        debugLog('[BEEP]', 'DUAL beep activated');
        return;
      } catch (err) {
        console.error('[BEEP] Error starting instant beep:', err);
      }
    }
    
    // FALLBACK: Initialize and retry
    debugLog('[BEEP]', 'Beeper not ready, initializing...');
    this._initializePersistentBeeper().then(() => {
      if (this._persistentBeeper && this.connected()) {
        this.startBeep();
      }
    });
  }

  /**
   * Stop beep tone
   */
  stopBeep() {
    debugLog('[BEEP]', 'Stop beep requested');
    
    if (!this._persistentBeeper || !this._persistentBeeper.isPlaying) {
      debugLog('[BEEP]', 'Beeper not playing, ignoring stop');
      return;
    }
    
    try {
      const beeper = this._persistentBeeper;
      const ac = beeper.gain.context;
      const currentTime = ac.currentTime;
      
      const initialDeclineTime = 0.3;
      const mainDecayTime = 1.0;
      
      // DUAL-FADEOUT: Fade out both paths
      beeper.gain.gain.cancelScheduledValues(currentTime);
      beeper.gain.gain.setValueAtTime(0.4, currentTime);
      beeper.gain.gain.linearRampToValueAtTime(0.25, currentTime + initialDeclineTime);
      beeper.gain.gain.exponentialRampToValueAtTime(0.001, currentTime + initialDeclineTime + mainDecayTime);
      
      beeper.localGain.gain.cancelScheduledValues(currentTime);
      beeper.localGain.gain.setValueAtTime(0.3, currentTime);
      beeper.localGain.gain.linearRampToValueAtTime(0.18, currentTime + initialDeclineTime);
      beeper.localGain.gain.exponentialRampToValueAtTime(0.001, currentTime + initialDeclineTime + mainDecayTime);
      
      beeper.isPlaying = false;
      this.isBeeping(false);
      
      debugLog('[BEEP]', 'Dual fadeout complete');
    } catch (err) {
      console.error('[BEEP] Error stopping beep:', err);
    }
  }

  /**
   * Attempt to get microphone permission
   * @param {Function} onSuccess - Callback when permission granted
   */
  _attemptMicrophonePermission(onSuccess) {
    if (!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia)) {
      return;
    }

    navigator.mediaDevices
      .getUserMedia({ audio: true })
      .then((stream) => {
        this.micPermissionRetryCount = 0;
        this.micPermissionDenied(false);
        this.micPermissionErrorMessage("");
        stream.getTracks().forEach((track) => track.stop());
        
        if (onSuccess) {
          onSuccess();
        }
      })
      .catch((err) => {
        console.error("Microphone permission denied on retry:", err);
        this.micPermissionRetryCount += 1;
        const isPermissionBlocked =
          err &&
          (err.name === "NotAllowedError" ||
            err.name === "SecurityError" ||
            (typeof err.message === "string" &&
              err.message.toLowerCase().includes("denied")));

        if (isPermissionBlocked) {
          this.micPermissionErrorMessage(
            "Microphone access is blocked by the browser. Please allow it in the address bar or system settings, then try again."
          );
        }

        if (this.micPermissionRetryCount >= this.maxMicPermissionRetryCount) {
          return;
        }
        if (isPermissionBlocked) {
          return;
        }
        setTimeout(() => this._attemptMicrophonePermission(onSuccess), this.micPermissionRetryDelayMs);
      });
  }

  /**
   * Retry microphone permission request
   * @param {Function} onSuccess - Callback when permission granted
   */
  retryMicrophonePermission(onSuccess) {
    this.micPermissionRetryCount = 0;
    this.micPermissionErrorMessage("");
    this._attemptMicrophonePermission(onSuccess);
  }

  /**
   * Reset audio manager state
   */
  reset() {
    this.stopBeep();
    this.beeperReady(false);
    this.voiceHandlerReady(false);
    this._persistentBeeper = null;
  }
}
