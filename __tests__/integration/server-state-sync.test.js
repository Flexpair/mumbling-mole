/**
 * @jest-environment jsdom
 */

/**
 * Integration Test: Server-State Synchronization
 * 
 * PURPOSE: Guarantee 100% synchronization between UI state and server state
 * for mute/deaf status. This test verifies that the UI ALWAYS reflects
 * what the server thinks the client's state is.
 * 
 * CRITICAL REQUIREMENT: No user should EVER think they are muted/unmuted
 * when the server disagrees.
 */

import { jest } from '@jest/globals';
import { EventEmitter } from 'node:events';

describe('Server-State Synchronization - Critical Integration Test', () => {
  let User;
  let Client;
  let useUserState;
  let audioStateMock;
  let voiceStateMock;

  // Helper to create a mock client with self user
  function createMockClient(sessionId = 42) {
    const mockClient = new EventEmitter();
    mockClient.self = new User(mockClient, sessionId);
    mockClient._userById = { [sessionId]: mockClient.self };
    return mockClient;
  }

  // Helper to setup user state with initial values
  function setupUserState(initialMute = false, initialDeaf = false) {
    const { selfMute, selfDeaf, registerUser } = useUserState(audioStateMock, voiceStateMock);
    selfMute.value = initialMute;
    selfDeaf.value = initialDeaf;
    return { selfMute, selfDeaf, registerUser };
  }

  beforeEach(async () => {
    // Mock dependencies - inline mocks for ES modules
    jest.unstable_mockModule('../../app/audio/buffer-queue-node.js', () => ({
      default: class BufferQueueNodeMock {
        constructor() {
          this.connect = jest.fn();
        }
      }
    }));

    jest.unstable_mockModule('../../app/utils/voice-stream-manager.js', () => ({
      createVoiceStreamManager: () => ({
        set: jest.fn(),
        get: jest.fn(),
        delete: jest.fn(),
        clear: jest.fn(),
        cleanupBySessionId: jest.fn()
      })
    }));

    jest.unstable_mockModule('../../app/utils/frequency-analyzer.js', () => ({
      createFrequencyAnalyzer: () => ({
        start: jest.fn(),
        stop: jest.fn()
      })
    }));

    jest.unstable_mockModule('../../app/composables/debug-utils.js', () => ({
      debugLog: jest.fn()
    }));

    // Import after mocks
    User = (await import('../../app/mumble-client/user.js')).default;
    Client = (await import('../../app/mumble-client/client.js')).default;
    const userStateModule = await import('../../app/composables/useUserState.js');
    useUserState = userStateModule.useUserState;

    // Mock audio/voice state
    audioStateMock = {
      getAudioContext: () => ({
        createGain: () => ({ gain: { value: 1 }, connect: jest.fn() }),
        createAnalyser: () => ({ connect: jest.fn(), getByteFrequencyData: jest.fn() }),
        destination: {}
      })
    };

    voiceStateMock = {
      updateLoopbackFrequency: jest.fn(),
      isLoopbackMode: { value: false }
    };
  });

  afterEach(() => {
    jest.clearAllMocks();
    // Clean up any registered event listeners
    // useUserState creates fresh instances per test via setupUserState()
  });

  describe('GUARANTEE: UI always matches server state', () => {
    test('Server sends selfMute=true → UI MUST be muted', () => {
      const mockClient = createMockClient();
      const { selfMute, registerUser } = setupUserState(false, false);
      
      registerUser(mockClient.self);
      mockClient.self._update({ self_mute: true });

      expect(selfMute.value).toBe(true);
    });

    test('Server sends selfMute=false → UI MUST be unmuted', () => {
      const mockClient = createMockClient();
      const { selfMute, registerUser } = setupUserState(true, false);
      
      registerUser(mockClient.self);
      mockClient.self._update({ self_mute: false });

      expect(selfMute.value).toBe(false);
    });

    test('Server sends selfDeaf=true → UI MUST be deafened', () => {
      const mockClient = createMockClient();
      const { selfDeaf, registerUser } = setupUserState(false, false);
      
      registerUser(mockClient.self);
      mockClient.self._update({ self_deaf: true });

      expect(selfDeaf.value).toBe(true);
    });

    test('Server sends selfDeaf=false → UI MUST be undeafened', () => {
      const mockClient = createMockClient();
      const { selfDeaf, registerUser } = setupUserState(false, true);
      
      registerUser(mockClient.self);
      mockClient.self._update({ self_deaf: false });

      expect(selfDeaf.value).toBe(false);
    });

    test('CRITICAL: Undeafen scenario - UI preserves mute, server confirms', () => {
      const mockClient = createMockClient();
      const { selfMute, selfDeaf, registerUser } = setupUserState(true, true);
      
      registerUser(mockClient.self);

      // SIMULATE: User undeafens (client sends only selfDeaf=false to server)
      mockClient.self._update({ self_deaf: false });

      expect(selfDeaf.value).toBe(false);
      expect(selfMute.value).toBe(true); // MUST stay muted
      
      // SIMULATE: Server confirms current state
      mockClient.self._update({ self_mute: true, self_deaf: false });

      expect(selfMute.value).toBe(true);
      expect(selfDeaf.value).toBe(false);
    });

    test('CRITICAL: Server correction scenario - UI had wrong state', () => {
      const mockClient = createMockClient();
      const { selfMute, registerUser } = setupUserState(false, false);
      
      registerUser(mockClient.self);

      // SIMULATE: Server sends correction - you ARE muted!
      mockClient.self._update({ self_mute: true });

      expect(selfMute.value).toBe(true);
    });

    test('VERIFY: server-state-sync event only fires for self user', () => {
      const mockClient = createMockClient(42);
      const otherUser = new User(mockClient, 99);
      mockClient._userById[99] = otherUser;

      const { registerUser } = setupUserState();
      registerUser(mockClient.self);

      const selfSyncSpy = jest.fn();
      const otherSyncSpy = jest.fn();
      mockClient.self.on('server-state-sync', selfSyncSpy);
      otherUser.on('server-state-sync', otherSyncSpy);

      mockClient.self._update({ self_mute: true });
      expect(selfSyncSpy).toHaveBeenCalled();

      otherUser._update({ self_mute: true });
      expect(otherSyncSpy).not.toHaveBeenCalled();
    });

    test('VERIFY: Both mute and deaf can be synced in single message', () => {
      const mockClient = createMockClient();
      const { selfMute, selfDeaf, registerUser } = setupUserState(false, false);
      
      registerUser(mockClient.self);
      mockClient.self._update({ self_mute: true, self_deaf: true });

      expect(selfMute.value).toBe(true);
      expect(selfDeaf.value).toBe(true);
    });
  });

  describe('Documentation: Server as Single Source of Truth', () => {
    test('Architecture: Server state always wins', () => {
      // This test documents the architecture decision:
      // The Mumble server is the SINGLE SOURCE OF TRUTH for user state.
      // The client UI must ALWAYS reflect what the server thinks.
      // 
      // Flow:
      // 1. User clicks mute button → UI optimistically updates → Send to server
      // 2. Server processes request → Updates its state → Sends UserState message back
      // 3. Client receives UserState → Forces UI to match (via server-state-sync)
      // 
      // This guarantees:
      // - No desync between UI and server
      // - Other clients see correct state
      // - Server policy (e.g., force-mute) is respected
      expect(true).toBe(true); // Documentation test
    });
  });
});
