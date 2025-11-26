/**
 * Shared debug utilities for Vue composables
 */

/**
 * Conditional debug logger for voice/audio debugging
 * Controlled by ?debug-audio URL parameter (sets globalThis.MUMBLE_DEBUG_AUDIO)
 * @param {string} tag - Log tag (e.g., '[VOICE]', '[BEEP]')
 * @param {...any} args - Arguments to log
 */
export function debugLog(tag, ...args) {
  if (globalThis.MUMBLE_DEBUG_AUDIO) {
    console.log(tag, ...args);
  }
}
