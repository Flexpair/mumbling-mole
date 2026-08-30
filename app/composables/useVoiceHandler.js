import {
  ContinuousVoiceHandler,
  PushToTalkVoiceHandler,
  initVoice,
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
  let settled = false;
  let resolveReady;
  let rejectReady;
  const ready = new Promise((resolve, reject) => {
    resolveReady = resolve;
    rejectReady = reject;
  });
  const stopVoice = initVoice(
    onData,
    (error) => {
      if (!settled) {
        settled = true;
        rejectReady(error);
      }
      onError(error);
    },
    (mixer) => {
      if (settled) return;
      try {
        onMixerReady?.(mixer);
        settled = true;
        resolveReady();
      } catch (error) {
        settled = true;
        rejectReady(error);
        onError(error);
      }
    }
  );
  
  return {
    ready,
    stop() {
      if (!settled) {
        const error = new Error('Voice capture cancelled');
        error.code = 'VOICE_CAPTURE_CANCELLED';
        settled = true;
        rejectReady(error);
      }
      stopVoice?.();
    },
  };
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
