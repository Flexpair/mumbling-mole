/**
 * useKeyboardShortcut - Vue Composable for Keyboard Shortcut Handling
 * 
 * Provides declarative keyboard shortcut registration with automatic cleanup.
 * Uses keyboardjs for cross-browser key combination support.
 * 
 * @example
 * import { useKeyboardShortcut } from '@/composables';
 * 
 * // Single shortcut
 * useKeyboardShortcut('ctrl+m', () => toggleMute());
 * 
 * // Multiple shortcuts
 * useKeyboardShortcut({
 *   'ctrl+m': toggleMute,
 *   'ctrl+d': toggleDeaf,
 *   'ctrl+s': openSettings
 * });
 */

import { onMounted, onBeforeUnmount } from 'vue';
import keyboardjs from 'keyboardjs';

/**
 * Register keyboard shortcuts with automatic cleanup
 * 
 * @param {string | Object} shortcuts - Key combination(s) or object mapping keys to handlers
 * @param {Function} [handler] - Handler function (if shortcuts is a string)
 * @param {Object} [options] - Configuration options
 * @param {boolean} [options.preventDefault=true] - Prevent default browser behavior
 * @param {boolean} [options.stopPropagation=false] - Stop event propagation
 */
export function useKeyboardShortcut(shortcuts, handler = null, options = {}) {
  const {
    preventDefault = true,
    stopPropagation = false
  } = options;

  const registeredKeys = [];

  function registerShortcut(key, fn) {
    const wrappedHandler = (event) => {
      if (preventDefault && event) event.preventDefault();
      if (stopPropagation && event) event.stopPropagation();
      fn(event);
    };

    keyboardjs.bind(key, wrappedHandler);
    registeredKeys.push(key);
  }

  onMounted(() => {
    if (typeof shortcuts === 'string' && handler) {
      // Single shortcut
      registerShortcut(shortcuts, handler);
    } else if (typeof shortcuts === 'object') {
      // Multiple shortcuts
      Object.entries(shortcuts).forEach(([key, fn]) => {
        registerShortcut(key, fn);
      });
    } else {
      console.warn('[useKeyboardShortcut] Invalid shortcuts configuration', shortcuts);
    }
  });

  onBeforeUnmount(() => {
    // Cleanup all registered shortcuts
    registeredKeys.forEach(key => {
      keyboardjs.unbind(key);
    });
  });

  return {
    registeredKeys
  };
}
