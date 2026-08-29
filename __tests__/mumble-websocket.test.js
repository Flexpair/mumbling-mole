/**
 * mumble-websocket.js - Comprehensive Tests
 */

import { jest } from '@jest/globals';

describe('mumble-websocket', () => {
  let connect;
  let mockWebsocketStream;
  let mockMumbleClient;
  let mockWs;

  beforeAll(async () => {
    // Mock websocket-stream module
    mockWs = {
      on: jest.fn(function(event, handler) {
        this._handlers = this._handlers || {};
        this._handlers[event] = handler;
        return this;
      }),
      once: jest.fn(function(event, handler) {
        return this.on(event, handler);
      }),
      _trigger: function(event, ...args) {
        this._handlers?.[event]?.(...args);
      },
      destroy: jest.fn(),
    };

    mockWebsocketStream = jest.fn(() => mockWs);

    // Mock MumbleClient
    mockMumbleClient = {
      connectDataStream: jest.fn().mockResolvedValue({ connected: true })
    };

    // Setup module mocks
    jest.unstable_mockModule('../app/utils/websocket-stream-lite.js', () => ({
      default: mockWebsocketStream
    }));

    jest.unstable_mockModule('../app/mumble-client/index.js', () => ({
      default: jest.fn(() => mockMumbleClient)
    }));

    // Import after mocks are set up
    const module = await import('../app/mumble-websocket.js');
    connect = module.default;
  });

  beforeEach(() => {
    jest.clearAllMocks();
    // Reset mock websocket handlers
    mockWs._handlers = {};
  });

  describe('connect', () => {
    test('should create websocket stream with correct address and protocol', async () => {
      // Trigger connect event to resolve promise
      setTimeout(() => mockWs._trigger('connect'), 0);

      await connect('ws://localhost:64738', { username: 'testuser' });

      expect(mockWebsocketStream).toHaveBeenCalledWith('ws://localhost:64738', ['binary']);
    });

    test('should register error and connect event handlers', async () => {
      setTimeout(() => mockWs._trigger('connect'), 0);

      await connect('ws://localhost:64738', {});

      expect(mockWs.on).toHaveBeenCalledWith('error', expect.any(Function));
      expect(mockWs.on).toHaveBeenCalledWith('connect', expect.any(Function));
    });

    test('should create MumbleClient with provided options', async () => {
      const MumbleClientConstructor = (await import('../app/mumble-client/index.js')).default;
      
      setTimeout(() => mockWs._trigger('connect'), 0);

      const options = { 
        username: 'testuser',
        password: 'testpass'
      };

      await connect('ws://localhost:64738', options);

      expect(MumbleClientConstructor).toHaveBeenCalledWith(options);
    });

    test('should connect MumbleClient to websocket stream', async () => {
      setTimeout(() => mockWs._trigger('connect'), 0);

      await connect('ws://localhost:64738', {});

      expect(mockMumbleClient.connectDataStream).toHaveBeenCalledWith(mockWs);
    });

    test('should resolve with MumbleClient connection result', async () => {
      setTimeout(() => mockWs._trigger('connect'), 0);

      const result = await connect('ws://localhost:64738', {});

      expect(result).toEqual({ connected: true });
    });

    test('should reject if websocket encounters error', async () => {
      const testError = new Error('WebSocket connection failed');
      
      setTimeout(() => mockWs._trigger('error', testError), 0);

      await expect(connect('ws://localhost:64738', {})).rejects.toThrow('WebSocket connection failed');
    });

    test('should handle connection to different addresses', async () => {
      const addresses = [
        'ws://example.com:64738',
        'wss://secure.example.com:64738',
        'ws://192.168.1.100:64738'
      ];

      for (const address of addresses) {
        mockWebsocketStream.mockClear();
        setTimeout(() => mockWs._trigger('connect'), 0);

        await connect(address, {});

        expect(mockWebsocketStream).toHaveBeenCalledWith(address, ['binary']);
      }
    });

    test('should handle various MumbleClient options', async () => {
      const MumbleClientConstructor = (await import('../app/mumble-client/index.js')).default;
      
      setTimeout(() => mockWs._trigger('connect'), 0);

      const options = {
        username: 'user123',
        password: 'pass456',
        tokens: ['token1', 'token2'],
        webrtc: {
          enabled: true
        }
      };

      await connect('ws://localhost:64738', options);

      expect(MumbleClientConstructor).toHaveBeenCalledWith(options);
    });

    test('should work with minimal options', async () => {
      setTimeout(() => mockWs._trigger('connect'), 0);

      const result = await connect('ws://localhost:64738', {});

      expect(result).toBeDefined();
    });

    test('should propagate connectDataStream errors', async () => {
      const connectionError = new Error('Data stream connection failed');
      mockMumbleClient.connectDataStream.mockRejectedValueOnce(connectionError);

      setTimeout(() => mockWs._trigger('connect'), 0);

      await expect(connect('ws://localhost:64738', {})).rejects.toThrow('Data stream connection failed');
    });

    test('should handle websocket error before connect', async () => {
      const networkError = new Error('Network unreachable');
      
      // Trigger error immediately
      setTimeout(() => mockWs._trigger('error', networkError), 0);

      await expect(connect('ws://localhost:64738', {})).rejects.toThrow('Network unreachable');
      
      // connectDataStream should not be called if websocket fails
      expect(mockMumbleClient.connectDataStream).not.toHaveBeenCalled();
    });

    test('should destroy the pending websocket stream when aborted', async () => {
      const controller = new AbortController();
      const connection = connect('ws://localhost:64738', {}, {
        signal: controller.signal,
      });

      controller.abort();

      await expect(connection).rejects.toMatchObject({ name: 'AbortError' });
      expect(mockWs.destroy).toHaveBeenCalled();
      expect(mockMumbleClient.connectDataStream).not.toHaveBeenCalled();
    });

    test('should handle concurrent connect calls independently', async () => {
      // Create separate mock websockets for each call
      const mockWs1 = { ...mockWs, _handlers: {} };
      const mockWs2 = { ...mockWs, _handlers: {} };
      
      mockWs1.on = jest.fn(function(event, handler) {
        this._handlers[event] = handler;
        return this;
      });
      
      mockWs2.on = jest.fn(function(event, handler) {
        this._handlers[event] = handler;
        return this;
      });

      mockWebsocketStream
        .mockReturnValueOnce(mockWs1)
        .mockReturnValueOnce(mockWs2);

      const promise1 = connect('ws://server1:64738', { username: 'user1' });
      const promise2 = connect('ws://server2:64738', { username: 'user2' });

      // Trigger both connects
      setTimeout(() => {
        mockWs1._handlers.connect();
        mockWs2._handlers.connect();
      }, 0);

      const results = await Promise.all([promise1, promise2]);

      expect(results).toHaveLength(2);
      expect(mockWebsocketStream).toHaveBeenCalledTimes(2);
    });
  });

  describe('Edge cases', () => {
    test('should handle empty options object', async () => {
      setTimeout(() => mockWs._trigger('connect'), 0);

      const result = await connect('ws://localhost:64738', {});

      expect(result).toBeDefined();
    });

    test('should handle options with null values', async () => {
      const MumbleClientConstructor = (await import('../app/mumble-client/index.js')).default;
      
      setTimeout(() => mockWs._trigger('connect'), 0);

      const options = {
        username: null,
        password: null
      };

      await connect('ws://localhost:64738', options);

      expect(MumbleClientConstructor).toHaveBeenCalledWith(options);
    });

    test('should preserve binary protocol in websocket-stream call', async () => {
      setTimeout(() => mockWs._trigger('connect'), 0);

      await connect('ws://localhost:64738', {});

      // Verify binary protocol is always used
      const protocols = mockWebsocketStream.mock.calls[0][1];
      expect(protocols).toEqual(['binary']);
    });
  });
});
