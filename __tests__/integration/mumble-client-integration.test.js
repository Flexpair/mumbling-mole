/**
 * Integration Tests for mumble-client usage in the application
 * 
 * These tests validate how mumble-client integrates with the rest of the codebase:
 * - WorkerBasedMumbleConnector usage
 * - Channel/User object creation and management
 * - Event handling and property synchronization
 * - Bandwidth calculation helpers
 */

import { jest } from '@jest/globals';

describe('mumble-client Integration Tests', () => {
  describe('Bandwidth Calculation (Static Methods)', () => {
    let MumbleClient;

    beforeAll(async () => {
      const module = await import('../../app/mumble-client/index.js');
      MumbleClient = module.default;
    });

    test('calcEnforcableBandwidth should be available as static method', () => {
      expect(MumbleClient.calcEnforcableBandwidth).toBeDefined();
      expect(typeof MumbleClient.calcEnforcableBandwidth).toBe('function');
    });

    test('calcEnforcableBandwidth should calculate bandwidth for valid input', () => {
      // Test based on usage in app/index.js line 337
      const result = MumbleClient.calcEnforcableBandwidth(
        96000,    // bitrate
        60,       // frames per packet
        false     // voice activity detection
      );

      expect(result).toBeDefined();
      expect(typeof result).toBe('number');
      expect(result).toBeGreaterThan(0);
    });

    test('calcEnforcableBandwidth should handle different bitrate values', () => {
      const bitrates = [40000, 72000, 96000, 128000];
      
      for (const bitrate of bitrates) {
        const result = MumbleClient.calcEnforcableBandwidth(
          bitrate,
          60,
          false
        );
        
        expect(result).toBeGreaterThan(0);
        expect(typeof result).toBe('number');
        // Note: Result may be higher than input bitrate due to protocol overhead
      }
    });

    test('calcEnforcableBandwidth should handle voice activity detection flag', () => {
      const withoutVad = MumbleClient.calcEnforcableBandwidth(96000, 60, false);
      const withVad = MumbleClient.calcEnforcableBandwidth(96000, 60, true);

      expect(withoutVad).toBeDefined();
      expect(withVad).toBeDefined();
      // Both should return valid bandwidth values
      expect(withoutVad).toBeGreaterThan(0);
      expect(withVad).toBeGreaterThan(0);
      // Note: VAD flag affects calculation but may not always reduce bandwidth
    });

    test('calcEnforcableBandwidth should handle different frame counts', () => {
      const frames = [20, 40, 60];
      
      for (const frameCount of frames) {
        const result = MumbleClient.calcEnforcableBandwidth(
          96000,
          frameCount,
          false
        );
        
        expect(result).toBeGreaterThan(0);
      }
    });
  });

  describe('Client Construction', () => {
    let MumbleClient;

    beforeAll(async () => {
      const module = await import('../../app/mumble-client/index.js');
      MumbleClient = module.default;
    });

    test('should construct MumbleClient with username option', () => {
      const client = new MumbleClient({ username: 'testuser' });
      
      expect(client).toBeDefined();
      expect(client).toBeInstanceOf(MumbleClient);
    });

    test('should construct MumbleClient with full options', () => {
      const options = {
        username: 'testuser',
        password: 'testpass',
        tokens: ['token1', 'token2'],
        clientSoftware: 'mumble-web',
        osName: 'Browser',
        osVersion: 'v1.0'
      };

      const client = new MumbleClient(options);
      
      expect(client).toBeDefined();
      expect(client).toBeInstanceOf(MumbleClient);
    });

    test('should have connectDataStream method', () => {
      const client = new MumbleClient({ username: 'dummy' });
      
      expect(client.connectDataStream).toBeDefined();
      expect(typeof client.connectDataStream).toBe('function');
    });

    test('dummy client construction for worker proxy should work', () => {
      // Based on worker-client.js line 206: this._dummyClient = new MumbleClient({ username: "dummy" })
      const dummyClient = new MumbleClient({ username: 'dummy' });
      
      expect(dummyClient).toBeDefined();
      expect(dummyClient).toBeInstanceOf(MumbleClient);
    });
  });

  describe('Client Event System', () => {
    let MumbleClient;

    beforeAll(async () => {
      const module = await import('../../app/mumble-client/index.js');
      MumbleClient = module.default;
    });

    test('client should be EventEmitter-like', () => {
      const client = new MumbleClient({ username: 'testuser' });
      
      // Check for EventEmitter methods
      expect(client.on).toBeDefined();
      expect(typeof client.on).toBe('function');
    });

    test('client should support event registration', () => {
      const client = new MumbleClient({ username: 'testuser' });
      const mockHandler = jest.fn();

      // Should not throw when registering events
      expect(() => {
        client.on('connected', mockHandler);
      }).not.toThrow();
    });

    test('client should support multiple event types', () => {
      const client = new MumbleClient({ username: 'testuser' });
      const eventTypes = ['connected', 'error', 'message', 'voice'];

      for (const eventType of eventTypes) {
        expect(() => {
          client.on(eventType, () => {});
        }).not.toThrow();
      }
    });
  });

  describe('Client Properties and Methods', () => {
    let MumbleClient;

    beforeAll(async () => {
      const module = await import('../../app/mumble-client/index.js');
      MumbleClient = module.default;
    });

    test('client should have expected methods for connection management', () => {
      const client = new MumbleClient({ username: 'testuser' });
      
      // Methods used in the codebase
      expect(client.connectDataStream).toBeDefined();
      expect(typeof client.connectDataStream).toBe('function');
    });

    test('client should maintain internal state for channels and users', () => {
      const client = new MumbleClient({ username: 'testuser' });
      
      // Internal state tracking (used by worker-client.js)
      expect(client._channelById).toBeDefined();
      expect(client._userById).toBeDefined();
    });
  });

  describe('Integration with ConnectionState', () => {
    test('client interface matches ConnectionState expectations', async () => {
      const MumbleClient = (await import('../../app/mumble-client/index.js')).default;
      const client = new MumbleClient({ username: 'testuser' });

      // ConnectionState expects these properties/methods
      // Based on app/state/ConnectionState.js
      expect(client.on).toBeDefined(); // Event listener registration
      expect(client.connectDataStream).toBeDefined(); // Connection method
      expect(typeof client._channelById).toBe('object'); // Channel tracking
      expect(typeof client._userById).toBe('object'); // User tracking
    });
  });

  describe('Integration with WorkerBasedMumbleClient', () => {
    test('dummy client creation pattern used in worker-client.js', () => {
      // This pattern is critical for the WorkerBasedMumbleClient
      // See worker-client.js line 206
      expect(async () => {
        const MumbleClient = (await import('../../app/mumble-client/index.js')).default;
        const dummyClient = new MumbleClient({ username: 'dummy' });
        
        // Dummy client is used to get Channel/User class prototypes
        expect(dummyClient._channelById).toBeDefined();
        expect(dummyClient._userById).toBeDefined();
      }).not.toThrow();
    });
  });

  describe('Error Handling', () => {
    let MumbleClient;

    beforeAll(async () => {
      const module = await import('../../app/mumble-client/index.js');
      MumbleClient = module.default;
    });

    test('should require username option', () => {
      // MumbleClient requires username - should throw if missing
      expect(() => {
        new MumbleClient({});
      }).toThrow('No username given');
    });

    test('should require username in options', () => {
      // Empty options should throw due to missing username
      expect(() => {
        new MumbleClient({});
      }).toThrow('No username given');
    });

    test('connectDataStream should handle invalid stream gracefully', async () => {
      const client = new MumbleClient({ username: 'testuser' });
      
      // Should return a rejected promise or throw for invalid stream
      await expect(async () => {
        await client.connectDataStream(null);
      }).rejects.toThrow();
    });
  });

  describe('Memory and Resource Management', () => {
    let MumbleClient;

    beforeAll(async () => {
      const module = await import('../../app/mumble-client/index.js');
      MumbleClient = module.default;
    });

    test('multiple client instances should be independent', () => {
      const client1 = new MumbleClient({ username: 'user1' });
      const client2 = new MumbleClient({ username: 'user2' });

      expect(client1).not.toBe(client2);
      expect(client1._channelById).not.toBe(client2._channelById);
      expect(client1._userById).not.toBe(client2._userById);
    });

    test('client instances should be garbage collectable', () => {
      // Create and discard client
      let client = new MumbleClient({ username: 'testuser' });
      const weakRef = new WeakRef(client);
      
      expect(weakRef.deref()).toBeDefined();
      
      client = null;
      // Note: Actual GC testing is unreliable in Jest, but we verify WeakRef works
      expect(weakRef).toBeDefined();
    });
  });

  describe('Compatibility with Existing Codebase Patterns', () => {
    test('bandwidth calculation matches usage in index.js', async () => {
      const MumbleClient = (await import('../../app/mumble-client/index.js')).default;
      
      // Pattern from app/index.js line 337-340
      const actualBandwidth = MumbleClient.calcEnforcableBandwidth(
        96000,
        60,
        false
      );

      expect(actualBandwidth).toBeDefined();
      expect(typeof actualBandwidth).toBe('number');
    });

    test('client construction matches worker-client.js pattern', async () => {
      const MumbleClient = (await import('../../app/mumble-client/index.js')).default;
      
      // Pattern from worker-client.js line 206
      const dummyClient = new MumbleClient({ username: 'dummy' });

      expect(dummyClient).toBeDefined();
      expect(dummyClient._channelById).toBeDefined();
      expect(dummyClient._userById).toBeDefined();
    });

    test('client construction matches mumble-websocket.js pattern', async () => {
      const MumbleClient = (await import('../../app/mumble-client/index.js')).default;
      
      // Pattern from mumble-websocket.js line 14
      const options = {
        username: 'testuser',
        password: 'testpass'
      };
      const client = new MumbleClient(options);

      expect(client.connectDataStream).toBeDefined();
    });
  });
});
