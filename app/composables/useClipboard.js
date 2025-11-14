/**
 * useClipboard - Vue Composable for Clipboard Operations
 * 
 * Provides reactive clipboard copy functionality with success/error states.
 * 
 * @example
 * const { copy, copied, error } = useClipboard();
 * 
 * <button @click="copy('Hello World')">
 *   {{ copied ? 'Copied!' : 'Copy' }}
 * </button>
 */

import { ref } from 'vue';

export function useClipboard({ timeout = 2000 } = {}) {
  const copied = ref(false);
  const error = ref(null);
  const text = ref('');

  const copy = async (value) => {
    if (!value) {
      error.value = 'No value provided';
      return false;
    }

    try {
      await navigator.clipboard.writeText(value);
      text.value = value;
      copied.value = true;
      error.value = null;

      // Reset copied state after timeout
      setTimeout(() => {
        copied.value = false;
      }, timeout);

      return true;
    } catch (err) {
      error.value = err.message || 'Failed to copy';
      copied.value = false;
      console.error('[useClipboard] Copy failed:', err);
      return false;
    }
  };

  const reset = () => {
    copied.value = false;
    error.value = null;
    text.value = '';
  };

  return {
    copy,
    copied,
    error,
    text,
    reset,
  };
}
