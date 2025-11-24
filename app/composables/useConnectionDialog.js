import { ref } from 'vue';

/**
 * Connection Dialog State Composable (SINGLETON)
 * 
 * Manages the state of the connection dialog (address, port, credentials, visibility).
 * Replaces the Knockout adapter object pattern from index.js.
 * 
 * Properties:
 * - address: Server address
 * - port: Server port
 * - username: User's username
 * - password: Server password
 * - visible: Dialog visibility state
 * - isTestActive: Whether audio test (loopback) mode is active
 * 
 * IMPORTANT: This is a SINGLETON pattern - all calls return the same instance.
 * This ensures AppState and ConnectDialog.vue share the same state.
 */

// Singleton instance (created once, reused everywhere)
let instance = null;

export function useConnectionDialog() {
  if (instance) return instance;
  
  // Connection parameters
  const address = ref('');
  const port = ref('');
  const username = ref('');
  const password = ref('');
  
  // UI state
  const visible = ref(false);
  const isTestActive = ref(false);
  
  // Helper methods
  const show = () => {
    visible.value = true;
  };
  
  const hide = () => {
    visible.value = false;
  };
  
  const reset = () => {
    address.value = '';
    port.value = '';
    username.value = '';
    password.value = '';
    visible.value = false;
    isTestActive.value = false;
  };
  
  instance = {
    // State
    address,
    port,
    username,
    password,
    visible,
    isTestActive,
    
    // Methods
    show,
    hide,
    reset,
  };
  
  return instance;
}
