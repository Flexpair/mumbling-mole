import { ref, computed } from 'vue';
import WorkerBasedMumbleConnector from '../worker-client';
import { translate } from '../localize';
import { buildWebSocketUrl } from '../utils/websocket-url';

/**
 * useConnectionState - Vue composable for Mumble server connection lifecycle
 * 
 * Responsibilities:
 * - WebSocket connection management via WorkerBasedMumbleConnector
 * - Remote host/port tracking
 * - Client instance lifecycle
 * - Connection state reactivity
 * 
 * State management:
 * - ref() for reactive state
 * - Internal non-reactive client instance
 */
export function useConnectionState(log) {
  const logger = log || console.log;
  
  // Connection infrastructure
  const connector = new WorkerBasedMumbleConnector();
  let client = null; // Not reactive - internal state only
  
  // Connection parameters (reactive)
  const remoteHost = ref(null);
  const remotePort = ref(null);
  
  /**
   * Get current client instance
   * @returns {object|null} client instance
   */
  function getClient() {
    return client;
  }
  
  /**
   * Connect to Mumble server via WebSocket
   * @param {string} host - Server hostname
   * @param {string|number} port - Server port. Can be a number (e.g., 64738) or a string in the format "port/path" (e.g., "443/murmur" or "443/ws").
   * @param {string} username - Username
   * @param {string} password - Password
   * @param {Array} tokens - Access tokens
   * @returns {Promise<MumbleClient>} Connected client instance
   */
  async function connect(host, port, username, password, tokens = []) {
    // Disconnect existing client before creating new connection
    if (client) {
      client.disconnect();
      client = null;
    }
    
    remoteHost.value = host;
    remotePort.value = port;

    logger(translate('logentry.connecting'), host);

    try {
      const wsUrl = buildWebSocketUrl(host, port);

      client = await connector.connect(wsUrl, {
        username: username,
        password: password,
        tokens: tokens,
      });

      logger(translate('logentry.connected'));

      return client;
    } catch (err) {
      logger(translate('logentry.connection_failed'), err);
      throw err;
    }
  }
  
  /**
   * Disconnect from current server
   */
  function disconnect() {
    if (client) {
      client.disconnect();
      client = null;
    }
    remoteHost.value = null;
    remotePort.value = null;
  }
  
  /**
   * Reset connection state
   */
  function reset() {
    disconnect();
  }
  
  // Return composable API
  return {
    // State
    connector,
    remoteHost,
    remotePort,
    
    // Computed
    isConnected: computed(() => client !== null),
    
    // Methods
    getClient,
    connect,
    disconnect,
    reset,
  };
}
