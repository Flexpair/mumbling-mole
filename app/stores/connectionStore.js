import { defineStore } from 'pinia';
import { ref, shallowRef, computed } from 'vue';
import { translate } from '../localize';
import { buildWebSocketUrl } from '../utils/websocket-url';

export const useConnectionStore = defineStore('connection', () => {
  const logger = globalThis.mumbleLog || console.log;
  
  // Lazy-loaded connector - only created when first connection is made
  let _connector = null;
  const connector = shallowRef(null);
  const client = shallowRef(null);
  
  /**
   * Get or create the WorkerBasedMumbleConnector (lazy initialization)
   * This delays loading the 1.2MB worker.js until actually needed
   */
  async function getConnector() {
    if (!_connector) {
      const { default: WorkerBasedMumbleConnector } = await import('../worker-client');
      _connector = new WorkerBasedMumbleConnector();
      connector.value = _connector;
    }
    return _connector;
  }
  
  // Connection parameters (reactive)
  const remoteHost = ref(null);
  const remotePort = ref(null);
  
  /**
   * Get current client instance
   * @returns {object|null} client instance
   */
  function getClient() {
    return client.value;
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
    if (client.value) {
      client.value.disconnect();
      client.value = null;
    }
    
    remoteHost.value = host;
    remotePort.value = port;

    logger(translate('logentry.connecting'), host);

    try {
      const wsUrl = buildWebSocketUrl(host, port);
      
      // Lazy-load connector on first connection
      const conn = await getConnector();

      const newClient = await conn.connect(wsUrl, {
        username: username,
        password: password,
        tokens: tokens,
      });

      client.value = newClient;

      logger(translate('logentry.connected'));

      return newClient;
    } catch (err) {
      logger(translate('logentry.connection_failed'), err);
      throw err;
    }
  }
  
  /**
   * Disconnect from current server
   */
  function disconnect() {
    if (client.value) {
      client.value.disconnect();
      client.value = null;
    }
    remoteHost.value = null;
    remotePort.value = null;
  }
  
  /**
   * Register channel with UI state
   * @param {object} channel - Channel object from mumble-client
   */
  function registerChannel(channel) {
    if (channel.__ui) {
      return;
    }
    
    channel.__ui = {
      model: channel,
      name: ref(channel.name),
    };
  }

  // Return store API
  return {
    // State
    connector,
    remoteHost,
    remotePort,
    client,
    
    // Computed
    isConnected: computed(() => client.value !== null),
    
    // Methods
    getClient,
    connect,
    disconnect,
    registerChannel,
  };
});
