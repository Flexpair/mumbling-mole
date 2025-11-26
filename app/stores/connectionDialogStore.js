import { defineStore } from 'pinia';
import { ref } from 'vue';

/**
 * Connection Dialog Store
 * 
 * Manages the state of the connection dialog (address, port, credentials, visibility).
 * Replaces the singleton composable useConnectionDialog.js
 * 
 * Properties:
 * - address: Server address
 * - port: Server port
 * - username: User's username
 * - password: Server password
 * - visible: Dialog visibility state
 * - isTestActive: Whether audio test (loopback) mode is active
 */
export const useConnectionDialogStore = defineStore('connectionDialog', () => {
  // Connection parameters
  const address = ref('');
  const port = ref('');
  const username = ref('');
  const password = ref('');
  
  // UI state
  const visible = ref(false);
  const isTestActive = ref(false);
  
  // Actions
  function show() {
    visible.value = true;
  }
  
  function hide() {
    visible.value = false;
  }
  
  function reset() {
    address.value = '';
    port.value = '';
    username.value = '';
    password.value = '';
    visible.value = false;
    isTestActive.value = false;
  }
  
  return {
    // State
    address,
    port,
    username,
    password,
    visible,
    isTestActive,
    
    // Actions
    show,
    hide,
    reset,
  };
});
