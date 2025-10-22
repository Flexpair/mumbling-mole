import ko from "knockout";
import audioContextManager, { ensureAudioContext } from "../audio/audio-context-manager";
import { getCurrentMixer } from "../audio/voice";

const DEBUG_VOICE_LOGGING = false; // Set to true for debugging beeper initialization

function debugLog(tag, ...args) {
  if (DEBUG_VOICE_LOGGING) {
    console.log(tag, ...args);
  }
}

/**
 * AudioState - manages audio context, permissions, and beeper functionality
 * 
 * Responsibilities:
 * - AudioContext lifecycle management
 * - Audio lock state (sample rate warnings)
 * - Microphone permission handling
 * - Beeper/tone generator for latency testing
 */
export default class AudioState {
  // Audio context
  audioContext = null;
  _audioContextInitPromise = null; // Track pending initialization
  _audioWorkletModulesLoaded = new Set(); // Track loaded AudioWorklet modules
  
  // Audio lock state
  audioLockActive = ko.observable(false);
  audioLockReason = ko.observable(null);
  audioLockDetails = ko.observable(null);
  
  // Microphone permission state
  micPermissionDenied = ko.observable(false);
  micPermissionErrorMessage = ko.observable("");
  micPermissionRetryCount = 0;
  maxMicPermissionRetryCount = 3;
  micPermissionRetryDelayMs = 1000;
  
  // Beeper state
  isBeeping = ko.observable(false);
  beeperReady = ko.observable(false);
  _persistentBeeper = null;
  _beeperInitPromise = null; // Track pending beeper initialization

  constructor() {
    // Initialize audio context
    this.initializeAudioContext();
  }

  /**
   * Initialize managed AudioContext with autoplay policy handling
   * RACE-SAFE: Multiple concurrent calls will reuse the same initialization
   */
  async initializeAudioContext() {
    // Return existing instance if already initialized
    if (this.audioContext) {
      return;
    }
    
    // Return pending promise if initialization is in progress
    if (this._audioContextInitPromise) {
      return this._audioContextInitPromise;
    }
    
    // Start new initialization
    this._audioContextInitPromise = (async () => {
      try {
        // Use managed AudioContext that handles browser autoplay restrictions
        this.audioContext = await ensureAudioContext({ 
          latencyHint: "interactive" 
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
            throw new Error("AudioContext is not supported in this browser");
          }
          this.audioContext = new AudioContextClass({ latencyHint: "interactive" });
        } catch (fallbackError) {
          console.error('Both managed and legacy AudioContext initialization failed:', fallbackError);
        }
      } finally {
        // Clear promise reference once complete
        this._audioContextInitPromise = null;
      }
    })();
    
    return this._audioContextInitPromise;
  }

  /**
   * Resume AudioContext if suspended
   */
  async resumeAudioContext() {
    if (this.audioContext && this.audioContext.state === "suspended") {
      await this.audioContext.resume();
    } else if (!this.audioContext) {
      await this.initializeAudioContext();
    }
  }

