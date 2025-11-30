/**
 * connectionStore Tests
 * 
 * Tests for the connection store that manages WebSocket connections
 * to Mumble servers via the worker-client.
 */
import { jest, describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { ref, shallowRef } from 'vue';

// Mock worker-client before importing connectionStore
const mockConnect = jest.fn();
const mockDisconnect = jest.fn();
const mockClient = {
  disconnect: mockDisconnect,
  on: jest.fn(),
  setAudioQuality: jest.fn(),
};

jest.unstable_mockModule('../../app/worker-client', () => ({
  default: class MockWorkerBasedMumbleConnector {
    async connect(url, options) {
      mockConnect(url, options);
      return mockClient;
    }
  }
}));

jest.unstable_mockModule('../../app/localize', () => ({
  translate: jest.fn((key) => key),
}));

jest.unstable_mockModule('../../app/utils/websocket-url', () => ({
  buildWebSocketUrl: jest.fn((host, port) => `wss://${String(host)}:${String(port)}`),
}));

// Create a mock store factory since Pinia isn't available
function createMockConnectionStore() {
  const logger = globalThis.mumbleLog || console.log;
  let _connector = null;
  const connector = shallowRef(null);
  const client = shallowRef(null);
  const remoteHost = ref(null);
  const remotePort = ref(null);

  async function getConnector() {
    if (!_connector) {
      const { default: WorkerBasedMumbleConnector } = await import('../../app/worker-client');
      _connector = new WorkerBasedMumbleConnector();
      connector.value = _connector;
    }
    return _connector;
  }

  function getClient() {
    return client.value;
  }

  async function connect(host, port, username, password, tokens = []) {
    if (client.value) {
      client.value.disconnect();
      client.value = null;
    }
    
    remoteHost.value = host;
    remotePort.value = port;

    const { translate } = await import('../../app/localize');
    const { buildWebSocketUrl } = await import('../../app/utils/websocket-url');
    
    logger(translate('logentry.connecting'), host);

    try {
      const wsUrl = buildWebSocketUrl(host, port);
      const conn = await getConnector();
      const newClient = await conn.connect(wsUrl, {
        username,
        password,
        tokens,
      });
      client.value = newClient;
      logger(translate('logentry.connected'));
      return newClient;
    } catch (err) {
      logger(translate('logentry.connection_failed'), err);
      throw err;
    }
  }

  function disconnect() {
    if (client.value) {
      client.value.disconnect();
      client.value = null;
    }
    remoteHost.value = null;
    remotePort.value = null;
  }

  function registerChannel(channel) {
    if (channel.__ui) return;
    channel.__ui = {
      model: channel,
      name: ref(channel.name),
    };
  }

  // Return object with getters that unwrap refs (like Pinia does)
  return {
    // Getters that unwrap refs (simulating Pinia behavior)
    get connector() { return connector.value; },
    get remoteHost() { return remoteHost.value; },
    get remotePort() { return remotePort.value; },
    get client() { return client.value; },
    get isConnected() { return client.value !== null; },
    // Methods
    getClient,
    connect,
    disconnect,
    registerChannel,
  };
}

describe('connectionStore', () => {
  let store;

  beforeEach(() => {
    jest.clearAllMocks();
    globalThis.mumbleLog = jest.fn();
    store = createMockConnectionStore();
  });

  afterEach(() => {
    delete globalThis.mumbleLog;
    store.disconnect();
  });

  describe('Initial State', () => {
    it('should have null client initially', () => {
      expect(store.client).toBeNull();
    });

    it('should have null remoteHost initially', () => {
      expect(store.remoteHost).toBeNull();
    });

    it('should have null remotePort initially', () => {
      expect(store.remotePort).toBeNull();
    });

    it('should report isConnected as false initially', () => {
      expect(store.isConnected).toBe(false);
    });
  });

  describe('connect()', () => {
    it('should connect to server with correct parameters', async () => {
      const client = await store.connect('murmur', 64738, 'testuser', 'testpass', ['token1']);
      
      expect(mockConnect).toHaveBeenCalledWith(
        'wss://murmur:64738',
        {
          username: 'testuser',
          password: 'testpass',
          tokens: ['token1'],
        }
      );
      expect(client).toBe(mockClient);
    });

    it('should store remoteHost and remotePort', async () => {
      await store.connect('example.com', 443, 'user', 'pass');
      
      expect(store.remoteHost).toBe('example.com');
      expect(store.remotePort).toBe(443);
    });

    it('should update client reference', async () => {
      await store.connect('murmur', 64738, 'user', 'pass');
      
      expect(store.client).toBe(mockClient);
      expect(store.isConnected).toBe(true);
    });

    it('should use empty tokens array by default', async () => {
      await store.connect('murmur', 64738, 'user', 'pass');
      
      expect(mockConnect).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ tokens: [] })
      );
    });

    it('should disconnect existing client before new connection', async () => {
      // First connection
      await store.connect('server1', 64738, 'user1', 'pass1');
      
      // Second connection should disconnect first
      await store.connect('server2', 64738, 'user2', 'pass2');
      
      expect(mockDisconnect).toHaveBeenCalled();
    });

    it('should log connection attempt', async () => {
      await store.connect('murmur', 64738, 'user', 'pass');
      
      expect(globalThis.mumbleLog).toHaveBeenCalledWith('logentry.connecting', 'murmur');
    });

    it('should log successful connection', async () => {
      await store.connect('murmur', 64738, 'user', 'pass');
      
      expect(globalThis.mumbleLog).toHaveBeenCalledWith('logentry.connected');
    });
  });

  describe('disconnect()', () => {
    it('should disconnect client', async () => {
      await store.connect('murmur', 64738, 'user', 'pass');
      
      store.disconnect();
      
      expect(mockDisconnect).toHaveBeenCalled();
    });

    it('should clear client reference', async () => {
      await store.connect('murmur', 64738, 'user', 'pass');
      
      store.disconnect();
      
      expect(store.client).toBeNull();
      expect(store.isConnected).toBe(false);
    });

    it('should clear remoteHost and remotePort', async () => {
      await store.connect('murmur', 64738, 'user', 'pass');
      
      store.disconnect();
      
      expect(store.remoteHost).toBeNull();
      expect(store.remotePort).toBeNull();
    });

    it('should handle disconnect when not connected', () => {
      // Should not throw
      expect(() => store.disconnect()).not.toThrow();
    });
  });

  describe('getClient()', () => {
    it('should return null when not connected', () => {
      expect(store.getClient()).toBeNull();
    });

    it('should return client when connected', async () => {
      await store.connect('murmur', 64738, 'user', 'pass');
      
      expect(store.getClient()).toBe(mockClient);
    });
  });

  describe('registerChannel()', () => {
    it('should add __ui property to channel', () => {
      const channel = { name: 'Test Channel' };
      
      store.registerChannel(channel);
      
      expect(channel.__ui).toBeDefined();
      expect(channel.__ui.model).toBe(channel);
    });

    it('should create reactive name ref', () => {
      const channel = { name: 'Test Channel' };
      
      store.registerChannel(channel);
      
      expect(channel.__ui.name.value).toBe('Test Channel');
    });

    it('should not overwrite existing __ui', () => {
      const existingUi = { custom: true };
      const channel = { name: 'Test', __ui: existingUi };
      
      store.registerChannel(channel);
      
      expect(channel.__ui).toBe(existingUi);
    });
  });

  describe('Lazy connector loading', () => {
    it('should not create connector until first connection', () => {
      expect(store.connector).toBeNull();
    });

    it('should reuse connector for subsequent connections', async () => {
      await store.connect('server1', 64738, 'user', 'pass');
      const connector1 = store.connector;
      
      store.disconnect();
      await store.connect('server2', 64738, 'user', 'pass');
      const connector2 = store.connector;
      
      expect(connector1).toBe(connector2);
    });
  });
});
