import ko from "knockout";
import {
  ContinuousVoiceHandler,
  PushToTalkVoiceHandler,
  initVoice,
  onAudioMixerReady,
} from "../audio/voice";
import { translate } from "../localize";

const DEBUG_VOICE_LOGGING = false;

function debugLog(tag, ...args) {
  if (DEBUG_VOICE_LOGGING) {
    console.log(tag, ...args);
  }
}

/**
 * VoiceState - manages voice handler and loopback testing
 * 
 * Responsibilities:
 * - Voice handler lifecycle (PTT/continuous)
 * - Loopback test mode management
 * - Voice handler ready state tracking
 * - Voice data routing (normal vs loopback target)
 */
export default class VoiceState {
  constructor() {
    // Voice handler instance (created dynamically based on mode)
    this.voiceHandler = null;
    
    // Loopback mode - routes voice to server echo (target=31)
    this.isLoopbackMode = ko.observable(false);
    
    // Voice handler ready state
    this.voiceHandlerReady = ko.observable(false);
    
    // Loopback frequency analysis - tracks dominant frequency in returned audio
    this.loopbackDominantFrequency = ko.observable(0);
  }

  /**
   * Initialize voice input capture
   * @param {Function} onData - Callback for voice data
   * @param {Function} onError - Callback for errors
   * @param {Function} onMixerReady - Optional callback when audio mixer becomes ready
   */
  initVoiceInput(onData, onError, onMixerReady) {
    initVoice(onData, onError);
    
    // Register for mixer ready notification if callback provided
    if (onMixerReady) {
      onAudioMixerReady(onMixerReady);
    }
  }

  /**
   * Update/recreate voice handler based on settings
   * @param {object} client - Mumble client instance
   * @param {object} settings - Settings object with voiceMode, etc.
   * @param {Function} onStartedTalking - Callback when user starts talking
   * @param {Function} onStoppedTalking - Callback when user stops talking
   */
  updateVoiceHandler(client, settings, onStartedTalking, onStoppedTalking) {
    if (!client) {
      return;
    }
    
    // Cleanup existing handler
    if (this.voiceHandler) {
      this.voiceHandler.end();
      this.voiceHandler = null;
    }
    
    // Reset ready state during recreation
    this.voiceHandlerReady(false);
    debugLog('[VOICE-HANDLER]', 'Recreating voice handler...');
    
    let mode = settings.voiceMode;
    
    // Determine voice routing target
    // target=31 routes to server loopback for echo testing
    // target=0 routes normally to channel/user
    let target = this.isLoopbackMode() ? 31 : 0;
    
    // Create appropriate handler based on voice activation mode
    if (mode === "cont") {
      this.voiceHandler = new ContinuousVoiceHandler(client, settings, target);
    } else if (mode === "ptt") {
      this.voiceHandler = new PushToTalkVoiceHandler(client, settings, target);
    } else {
      console.error(translate("logentry.unknown_voice_mode"), mode);
      return;
    }
    
    // Connect voice handler events
    if (onStartedTalking) {
      this.voiceHandler.on("started_talking", onStartedTalking);
    }
    if (onStoppedTalking) {
      this.voiceHandler.on("stopped_talking", onStoppedTalking);
    }
    
    // Mark as ready
    this.voiceHandlerReady(true);
    debugLog('[VOICE-HANDLER]', 'Voice handler fully initialized and ready');
  }

  /**
   * Update loopback frequency display
   * @param {number} frequency - Detected dominant frequency in Hz
   */
  updateLoopbackFrequency(frequency) {
    if (this.isLoopbackMode()) {
      this.loopbackDominantFrequency(Math.round(frequency * 10) / 10);
    }
  }

  /**
   * Set mute state on voice handler
   * @param {boolean} muted - Mute state
   */
  setMute(muted) {
    if (this.voiceHandler) {
      this.voiceHandler.setMute(muted);
    }
  }

  /**
   * Write voice data to handler
   * @param {ArrayBuffer} data - Voice data to send
   */
  writeVoiceData(data) {
    if (this.voiceHandler) {
      this.voiceHandler.write(data);
    }
  }

  /**
   * End voice handler
   */
  endVoiceHandler() {
    if (this.voiceHandler) {
      this.voiceHandler.end();
      this.voiceHandler = null;
    }
    this.voiceHandlerReady(false);
  }

  /**
   * Reset voice state
   */
  reset() {
    this.endVoiceHandler();
    this.isLoopbackMode(false);
    this.voiceHandlerReady(false);
  }
}
