/**
 * Shared debug utilities for Vue composables
 */

const DEBUG_VOICE_LOGGING = false;

/**
 * Conditional debug logger for voice/audio debugging
 * Only logs when DEBUG_VOICE_LOGGING is true
 * @param {string} tag - Log tag (e.g., '[VOICE]', '[BEEP]')
 * @param {...any} args - Arguments to log
 */
export function debugLog(tag, ...args) {
  if (DEBUG_VOICE_LOGGING) {
    console.log(tag, ...args);
  }
}
