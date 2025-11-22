import { safeStoreToRefs } from '../utils/safeStoreToRefs';
import { useVoiceStore } from '../stores/voiceStore';

/**
 * useVoiceState - Adapter for Pinia VoiceStore
 * 
 * Maintains backward compatibility with existing code that expects
 * the composable API.
 */
export function useVoiceState() {
  const store = useVoiceStore();
  
  const { 
    voiceHandler, // This is a ref
    isLoopbackMode,
    voiceHandlerReady,
    loopbackDominantFrequency
  } = safeStoreToRefs(store);
  
  return {
    // State (reactive)
    isLoopbackMode,
    voiceHandlerReady,
    loopbackDominantFrequency,
    
    // Methods
    initVoiceInput: store.initVoiceInput,
    updateVoiceHandler: store.updateVoiceHandler,
    updateLoopbackFrequency: store.updateLoopbackFrequency,
    setMute: store.setMute,
    writeVoiceData: store.writeVoiceData,
    getVoiceHandler: store.getVoiceHandler,
    endVoiceHandler: store.endVoiceHandler,
    reset: store.reset,
    
    // Expose voiceHandler for backward compatibility
    get voiceHandler() {
      return voiceHandler.value;
    }
  };
}

