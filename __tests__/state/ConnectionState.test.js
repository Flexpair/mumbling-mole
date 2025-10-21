/**
 * ConnectionState - Comprehensive Tests
 * 
 * Tests ConnectionState functionality:
 * - Connection lifecycle (connect/disconnect)
 * - WebSocket URL construction
 * - Client state management
 * - Error handling
 */

import { jest } from '@jest/globals';

// Mock WorkerBasedMumbleConnector
class MockMumbleClient {
  constructor() {
    this._handlers = {};
    this.disconnect = jest.fn();
    this.setAudioQuality = jest.fn();
    this.setSelfMute = jest.fn();
    this.setSelfDeaf = jest.fn();
  }
  
  on(event, handler) {
    this._handlers[event] = handler;
    return this;
  }
  
  emit(event, ...args) {
    if (this._handlers[event]) {
      this._handlers[event](...args);
    }
  }
}

class MockConnector {
  constructor() {
    this.connect = jest.fn(async () => new MockMumbleClient());
  }
}

// Mock dependencies
jest.unstable_mockModule('../../app/worker-client.js', () => ({
  default: MockConnector
}));

jest.unstable_mockModule('../../app/localize.js', () => ({
  translate: jest.fn((key) => key) // Return key as-is
}));

const { default: ConnectionState } = await import('../../app/state/ConnectionState.js');

describe('ConnectionState - Constructor & Initialization', () => {
  test('constructor initializes with null client', () => {
    const connectionState = new ConnectionState();
    
    expect(connectionState.client).toBeNull();
    expect(connectionState.isConnected()).toBe(false);
  });

  test('constructor creates connector', () => {
    const connectionState = new ConnectionState();
    
    expect(connectionState.connector).toBeDefined();
  });

  test('constructor accepts custom log function', () => {
    const mockLog = jest.fn();
    const connectionState = new ConnectionState(mockLog);
    
    expect(connectionState.log).toBe(mockLog);
  });

  test('constructor uses console.log as default', () => {
    const connectionState = new ConnectionState();
    
    expect(connectionState.log).toBeDefined();
  });
});

describe('ConnectionState - Connection Lifecycle', () => {
  let connectionState;

  beforeEach(() => {
    connectionState = new ConnectionState(jest.fn());
  });

  test('connect establishes connection', async () => {
    await connectionState.connect('example.com', '64738', 'testuser', 'testpass');
    
    expect(connectionState.isConnected()).toBe(true);
    expect(connectionState.client).not.toBeNull();
  });

  test('connect sets remote host and port', async () => {
    await connectionState.connect('example.com', '64738', 'testuser', 'testpass');
    
    expect(connectionState.remoteHost()).toBe('example.com');
    expect(connectionState.remotePort()).toBe('64738');
  });

  test('connect returns client instance', async () => {
    const client = await connectionState.connect('example.com', '64738', 'testuser', 'testpass');
    
    expect(client).toBeDefined();
    expect(client).toBe(connectionState.client);
  });

  test('connect disconnects existing client before new connection', async () => {
    await connectionState.connect('host1.com', '64738', 'user1', 'pass1');
    const firstClient = connectionState.client;
    
    await connectionState.connect('host2.com', '64738', 'user2', 'pass2');
    
    expect(firstClient.disconnect).toHaveBeenCalled();
    expect(connectionState.client).not.toBe(firstClient);
  });
});

describe('ConnectionState - WebSocket URL Construction', () => {
  let connectionState;

  beforeEach(() => {
    connectionState = new ConnectionState(jest.fn());
  });

  test('standard port creates correct URL', async () => {
    await connectionState.connect('example.com', '64738', 'user', 'pass');
    
    expect(connectionState.connector.connect).toHaveBeenCalledWith(
      'ws://example.com:64738',
      expect.any(Object)
    );
  });

  test('port 443 uses wss protocol and omits port', async () => {
    await connectionState.connect('example.com', '443', 'user', 'pass');
    
    expect(connectionState.connector.connect).toHaveBeenCalledWith(
      'wss://example.com',
      expect.any(Object)
    );
  });

  test('port 80 uses ws protocol and omits port', async () => {
    await connectionState.connect('example.com', '80', 'user', 'pass');
    
    expect(connectionState.connector.connect).toHaveBeenCalledWith(
      'ws://example.com',
      expect.any(Object)
    );
  });

  test('port with path creates correct URL', async () => {
    await connectionState.connect('example.com', '443/murmur', 'user', 'pass');
    
    expect(connectionState.connector.connect).toHaveBeenCalledWith(
      'wss://example.com/murmur',
      expect.any(Object)
    );
  });

  test('port with subpath creates correct URL', async () => {
    await connectionState.connect('example.com', '443/ws/murmur', 'user', 'pass');
    
    expect(connectionState.connector.connect).toHaveBeenCalledWith(
      'wss://example.com/ws/murmur',
      expect.any(Object)
    );
  });

  test('non-standard port with path includes port', async () => {
    await connectionState.connect('example.com', '8080/murmur', 'user', 'pass');
    
    expect(connectionState.connector.connect).toHaveBeenCalledWith(
      'ws://example.com:8080/murmur',
      expect.any(Object)
    );
  });

  test('connect passes credentials and tokens', async () => {
    const tokens = ['token1', 'token2'];
    await connectionState.connect('example.com', '64738', 'testuser', 'testpass', tokens);
    
    expect(connectionState.connector.connect).toHaveBeenCalledWith(
      expect.any(String),
      {
        username: 'testuser',
        password: 'testpass',
        tokens: tokens,
      }
    );
  });
});

