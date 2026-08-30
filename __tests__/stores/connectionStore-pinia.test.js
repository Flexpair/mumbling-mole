/**
 * connectionStore Pinia Store Tests
 * 
 * Tests the connection store functionality using mocks
 */
import { jest, describe, it, expect, beforeEach, afterEach } from '@jest/globals';

// Mock Vue reactivity
jest.unstable_mockModule('vue', () => ({
  ref: (val) => ({
    _val: val,
    get value() { return this._val; },
    set value(v) { this._val = v; },
    __v_isRef: true
  }),
  shallowRef: (val) => ({
    _val: val,
    get value() { return this._val; },
    set value(v) { this._val = v; },
    __v_isRef: true
  }),
  computed: (fn) => ({ 
    get value() { return fn(); },
    __v_isRef: true 
  }),
}));

// Mock Pinia
jest.unstable_mockModule('pinia', () => ({
  defineStore: (id, setup) => {
    return () => setup();
  },
}));

// Mock translate
jest.unstable_mockModule('../../app/localize', () => ({
  translate: (key) => key,
}));

// Mock websocket-url
jest.unstable_mockModule('../../app/utils/websocket-url', () => ({
  buildWebSocketUrl: jest.fn((host, port) => `wss://${host}:${port}`),
}));

// Mock WorkerBasedMumbleConnector
const mockClient = {
  disconnect: jest.fn(),
  root: { name: 'Root' },
  self: { session: 1 },
  users: new Map(),
};

const mockConnector = {
  connect: jest.fn().mockResolvedValue(mockClient),
};

jest.unstable_mockModule('../../app/worker-client', () => ({
  default: jest.fn(() => mockConnector),
}));

const { useConnectionStore } = await import('../../app/stores/connectionStore.js');

