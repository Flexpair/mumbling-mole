import { safeStoreToRefs } from '../utils/safeStoreToRefs';
import { useUIStore } from '../stores/uiStore';

/**
 * useUIState - Adapter for Pinia UIStore
 * 
 * Maintains backward compatibility with existing code that expects
 * the composable API.
 */
export function useUIState() {
  const store = useUIStore();
  
  const { 
    currentOpenModal,
    messageBox,
    messageConfirmed,
    settingsDialog
  } = safeStoreToRefs(store);
  
  return {
    // State (reactive)
    currentOpenModal,
    messageBox,
    messageConfirmed,
    settingsDialog,
    
    // Methods
    openSettings: store.openSettings,
    closeSettings: store.closeSettings,
    submitMessageBox: store.submitMessageBox,
    reset: store.reset,
  };
}

