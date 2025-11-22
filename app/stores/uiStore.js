import { defineStore } from 'pinia';
import { ref } from 'vue';

export const useUIStore = defineStore('ui', () => {
  // Modal management - track currently open modal
  const currentOpenModal = ref(null);
  
  // Message box
  const messageBox = ref('');
  
  // Message confirmation (for visual feedback when message is sent)
  const messageConfirmed = ref(false);
  
  // Settings dialog
  const settingsDialog = ref(null);

  /**
   * Open settings dialog (simplified for Vue composables)
   * Just sets settingsDialog.value to a truthy marker to trigger visibility
   */
  function openSettings() {
    // Prevent opening if another modal is already open
    if (currentOpenModal.value !== null) {
      return;
    }
    // Set to true to indicate settings dialog should be visible
    settingsDialog.value = true;
    currentOpenModal.value = 'settings';
  }

  /**
   * Close settings dialog
   */
  function closeSettings() {
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
    const messageText = messageBox.value;
    if (messageText.trim()) {
      // Send message - confirmation will come from 'messageSent' event
      sendMessageFn(target, messageText);
      messageBox.value = '';
    }
  }

  /**
   * Reset UI state
   */
  function reset() {
    messageBox.value = '';
    messageConfirmed.value = false;
    settingsDialog.value = null;
    currentOpenModal.value = null;
  }

  return {
    // State
    currentOpenModal,
    messageBox,
    messageConfirmed,
    settingsDialog,
    
    // Methods
    openSettings,
    closeSettings,
    submitMessageBox,
    reset
  };
});