describe('connectionStore', () => {
  let store;
  let mockLogger;

  beforeEach(() => {
    jest.clearAllMocks();
    mockLogger = jest.fn();
    globalThis.mumbleLog = mockLogger;
    store = useConnectionStore();
  });

  afterEach(() => {
    delete globalThis.mumbleLog;
  });

  describe('initial state', () => {
    it('should have null client initially', () => {
      expect(store.client.value).toBeNull();
    });

    it('should have null remoteHost initially', () => {
      expect(store.remoteHost.value).toBeNull();
    });

    it('should have null remotePort initially', () => {
      expect(store.remotePort.value).toBeNull();
    });

    it('should report not connected initially', () => {
      expect(store.isConnected.value).toBe(false);
    });
  });

  describe('getClient()', () => {
    it('should return null when not connected', () => {
      expect(store.getClient()).toBeNull();
    });

    it('should return client when connected', async () => {
      await store.connect('host', 64738, 'user', 'pass');
      expect(store.getClient()).toBe(mockClient);
    });
  });

  describe('connect()', () => {
    it('should connect to server', async () => {
      const client = await store.connect('murmur', 64738, 'testuser', 'testpass', ['token1']);

      expect(client).toBe(mockClient);
      expect(store.client.value).toBe(mockClient);
    });

    it('should store remoteHost and remotePort', async () => {
      await store.connect('example.com', 443, 'user', 'pass');

      expect(store.remoteHost.value).toBe('example.com');
      expect(store.remotePort.value).toBe(443);
    });

    it('should build correct WebSocket URL', async () => {
      const { buildWebSocketUrl } = await import('../../app/utils/websocket-url.js');
      
      await store.connect('myhost', 12345, 'user', 'pass');

      expect(buildWebSocketUrl).toHaveBeenCalledWith('myhost', 12345);
    });

    it('should pass credentials to connector', async () => {
      await store.connect('host', 64738, 'myuser', 'mypass', ['tok1', 'tok2']);

      expect(mockConnector.connect).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          username: 'myuser',
          password: 'mypass',
          tokens: ['tok1', 'tok2'],
        }),
        expect.objectContaining({ signal: expect.any(AbortSignal) })
      );
    });

    it('should use empty tokens by default', async () => {
      await store.connect('host', 64738, 'user', 'pass');

      expect(mockConnector.connect).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ tokens: [] }),
        expect.objectContaining({ signal: expect.any(AbortSignal) })
      );
    });

    it('should log connection attempt', async () => {
      await store.connect('host', 64738, 'user', 'pass');

      expect(mockLogger).toHaveBeenCalledWith('logentry.connecting', 'host');
    });

    it('should log successful connection', async () => {
      await store.connect('host', 64738, 'user', 'pass');

      expect(mockLogger).toHaveBeenCalledWith('logentry.connected');
    });

    it('should disconnect existing client before new connection', async () => {
      // First connection
      await store.connect('server1', 64738, 'user1', 'pass1');
      
      // Disconnect mock
      const firstClient = store.client.value;
      
      // Second connection
      await store.connect('server2', 64738, 'user2', 'pass2');

      expect(firstClient.disconnect).toHaveBeenCalled();
    });

    it('should throw and log on connection failure', async () => {
      const error = new Error('Connection failed');
      mockConnector.connect.mockRejectedValueOnce(error);

      await expect(store.connect('host', 64738, 'user', 'pass')).rejects.toThrow('Connection failed');
      expect(mockLogger).toHaveBeenCalledWith('logentry.connection_failed', error);
    });

    it('should update isConnected after connection', async () => {
      expect(store.isConnected.value).toBe(false);
      
      await store.connect('host', 64738, 'user', 'pass');
      
      expect(store.isConnected.value).toBe(true);
    });

    it('should disconnect a client that resolves after the attempt was cancelled', async () => {
      let resolveConnection;
      const staleClient = { ...mockClient, disconnect: jest.fn() };
      mockConnector.connect.mockReturnValueOnce(new Promise(resolve => {
        resolveConnection = resolve;
      }));

      const connection = store.connect('host', 64738, 'user', 'pass');
      store.disconnect();
      resolveConnection(staleClient);

      await expect(connection).rejects.toMatchObject({
        code: 'CONNECTION_ATTEMPT_SUPERSEDED',
      });
      expect(staleClient.disconnect).toHaveBeenCalled();
      expect(store.client.value).toBeNull();
    });

    it('should abort a pending worker connection when disconnected', async () => {
      let capturedSignal;
      mockConnector.connect.mockImplementationOnce((host, args, { signal }) => (
        new Promise((resolve, reject) => {
          capturedSignal = signal;
          signal.addEventListener('abort', () => {
            reject(Object.assign(new Error('Connection aborted'), { name: 'AbortError' }));
          }, { once: true });
        })
      ));

      const connection = store.connect('host', 64738, 'user', 'pass');
      await new Promise(resolve => setTimeout(resolve, 0));
      expect(capturedSignal).toBeDefined();

      store.disconnect();

      expect(capturedSignal.aborted).toBe(true);
      await expect(connection).rejects.toMatchObject({
        code: 'CONNECTION_ATTEMPT_SUPERSEDED',
      });
    });

    it('should retain only the newest concurrently resolved client', async () => {
      let resolveFirst;
      let resolveSecond;
      const firstClient = { ...mockClient, disconnect: jest.fn() };
      const secondClient = { ...mockClient, disconnect: jest.fn() };
      mockConnector.connect
        .mockReturnValueOnce(new Promise(resolve => { resolveFirst = resolve; }))
        .mockReturnValueOnce(new Promise(resolve => { resolveSecond = resolve; }));

      const firstConnection = store.connect('first', 64738, 'first', 'pass');
      const secondConnection = store.connect('second', 64738, 'second', 'pass');
      resolveSecond(secondClient);
      await expect(secondConnection).resolves.toBe(secondClient);
      resolveFirst(firstClient);
      await expect(firstConnection).rejects.toMatchObject({
        code: 'CONNECTION_ATTEMPT_SUPERSEDED',
      });

      expect(firstClient.disconnect).toHaveBeenCalled();
      expect(secondClient.disconnect).not.toHaveBeenCalled();
      expect(store.client.value).toBe(secondClient);
      expect(store.remoteHost.value).toBe('second');
    });

    it('should share connector initialization between concurrent first connections', async () => {
      const { default: WorkerBasedMumbleConnector } = await import('../../app/worker-client.js');

      const firstConnection = store.connect('first', 64738, 'first', 'pass');
      const secondConnection = store.connect('second', 64738, 'second', 'pass');

      await expect(firstConnection).rejects.toMatchObject({
        code: 'CONNECTION_ATTEMPT_SUPERSEDED',
      });
      await expect(secondConnection).resolves.toBe(mockClient);
      expect(WorkerBasedMumbleConnector).toHaveBeenCalledTimes(1);
    });
  });

  describe('disconnect()', () => {
    it('should disconnect client', async () => {
      await store.connect('host', 64738, 'user', 'pass');
      
      store.disconnect();

      expect(mockClient.disconnect).toHaveBeenCalled();
    });

    it('should clear client reference', async () => {
      await store.connect('host', 64738, 'user', 'pass');
      
      store.disconnect();

      expect(store.client.value).toBeNull();
      expect(store.isConnected.value).toBe(false);
    });

    it('should clear remoteHost and remotePort', async () => {
      await store.connect('host', 64738, 'user', 'pass');
      
      store.disconnect();

      expect(store.remoteHost.value).toBeNull();
      expect(store.remotePort.value).toBeNull();
    });

    it('should not throw when disconnecting without connection', () => {
      expect(() => store.disconnect()).not.toThrow();
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
      const channel = { name: 'My Channel' };
      
      store.registerChannel(channel);

      expect(channel.__ui.name.value).toBe('My Channel');
    });

    it('should not overwrite existing __ui', () => {
      const existingUI = { custom: true };
      const channel = { name: 'Test', __ui: existingUI };
      
      store.registerChannel(channel);

      expect(channel.__ui).toBe(existingUI);
    });
  });

  describe('lazy connector loading', () => {
    it('should not create connector until first connection', () => {
      expect(store.connector.value).toBeNull();
    });

    it('should create connector on first connection', async () => {
      await store.connect('host', 64738, 'user', 'pass');
      
      expect(store.connector.value).toBe(mockConnector);
    });
  });
});
