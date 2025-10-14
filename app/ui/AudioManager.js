import ko from "knockout";
import { ensureAudioContext } from "../audio/audio-context-manager";
import audioContextManager from "../audio/audio-context-manager";
import {
  ContinuousVoiceHandler,
  PushToTalkVoiceHandler,
} from "../audio/voice";
import { translate } from "../localize";

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

// Debug flag for controlling verbose logging in voice handlers
const DEBUG_VOICE_LOGGING = false; // Set to true for development debugging

/**
 * Debug logging function that respects the DEBUG_VOICE_LOGGING flag
 * @param {string} tag - Log tag like '[VOICE]' 
 * @param {...any} args - Arguments to log
 */
function debugLog(tag, ...args) {
  if (DEBUG_VOICE_LOGGING) {
    console.log(tag, ...args);
  }
}

/**
 * Manages all audio-related functionality including voice handlers, beepers, and microphone permissions
 */
export default class AudioManager {
  constructor(settings, isLoopbackMode, selfMute, selfDeaf) {
    this.settings = settings;
    this.isLoopbackMode = isLoopbackMode;
    this.selfMute = selfMute;
    this.selfDeaf = selfDeaf;
    
    // Microphone permission state
    this.micPermissionDenied = ko.observable(false);
    this.micPermissionErrorMessage = ko.observable("");
    this.micPermissionRetryCount = 0;
    this.maxMicPermissionRetryCount = 3;
    this.micPermissionRetryDelayMs = 1000;
    
    // Audio lock state
    this.audioLockActive = ko.observable(false);
    this.audioLockReason = ko.observable(null);
    this.audioLockDetails = ko.observable(null);
    
    // Beeper state
    this.isBeeping = ko.observable(false);
    this.beeperReady = ko.observable(false);
    this.voiceHandlerReady = ko.observable(false);
    this._persistentBeeper = null;
    
    // AudioContext
    this.audioContext = null;
    
    // Voice handler (will be managed externally but state tracked here)
    this.voiceHandler = null;
  }

  /**
   * Activate audio lock (disables audio with reason)
   */
  activateAudioLock(reason, details = {}) {
    this.audioLockReason(reason);
    this.audioLockDetails(details);
    this.audioLockActive(true);
    this.selfMute(true);
    this.selfDeaf(true);
    if (this.voiceHandler) {
      this.voiceHandler.setMute(true);
    }
  }

  /**
   * Clear audio lock
   */
  clearAudioLock({ resetStates = false } = {}) {
    if (resetStates && this.audioLockActive()) {
      this.selfMute(false);
      this.selfDeaf(false);
    }
    this.audioLockActive(false);
    this.audioLockReason(null);
    this.audioLockDetails(null);
  }

  /**
   * Get audio lock notification info
   */
  getAudioLockInfo() {
    const details = this.audioLockDetails() || {};
    const sr =
      details.sampleRate !== undefined
        ? details.sampleRate
        : this.audioContext && this.audioContext.sampleRate;
    return sr;
  }

  /**
   * Initialize AudioContext
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
      }
    }
  }

  /**
   * Initialize persistent beeper for audio testing
   */
  async initializePersistentBeeper() {
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
        debugLog('[BEEP]', 'AudioContext not ready', ac ? { state: ac.state } : { ac: null });
        this.beeperReady(false);
        return;
      }
      
      // DUAL-OUTPUT: Create permanent oscillator with split output
      const oscillator = ac.createOscillator();
      const beepGain = ac.createGain();
      const localGain = ac.createGain();
      
      oscillator.frequency.setValueAtTime(440, ac.currentTime);
      oscillator.type = 'sine';
      beepGain.gain.setValueAtTime(0, ac.currentTime);
      localGain.gain.setValueAtTime(0, ac.currentTime);
      
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
      debugLog('[BEEP]', 'Persistent beeper initialized');
      
      this.checkFullBeepReadiness();
    } catch (err) {
      console.error('[BEEP] Failed to initialize persistent beeper:', err);
      this.beeperReady(false);
    }
  }

  /**
   * Check if both beeper and voice handler are ready
   */
  checkFullBeepReadiness() {
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
   * Start beep
   */
  startBeep(isConnected) {
    debugLog('[BEEP]', 'Start beep requested');
    
    if (!isConnected) {
      debugLog('[BEEP]', 'Not connected, ignoring beep');
      return;
    }
    
    if (this._persistentBeeper) {
      try {
        const beeper = this._persistentBeeper;
        const ac = beeper.gain.context;
        const currentTime = ac.currentTime;
        
        const attackTime = 0.005; // 5ms attack
        
        beeper.gain.gain.cancelScheduledValues(currentTime);
        beeper.gain.gain.setValueAtTime(0, currentTime);
        beeper.gain.gain.linearRampToValueAtTime(0.4, currentTime + attackTime);
        
        beeper.localGain.gain.cancelScheduledValues(currentTime);
        beeper.localGain.gain.setValueAtTime(0, currentTime);
        beeper.localGain.gain.linearRampToValueAtTime(0.3, currentTime + attackTime);
        
        beeper.isPlaying = true;
        this.isBeeping(true);
        
        debugLog('[BEEP]', 'Beep activated');
        return;
      } catch (err) {
        console.error('[BEEP] Error starting beep:', err);
      }
    }
    
    // Fallback: initialize and retry
    debugLog('[BEEP]', 'Beeper not ready, initializing...');
    this.initializePersistentBeeper().then(() => {
      if (this._persistentBeeper && isConnected) {
        this.startBeep(isConnected);
      }
    });
  }

  /**
   * Stop beep
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
      
      debugLog('[BEEP]', 'Fadeout complete');
    } catch (err) {
      console.error('[BEEP] Error stopping beep:', err);
    }
  }

  /**
   * Attempt to get microphone permission
   */
  attemptMicrophonePermission() {
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
   * Retry microphone permission
   */
  retryMicrophonePermission() {
    this.micPermissionRetryCount = 0;
    this.micPermissionErrorMessage("");
    this.attemptMicrophonePermission();
  }

  /**
   * Create and return a voice handler
   */
  createVoiceHandler(client, mode, target) {
    // CLEANUP: Destroy existing handler before creating new one
    if (this.voiceHandler) {
      this.voiceHandler.end();
      this.voiceHandler = null;
    }
    
    // RESET-READY: Mark voice handler as not ready during recreation
    this.voiceHandlerReady(false);
    debugLog('[VOICE-HANDLER]', 'Creating voice handler...');
    
    // HANDLER-CREATION: Create appropriate handler based on voice activation mode
    if (mode === "cont") {
      this.voiceHandler = new ContinuousVoiceHandler(client, this.settings, target);
    } else if (mode === "ptt") {
      this.voiceHandler = new PushToTalkVoiceHandler(client, this.settings, target);
    } else {
      console.log(translate("logentry.unknown_voice_mode"), mode);
      return null;
    }
    
    // MUTE-STATE: Apply current mute state to new handler
    if (this.audioLockActive() || this.selfMute()) {
      this.voiceHandler.setMute(true);
    }
    
    // VOICE-HANDLER-READY: Mark voice handler as initialized
    this.voiceHandlerReady(true);
    debugLog('[VOICE-HANDLER]', 'Voice handler created and ready');
    
    this.checkFullBeepReadiness();
    
    return this.voiceHandler;
  }

  /**
   * Clean up audio resources
   */
  cleanup() {
    this.stopBeep();
    this.beeperReady(false);
    this.voiceHandlerReady(false);
    if (this.voiceHandler) {
      this.voiceHandler.end();
      this.voiceHandler = null;
    }
  }
}
