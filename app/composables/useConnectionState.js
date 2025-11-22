import { safeStoreToRefs } from '../utils/safeStoreToRefs';
import { useConnectionStore } from '../stores/connectionStore';

/**
 * useConnectionState - Adapter for Pinia ConnectionStore
 * 
 * Maintains backward compatibility with existing code that expects
 * the composable API.
 */
export function useConnectionState(log) {
  const store = useConnectionStore();
  
  const { remoteHost, remotePort, isConnected } = safeStoreToRefs(store);
  
  return {
    // State
    connector: store.connector,
    remoteHost,
    remotePort,
    
    // Computed
    isConnected,
    
    // Methods
    getClient: store.getClient,
    connect: store.connect,
    disconnect: store.disconnect,
    reset: store.reset,
  };
}

