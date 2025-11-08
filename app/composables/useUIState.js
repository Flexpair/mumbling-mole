import { ref } from 'vue';

/**
 * useUIState - Vue composable for UI-specific state and modal management
 * 
 * Responsibilities:
 * - Message box state
 * - Modal management (prevent multiple modals)
 * - Settings dialog state
 * 
 * Migration from Knockout:
 * - ko.observable() → ref()
 * 
 * NOTE: Selection state removed - no UI for selecting channels/users.
 * All messages go to current channel (thisUser().channel()).
 */
export function useUIState() {
  // Modal management - track currently open modal
  const currentOpenModal = ref(null);
  
  // Message box
  const messageBox = ref('');
  
  // Settings dialog
  const settingsDialog = ref(null);

  /**
   * Open settings dialog
   * @param {object} settings - Settings instance
   * @param {Function} SettingsDialogClass - Settings dialog constructor
   */
  function openSettings(settings, SettingsDialogClass) {
    // Prevent opening if another modal is already open
    if (currentOpenModal.value !== null) {
      return;
    }
    settingsDialog.value = new SettingsDialogClass(settings);
    currentOpenModal.value = 'settings';
  }

  /**
   * Close settings dialog
   */
  function closeSettings() {
    if (settingsDialog.value) {
      settingsDialog.value.end();
    }
    settingsDialog.value = null;
    
    // Clear the modal state
    if (currentOpenModal.value === 'settings') {
      currentOpenModal.value = null;
    }
  }

  /**
   * Submit message box content
   * @param {Function} sendMessageFn - Function to send the message
   * @param {object} target - Target channel/user for the message
   */
  function submitMessageBox(sendMessageFn, target) {
    sendMessageFn(target, messageBox.value);
    messageBox.value = '';
  }

  /**
   * Reset UI state
   */
  function reset() {
    messageBox.value = '';
    settingsDialog.value = null;
    currentOpenModal.value = null;
  }

  // Return composable API
  return {
    // State (reactive)
    currentOpenModal,
    messageBox,
    settingsDialog,
    
    // Methods
    openSettings,
    closeSettings,
    submitMessageBox,
    reset,
  };
}
