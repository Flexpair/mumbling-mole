import { defineStore } from 'pinia';
import { ref } from 'vue';

/**
 * Connect Error Dialog Store
 * 
 * Manages state for the connection error dialog.
 * Replaces the singleton composable useConnectErrorDialog.js
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
export const useConnectErrorDialogStore = defineStore('connectErrorDialog', () => {
  // Core state
  const type = ref(0); // Error type (0-8)
  const reason = ref(''); // Error reason text
  const visible = ref(false);

  // Actions
  /**
   * Show the error dialog
   * @param {Error} [error] - Optional error object with type/message
   * @param {Object} [connectionParams] - Optional connection parameters (for retry)
   */
  function show(error, connectionParams) {
    if (error) {
      type.value = error.type ?? 0;
      reason.value = error.reason ?? error.message ?? '';
    }
    visible.value = true;
  }

  function hide() {
    visible.value = false;
  }

  function reset() {
    type.value = 0;
    reason.value = '';
    visible.value = false;
  }

  return {
    // State
    type,
    reason,
    visible,

    // Actions
    show,
    hide,
    reset
  };
});
