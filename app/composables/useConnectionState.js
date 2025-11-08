import { ref, computed } from 'vue';
import WorkerBasedMumbleConnector from '../worker-client';
import { translate } from '../localize';

/**
 * useConnectionState - Vue composable for Mumble server connection lifecycle
 * 
 * Responsibilities:
 * - WebSocket connection management via WorkerBasedMumbleConnector
 * - Remote host/port tracking
 * - Client instance lifecycle
 * - Connection state reactivity
 * 
 * Migration from Knockout:
 * - ko.observable() → ref()
 * - Direct method calls (same API)
 */
export function useConnectionState(log) {
  const logger = log || console.log.bind(console);
  
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
      // Parse port format: can be "443/murmur" (port + path) or just "64738" (port only)
      // For HTTPS (443) and HTTP (80), omit port from URL
      let wsUrl;
      const portStr = String(port);
      
      if (portStr.includes('/')) {
        // Format: "443/path" or "443/path/subpath" → wss://host/path or wss://host/path/subpath
        const slashIndex = portStr.indexOf('/');
        const portNum = portStr.substring(0, slashIndex);
        const path = portStr.substring(slashIndex + 1);
        const protocol = portNum === '443' ? 'wss' : 'ws';
        wsUrl = portNum === '443' || portNum === '80'
          ? `${protocol}://${host}/${path}`
          : `${protocol}://${host}:${portNum}/${path}`;
      } else {
        // Format: "64738" → wss://host:64738
        const protocol = portStr === '443' ? 'wss' : 'ws';
        wsUrl = portStr === '443' || portStr === '80'
          ? `${protocol}://${host}`
          : `${protocol}://${host}:${portStr}`;
      }

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
