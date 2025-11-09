import { ref } from 'vue';

/**
 * Vue composable for connection error dialog state
 * Replaces Knockout observable adapter in app/index.js
 * 
 * Error types:
 * 0 - Connection refused
 * 1 - Incompatible version
 * 2 - Username rejected
 * 3 - User password incorrect
 * 4 - Server password incorrect
 * 5 - Username already in use
 * 6 - Full server
 * 7 - NoCert (client certificate required)
 * 8 - Connection refused (alternate)
 */
export function useConnectErrorDialog() {
  // Core state
  const type = ref(0); // Error type (0-8)
  const reason = ref(''); // Error reason text
  const visible = ref(false);

  // Form fields - shared with connectDialog for retry
  // These will be populated from connectDialog when error occurs
  const username = ref('');
  const password = ref('');

  // Helper methods
  const show = () => {
    visible.value = true;
  };

  const hide = () => {
    visible.value = false;
  };

  const reset = () => {
    type.value = 0;
    reason.value = '';
    visible.value = false;
    // Note: Don't reset username/password - they're shared with connectDialog
  };

  return {
    // State
    type,
    reason,
    visible,
    username,
    password,

    // Methods
    show,
    hide,
    reset
  };
}
