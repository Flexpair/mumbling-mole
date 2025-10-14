import { ContinuousVoiceHandler, PushToTalkVoiceHandler } from "../audio/voice";
import ko from "knockout";

/**
 * VoiceManager - Manages voice handler lifecycle and state
 * Handles creation, updates, and cleanup of voice handlers
 */
class VoiceManager {
  constructor(debugLog, translate, log) {
    this.voiceHandler = null;
    this.voiceHandlerReady = ko.observable(false);
    this._debugLog = debugLog;
    this._translate = translate;
    this._log = log;
  }

  /**
   * Update voice handler based on settings and mode
   * @param {Object} client - Mumble client
   * @param {Object} settings - Voice settings (voiceMode, audioBitrate, samplesPerPacket)
   * @param {boolean} isLoopbackMode - Whether in loopback test mode
   * @param {boolean} audioLockActive - Whether audio is locked
   * @param {boolean} selfMute - Whether self-muted
   * @param {Function} onStartedTalking - Callback when user starts talking
   * @param {Function} onStoppedTalking - Callback when user stops talking
   */
  updateVoiceHandler(
    client,
    settings,
    isLoopbackMode,
    audioLockActive,
    selfMute,
    onStartedTalking,
    onStoppedTalking
  ) {
    if (!client) {
      return;
    }

    // CLEANUP: Destroy existing handler before creating new one
    if (this.voiceHandler) {
      this.voiceHandler.end();
      this.voiceHandler = null;
    }

    // RESET-READY: Mark voice handler as not ready during recreation
    this.voiceHandlerReady(false);
    this._debugLog('[VOICE-HANDLER]', 'Recreating voice handler...');

    let mode = settings.voiceMode;

    // TARGET-ROUTING: Determine voice routing target based on mode
    // target=31 routes to server loopback for echo testing (loopback mode)
    // target=0 routes normally to channel/user (normal mode)
    let target = isLoopbackMode ? 31 : 0;

    // HANDLER-CREATION: Create appropriate handler based on voice activation mode
    if (mode === "cont") {
      // Continuous transmission - always sending audio
      this.voiceHandler = new ContinuousVoiceHandler(client, settings, target);
    } else if (mode === "ptt") {
      // Push-to-talk - only sending when key is pressed
      this.voiceHandler = new PushToTalkVoiceHandler(client, settings, target);
    } else {
      this._log(this._translate("logentry.unknown_voice_mode"), mode);
      return;
    }

    // UI-BINDING: Connect voice handler events to UI talking indicators
    this.voiceHandler.on("started_talking", onStartedTalking);
    this.voiceHandler.on("stopped_talking", onStoppedTalking);

    // MUTE-STATE: Apply current mute state to new handler
    if (audioLockActive || selfMute) {
      this.voiceHandler.setMute(true);
    }

    client.setAudioQuality(settings.audioBitrate, settings.samplesPerPacket);

    // VOICE-HANDLER-READY: Mark voice handler as initialized
    // This signals that the voice path to server is established
    this.voiceHandlerReady(true);
    this._debugLog('[VOICE-HANDLER]', 'Voice handler fully initialized and ready');
  }

  /**
   * Set mute state on voice handler
   * @param {boolean} mute - Whether to mute
   */
  setMute(mute) {
    if (this.voiceHandler) {
      this.voiceHandler.setMute(mute);
    }
  }

  /**
   * End voice handler
   */
  end() {
    if (this.voiceHandler) {
      this.voiceHandler.end();
      this.voiceHandler = null;
    }
    this.voiceHandlerReady(false);
  }

  /**
   * Get current voice handler
   * @returns {Object|null}
   */
  getHandler() {
    return this.voiceHandler;
  }
}

export default VoiceManager;
