import { ref } from 'vue';

/**
 * Connection Dialog State Composable
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
 */
export function useConnectionDialog() {
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
  
  return {
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
}
