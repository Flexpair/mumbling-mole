import ko from "knockout";

/**
 * BeeperManager - Manages the beeper/test tone functionality
 * Handles initialization, playback, and state management of the test tone
 */
class BeeperManager {
  constructor(debugLog) {
    this.isBeeping = ko.observable(false);
    this.beeperReady = ko.observable(false);
    this.voiceHandlerReady = ko.observable(false);
    this._persistentBeeper = null;
    this._debugLog = debugLog;
  }

  /**
   * Wait for audio mixer to become available
   * @param {number} timeoutMs - Maximum time to wait
   * @param {number} checkIntervalMs - How often to check
   * @returns {Promise<boolean>}
   */
  async _waitForAudioMixer(timeoutMs = 5000, checkIntervalMs = 50) {
    const maxRetries = Math.floor(timeoutMs / checkIntervalMs);
    let retries = maxRetries;
    
    while (retries > 0 && !window._audioMixer) {
      await new Promise(resolve => setTimeout(resolve, checkIntervalMs));
      retries--;
    }
    
    return !!window._audioMixer;
  }

  /**
   * Initialize the persistent beeper
   * @returns {Promise<void>}
   */
  async initialize() {
    if (this._persistentBeeper) return; // Already initialized
    
    try {
      this._debugLog('[BEEP]', 'Waiting for audio mixer...');
      const mixerAvailable = await this._waitForAudioMixer(5000, 50);
      
      if (!mixerAvailable) {
        this._debugLog('[BEEP]', 'Mixer not ready after timeout');
        this.beeperReady(false);
        return;
      }
      
      const mixer = window._audioMixer;
      const ac = await window.audioContextManager.getAudioContext();
      if (!ac || ac.state !== 'running') {
        this._debugLog(
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
      beepGain.gain.setValueAtTime(0, ac.currentTime);
      localGain.gain.setValueAtTime(0, ac.currentTime);
      
      // LATENCY-TEST: Split signal to hear both immediate local and delayed server echo
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
      this._debugLog('[BEEP]', 'Persistent beeper initialized with dual output (local + server echo) for latency testing');
      
      this.checkFullReadiness();
    } catch (err) {
      console.error('[BEEP] Failed to initialize persistent beeper:', err);
      this.beeperReady(false);
    }
  }

  /**
   * Check if both beeper and voice handler are ready
   */
  checkFullReadiness() {
    const beeperOk = this.beeperReady();
    const voiceOk = this.voiceHandlerReady();
    
    this._debugLog('[BEEP-READY]', `Beeper: ${beeperOk}, Voice: ${voiceOk}`);
    
    if (beeperOk && voiceOk) {
      this._debugLog('[BEEP-READY]', '✅ Full beep system ready!');
    } else {
      this._debugLog('[BEEP-READY]', '⏳ Waiting for full initialization...');
    }
  }

  /**
   * Start beep if connected
   * @param {boolean} isConnected - Whether client is connected
   */
  start(isConnected) {
    this._debugLog('[BEEP]', 'Start beep requested');
    
    if (!isConnected) {
      this._debugLog('[BEEP]', 'Not connected, ignoring beep');
      return;
    }
    
    if (this._persistentBeeper) {
      try {
        const beeper = this._persistentBeeper;
        const ac = beeper.gain.context;
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
        
        this._debugLog('[BEEP]', 'DUAL beep activated: local (immediate) + server echo (delayed) - listen for latency!');
        return;
      } catch (err) {
        console.error('[BEEP] Error starting instant beep:', err);
      }
    }
    
    // Fallback: initialize and retry
    this._debugLog('[BEEP]', 'Beeper not ready, initializing...');
    this.initialize().then(() => {
      if (this._persistentBeeper && isConnected) {
        this.start(isConnected);
      }
    });
  }

  /**
   * Stop beep with fadeout
   */
  stop() {
    this._debugLog('[BEEP]', 'Stop beep requested');
    
    if (!this._persistentBeeper || !this._persistentBeeper.isPlaying) {
      this._debugLog('[BEEP]', 'Beeper not playing, ignoring stop');
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
      
      this._debugLog('[BEEP]', `Dual fadeout: ${initialDeclineTime}s gentle + ${mainDecayTime}s decay (local + echo)`);
    } catch (err) {
      console.error('[BEEP] Error stopping beep:', err);
    }
  }
}

export default BeeperManager;
