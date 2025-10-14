import ko from "knockout";
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

/**
 * Debug logging function that respects the DEBUG_VOICE_LOGGING flag
 * @param {string} tag - Log tag like '[VOICE]' 
 * @param {...any} args - Arguments to log
 */
function debugLog(tag, ...args) {
  const DEBUG_VOICE_LOGGING = false; // Set to true for development debugging
  if (DEBUG_VOICE_LOGGING) {
    console.log(tag, ...args);
  }
}

/**
 * AudioManager - Manages all audio-related functionality
 * Handles AudioContext, beeper, microphone permissions, and audio locks
 */
export class AudioManager {
  constructor() {
    // AudioContext management
    this.audioContext = null;
    
    // Microphone permission state
    this.micPermissionDenied = ko.observable(false);
    this.micPermissionErrorMessage = ko.observable("");
    this.micPermissionRetryCount = 0;
    this.maxMicPermissionRetryCount = 3;
    this.micPermissionRetryDelayMs = 1000;
    
    // Audio lock state (prevents audio when sample rate is wrong)
    this.audioLockActive = ko.observable(false);
    this.audioLockReason = ko.observable(null);
    this.audioLockDetails = ko.observable(null);
    
    // Beeper state
    this.isBeeping = ko.observable(false);
    this.beeperReady = ko.observable(false);
    this.voiceHandlerReady = ko.observable(false);
    this._persistentBeeper = null;
    
    // Loopback test mode
    this.isLoopbackMode = ko.observable(false);
    
    // Initialize AudioContext
    this.initializeAudioContext();
  }
  
  /**
   * AUDIO-CONTEXT: Initialize managed AudioContext with autoplay policy handling
   * This method ensures singleton pattern and handles browser autoplay restrictions
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
   * Activate audio lock (prevents audio when sample rate is wrong)
   */
  activateAudioLock(reason, details = {}) {
    this.audioLockReason(reason);
    this.audioLockDetails(details);
    this.audioLockActive(true);
  }
  
  /**
   * Clear audio lock
   */
  clearAudioLock({ resetStates = false } = {}) {
    this.audioLockActive(false);
    this.audioLockReason(null);
    this.audioLockDetails(null);
  }
  
  /**
   * Get audio lock details for notification
   */
  getAudioLockInfo() {
    const details = this.audioLockDetails() || {};
    const sampleRate = details.sampleRate !== undefined
      ? details.sampleRate
      : this.audioContext && this.audioContext.sampleRate;
    return { reason: this.audioLockReason(), sampleRate };
  }
  
  /**
   * PERSISTENT-BEEPER: Initialize permanent beep oscillator once, control via gain
   */
  async initializePersistentBeeper() {
    if (this._persistentBeeper) return; // Already initialized
    
    try {
      // MIXER-WAIT: Wait for audio mixer to become available (handles delayed getUserMedia)
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
      const localGain = ac.createGain(); // Separate gain for local playback
      
      oscillator.frequency.setValueAtTime(440, ac.currentTime);
      oscillator.type = 'sine';
      beepGain.gain.setValueAtTime(0, ac.currentTime); // Start silent (remote path)
      localGain.gain.setValueAtTime(0, ac.currentTime); // Start silent (local path)
      
      // LATENCY-TEST: Split signal to hear both immediate local and delayed server echo
      // Path 1: Oscillator -> beepGain -> Mixer -> Server -> Back (with latency)
      // Path 2: Oscillator -> localGain -> Destination (immediate local playback)
      oscillator.connect(beepGain);
      beepGain.connect(mixer);
      
      oscillator.connect(localGain);
      localGain.connect(ac.destination);
      
      // Start oscillator permanently (it just runs silently at gain=0)
      oscillator.start();
      
      // Store references
      this._persistentBeeper = {
        oscillator,
        gain: beepGain,        // Remote (server echo) gain
        localGain: localGain,  // Local (immediate) gain
        isPlaying: false
      };
      
      // BEEPER-READY: Mark beeper as ready for UI
      this.beeperReady(true);
      
      debugLog('[BEEP]', 'Persistent beeper initialized with dual output (local + server echo) for latency testing');
      
      // VOICE-HANDLER-CHECK: Verify voice handler is also ready before showing button
      this.checkFullBeepReadiness();
    } catch (err) {
      console.error('[BEEP] Failed to initialize persistent beeper:', err);
      this.beeperReady(false);
    }
  }
  
  /**
   * FULL-READINESS-CHECK: Verify both beeper AND voice handler are ready
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
   * Start beep tone (for latency testing)
   */
  startBeep(isConnected) {
    debugLog('[BEEP]', 'Start beep requested');
    
    if (!isConnected) {
      debugLog('[BEEP]', 'Not connected, ignoring beep');
      return;
    }
    
    // INSTANT-RESPONSE: If beeper is ready, start immediately (no await, no delay)
    if (this._persistentBeeper) {
      try {
        const beeper = this._persistentBeeper;
        const ac = beeper.gain.context;
        const currentTime = ac.currentTime;
        
        // INSTANT-ATTACK: Very fast but smooth attack to prevent audio pops
        const attackTime = 0.005; // 5ms attack to eliminate clicks
        
        // LATENCY-TEST: Activate both local and remote paths simultaneously
        beeper.gain.gain.cancelScheduledValues(currentTime);
        beeper.gain.gain.setValueAtTime(0, currentTime);
        beeper.gain.gain.linearRampToValueAtTime(0.4, currentTime + attackTime);
        
        beeper.localGain.gain.cancelScheduledValues(currentTime);
        beeper.localGain.gain.setValueAtTime(0, currentTime);
        beeper.localGain.gain.linearRampToValueAtTime(0.3, currentTime + attackTime);
        
        beeper.isPlaying = true;
        this.isBeeping(true);
        
        debugLog('[BEEP]', 'DUAL beep activated: local (immediate) + server echo (delayed) - listen for latency!');
        return;
      } catch (err) {
        console.error('[BEEP] Error starting instant beep:', err);
      }
    }
    
    // FALLBACK-ASYNC: Only if beeper wasn't ready - initialize and retry
    debugLog('[BEEP]', 'Beeper not ready, initializing...');
    this.initializePersistentBeeper().then(() => {
      if (this._persistentBeeper && isConnected) {
        this.startBeep(isConnected);
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
      
      // PIANO-ENVELOPE: More realistic decay curve like acoustic piano
      const initialDeclineTime = 0.3;
      const mainDecayTime = 1.0;
      
      // DUAL-FADEOUT: Fade out both local and remote paths
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
      
      debugLog('[BEEP]', `Dual fadeout: ${initialDeclineTime}s gentle + ${mainDecayTime}s decay (local + echo)`);
    } catch (err) {
      console.error('[BEEP] Error stopping beep:', err);
    }
  }
  
  /**
   * Attempt to get microphone permission
   */
  attemptMicrophonePermission(onSuccess) {
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
        
        // Call success callback if provided
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
        setTimeout(() => this.attemptMicrophonePermission(onSuccess), this.micPermissionRetryDelayMs);
      });
  }
  
  /**
   * Retry microphone permission
   */
  retryMicrophonePermission(onSuccess) {
    this.micPermissionRetryCount = 0;
    this.micPermissionErrorMessage("");
    this.attemptMicrophonePermission(onSuccess);
  }
  
  /**
   * Reset beeper state on disconnect
   */
  resetBeeper() {
    this.beeperReady(false);
    this.voiceHandlerReady(false);
  }
  
  /**
   * Reset loopback mode
   */
  resetLoopbackMode() {
    this.isLoopbackMode(false);
  }
}
