import { safeStoreToRefs } from '../utils/safeStoreToRefs';
import { useAudioStore } from '../stores/audioStore';

/**
 * useAudioState - Adapter for Pinia AudioStore
 * 
 * Maintains backward compatibility with existing code that expects
 * the composable API.
 */
export function useAudioState() {
  const store = useAudioStore();
  
  const { 
    audioContext, // This is a ref
    audioLockActive,
    audioLockReason,
    audioLockDetails,
    micPermissionDenied,
    micPermissionErrorMessage,
    isBeeping,
    beeperReady
  } = safeStoreToRefs(store);
  
  return {
    // State (reactive)
    audioLockActive,
    audioLockReason,
    audioLockDetails,
    micPermissionDenied,
    micPermissionErrorMessage,
    isBeeping,
    beeperReady,
    
    // Getters (for internal state access)
    getAudioContext: store.getAudioContext,
    
    // Methods
    initializeAudioContext: store.initializeAudioContext,
    resumeAudioContext: store.resumeAudioContext,
    loadAudioWorkletModule: store.loadAudioWorkletModule,
    activateAudioLock: store.activateAudioLock,
    clearAudioLock: store.clearAudioLock,
    attemptMicrophonePermission: store.attemptMicrophonePermission,
    retryMicrophonePermission: store.retryMicrophonePermission,
    initializePersistentBeeper: store.initializePersistentBeeper,
    startBeep: store.startBeep,
    stopBeep: store.stopBeep,
    resetBeeper: store.resetBeeper,
    
    // Expose audioContext for backward compatibility
    // Original exposed the raw value via getter
    get audioContext() {
      return audioContext.value;
    }
  };
}