  /**
   * Load AudioWorklet module safely (prevents duplicate loading races)
   * RACE-SAFE: Multiple concurrent calls for same module will only load once
   * @param {string} moduleUrl - URL of the AudioWorklet processor module
   */
  async loadAudioWorkletModule(moduleUrl) {
    if (!this.audioContext) {
      throw new Error('AudioContext not initialized');
    }
    
    // Return immediately if already loaded
    if (this._audioWorkletModulesLoaded.has(moduleUrl)) {
      return;
    }
    
    try {
      await this.audioContext.audioWorklet.addModule(moduleUrl);
      this._audioWorkletModulesLoaded.add(moduleUrl);
    } catch (err) {
      // InvalidStateError means module was already loaded by another concurrent call
      if (err.name === 'InvalidStateError') {
        this._audioWorkletModulesLoaded.add(moduleUrl);
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
  activateAudioLock(reason, details = {}) {
    this.audioLockReason(reason);
    this.audioLockDetails(details);
    this.audioLockActive(true);
  }

  /**
   * Clear audio lock
   * @param {object} options - Options {resetStates: boolean}
   */
  clearAudioLock({ resetStates = false } = {}) {
    this.audioLockActive(false);
    this.audioLockReason(null);
    this.audioLockDetails(null);
  }

  /**
   * Attempt to get microphone permission
   */
  attemptMicrophonePermission() {
    if (!navigator.mediaDevices?.getUserMedia) {
      return;
    }

    navigator.mediaDevices
      .getUserMedia({ audio: true })
      .then((stream) => {
        this.micPermissionRetryCount = 0;
        this.micPermissionDenied(false);
        this.micPermissionErrorMessage("");
        for (const track of stream.getTracks()) {
          track.stop();
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
        setTimeout(() => this.attemptMicrophonePermission(), this.micPermissionRetryDelayMs);
      });
  }

  /**
   * Retry microphone permission request
   */
  retryMicrophonePermission() {
    this.micPermissionRetryCount = 0;
    this.micPermissionErrorMessage("");
    this.attemptMicrophonePermission();
  }

  /**
   * Initialize persistent beeper for latency testing
   * 
   * EVENT-BASED: No timeouts! This method is called when audio mixer becomes available.
   * RACE-SAFE: Multiple concurrent calls will reuse the same initialization.
   */
  async initializePersistentBeeper() {
    // Return if already initialized
    if (this._persistentBeeper) {
      this.beeperReady(true);
      return;
    }
    
    // Return pending promise if initialization is in progress
    if (this._beeperInitPromise) {
      return this._beeperInitPromise;
    }
    
    // Start new initialization
    this._beeperInitPromise = (async () => {
      try {
        // Check if mixer is available NOW (no waiting, no timeout)
        // RACE-SAFE: Use getCurrentMixer() instead of window._audioMixer to avoid race conditions
        const mixer = getCurrentMixer();
      if (!mixer) {
        debugLog('[BEEP]', 'Mixer not yet available, will retry when mixer is ready');
        this.beeperReady(false);
        return;
      }
      
      const ac = await globalThis.audioContextManager.getAudioContext();
      if (!ac) {
        debugLog('[BEEP]', 'AudioContext not available');
        this.beeperReady(false);
        return;
      }
      
      // AUTOPLAY-POLICY: Allow beeper initialization even when AudioContext is suspended
      // The Piano button click will resume the context via user gesture
      // Only block if context is closed or in an error state
      if (ac.state === 'closed') {
        debugLog('[BEEP]', 'AudioContext is closed', { state: ac.state });
        this.beeperReady(false);
        return;
      }
      
      debugLog('[BEEP]', 'Initializing persistent beeper...', { state: ac.state });
      
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
      
        this._persistentBeeper = {
          oscillator,
          gain: beepGain,
          localGain: localGain,
          isPlaying: false
        };
        
        this.beeperReady(true);
        console.log('[BEEP] Persistent beeper initialized successfully');
      } catch (err) {
        console.error('[BEEP] Failed to initialize persistent beeper:', err);
        this.beeperReady(false);
      } finally {
        // Clear promise reference once complete
        this._beeperInitPromise = null;
      }
    })();
    
    return this._beeperInitPromise;
  }

  /**
   * Start beeping
   */
  async startBeep() {
    debugLog('[BEEP]', 'Start beep requested');
    
    if (this._persistentBeeper) {
      try {
        const beeper = this._persistentBeeper;
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
        this.isBeeping(true);
        
        debugLog('[BEEP]', 'DUAL beep activated');
        return;
      } catch (err) {
        console.error('[BEEP] Error starting instant beep:', err);
      }
    }
    
    // Fallback: initialize and retry
    debugLog('[BEEP]', 'Beeper not ready, initializing...');
    this.initializePersistentBeeper().then(() => {
      if (this._persistentBeeper) {
        this.startBeep();
      }
    });
  }

  /**
   * Stop beeping
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
      const totalFadeTime = initialDeclineTime + mainDecayTime;
      
      beeper.gain.gain.cancelScheduledValues(currentTime);
      beeper.gain.gain.setValueAtTime(0.4, currentTime);
      beeper.gain.gain.linearRampToValueAtTime(0.25, currentTime + initialDeclineTime);
      beeper.gain.gain.exponentialRampToValueAtTime(0.001, currentTime + totalFadeTime);
      // Ensure complete silence after fade
      beeper.gain.gain.setValueAtTime(0, currentTime + totalFadeTime);
      
      beeper.localGain.gain.cancelScheduledValues(currentTime);
      beeper.localGain.gain.setValueAtTime(0.3, currentTime);
      beeper.localGain.gain.linearRampToValueAtTime(0.18, currentTime + initialDeclineTime);
      beeper.localGain.gain.exponentialRampToValueAtTime(0.001, currentTime + totalFadeTime);
      // Ensure complete silence after fade
      beeper.localGain.gain.setValueAtTime(0, currentTime + totalFadeTime);
      
      beeper.isPlaying = false;
      this.isBeeping(false);
      
      debugLog('[BEEP]', `Dual fadeout complete with final silence at ${currentTime + totalFadeTime}`);
    } catch (err) {
      console.error('[BEEP] Error stopping beep:', err);
    }
  }

  /**
   * Reset beeper state
   */
  resetBeeper() {
    this.stopBeep();
    this.beeperReady(false);
    // Note: we don't destroy _persistentBeeper, it can be reused
  }
}
