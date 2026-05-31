import {
  ContinuousVoiceHandler,
  PushToTalkVoiceHandler,
  initVoice,
  onAudioMixerReady,
} from '../audio/voice';
import { translate } from '../localize';
import { debugLog } from '../utils/debug-utils';

/**
 * Initialize voice input capture via Web Audio API (getUserMedia wrapping)
 * @param {Function} onData - Callback for voice data
 * @param {Function} onError - Callback for errors
 * @param {Function} onMixerReady - Optional callback when audio mixer becomes ready
 */
export function initVoiceInput(onData, onError, onMixerReady) {
  initVoice(onData, onError);
  
  // Register for mixer ready notification if callback provided
  if (onMixerReady) {
    onAudioMixerReady(onMixerReady);
  }
}

/**
 * Creates and connects the appropriate VoiceHandler (Continuous vs Push-to-Talk)
 */
export function createVoiceHandlerInstance(mode, client, settingsStore, isLoopbackMode) {
  // Determine voice routing target
  // target=31 routes to server loopback for echo testing
  // target=0 routes normally to channel/user
  let target = isLoopbackMode ? 31 : 0;
  
  let newHandler = null;
  if (mode === 'cont') {
    newHandler = new ContinuousVoiceHandler(client, settingsStore, target);
  } else if (mode === 'ptt') {
    newHandler = new PushToTalkVoiceHandler(client, settingsStore, target);
  } else {
    debugLog('[VOICE]', translate('logentry.unknown_voice_mode'), mode);
  }

  return newHandler;
}
