import { defineStore } from 'pinia';
import { ref } from 'vue';

export const useUIStore = defineStore('ui', () => {
  // Modal management - track currently open modal
  const currentOpenModal = ref(null);
  
  // Message box
  const messageBox = ref('');
  
  // Message confirmation (for visual feedback when message is sent)
  const messageConfirmed = ref(false);
  
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
    currentOpenModal.value = null;
  }

  return {
    // State
    currentOpenModal,
    messageBox,
    messageConfirmed,
    
    // Methods
    submitMessageBox,
    reset
  };
});
