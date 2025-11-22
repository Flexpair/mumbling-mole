import { safeStoreToRefs } from '../utils/safeStoreToRefs';
import { useUserStore } from '../stores/userStore';

/**
 * useUserState - Adapter for Pinia UserStore
 * 
 * Maintains backward compatibility with existing code that expects
 * the composable API.
 */
export function useUserState(audioState, voiceState) {
  const store = useUserStore();
  
  const { 
    thisUser,
    selfMute,
    selfDeaf
  } = safeStoreToRefs(store);
  
  return {
    // State (reactive)
    thisUser,
    selfMute,
    selfDeaf,
    
    // Methods
    registerUser: store.registerUser,
    requestMute: store.requestMute,
    requestDeaf: store.requestDeaf,
    requestUnmute: store.requestUnmute,
    requestUndeaf: store.requestUndeaf,
    reset: store.reset,
    setSettings: store.setSettings,
  };
}