describe('ConnectionState - Error Handling', () => {
  let connectionState;

  beforeEach(() => {
    connectionState = new ConnectionState(jest.fn());
  });

  test('client error event calls resetClient', async () => {
    await connectionState.connect('example.com', '64738', 'user', 'pass');
    const client = connectionState.client;
    
    client.emit('error', new Error('Test error'));
    
    expect(connectionState.client).toBeNull();
    expect(connectionState.isConnected()).toBe(false);
  });

  test('connection error is logged and re-thrown', async () => {
    const mockLog = jest.fn();
    connectionState = new ConnectionState(mockLog);
    
    connectionState.connector.connect.mockRejectedValue(new Error('Connection failed'));
    
    await expect(connectionState.connect('example.com', '64738', 'user', 'pass'))
      .rejects.toThrow('Connection failed');
    
    expect(mockLog).toHaveBeenCalledWith(
      expect.stringContaining('error'),
      expect.any(Error)
    );
  });
});

describe('ConnectionState - Client Management', () => {
  let connectionState;

  beforeEach(() => {
    connectionState = new ConnectionState(jest.fn());
  });

  test('getClient returns current client', async () => {
    await connectionState.connect('example.com', '64738', 'user', 'pass');
    
    const client = connectionState.getClient();
    
    expect(client).toBe(connectionState.client);
  });

  test('getClient returns null when not connected', () => {
    const client = connectionState.getClient();
    
    expect(client).toBeNull();
  });

  test('resetClient disconnects and clears client', async () => {
    await connectionState.connect('example.com', '64738', 'user', 'pass');
    const client = connectionState.client;
    
    connectionState.resetClient();
    
    expect(client.disconnect).toHaveBeenCalled();
    expect(connectionState.client).toBeNull();
  });

  test('resetClient can be called multiple times safely', async () => {
    await connectionState.connect('example.com', '64738', 'user', 'pass');
    
    connectionState.resetClient();
    connectionState.resetClient();
    
    expect(connectionState.client).toBeNull();
  });
});

describe('ConnectionState - Audio & Mute Settings', () => {
  let connectionState;

  beforeEach(async () => {
    connectionState = new ConnectionState(jest.fn());
    await connectionState.connect('example.com', '64738', 'user', 'pass');
  });

  test('setAudioQuality forwards to client', () => {
    connectionState.setAudioQuality(40000, 960);
    
    expect(connectionState.client.setAudioQuality).toHaveBeenCalledWith(40000, 960);
  });

  test('setAudioQuality does nothing when not connected', () => {
    connectionState.resetClient();
    
    // Should not throw
    connectionState.setAudioQuality(40000, 960);
  });

  test('setSelfMute forwards to client', () => {
    connectionState.setSelfMute(true);
    
    expect(connectionState.client.setSelfMute).toHaveBeenCalledWith(true);
  });

  test('setSelfMute handles false', () => {
    connectionState.setSelfMute(false);
    
    expect(connectionState.client.setSelfMute).toHaveBeenCalledWith(false);
  });

  test('setSelfMute does nothing when not connected', () => {
    connectionState.resetClient();
    
    connectionState.setSelfMute(true);
    // Should not throw
  });

  test('setSelfDeaf forwards to client', () => {
    connectionState.setSelfDeaf(true);
    
    expect(connectionState.client.setSelfDeaf).toHaveBeenCalledWith(true);
  });

  test('setSelfDeaf handles false', () => {
    connectionState.setSelfDeaf(false);
    
    expect(connectionState.client.setSelfDeaf).toHaveBeenCalledWith(false);
  });

  test('setSelfDeaf does nothing when not connected', () => {
    connectionState.resetClient();
    
    connectionState.setSelfDeaf(true);
    // Should not throw
  });
});
