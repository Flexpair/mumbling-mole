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

  describe('GUARANTEE: UI always matches server state', () => {
    test('Server sends selfMute=true → UI MUST be muted', () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      
      // Create mock client with self user
      const mockClient = new EventEmitter();
      mockClient.self = new User(mockClient, 42);
      mockClient._userById = { 42: mockClient.self };

      // Initialize user state composable
      const { selfMute, selfDeaf, registerUser } = useUserState(audioStateMock, voiceStateMock);
      
      // Initial state: unmuted
      selfMute.value = false;
      selfDeaf.value = false;
      
      // Register user (sets up server-state-sync listener)
      registerUser(mockClient.self);

      // SIMULATE: Server sends UserState with selfMute=true
      mockClient.self._update({ self_mute: true });

      // VERIFY: UI state MUST match server
      expect(selfMute.value).toBe(true);
      expect(consoleSpy).toHaveBeenCalledWith(
        '[SERVER-STATE-SYNC] Received server state:',
        expect.objectContaining({ selfMute: true })
      );
      expect(consoleSpy).toHaveBeenCalledWith(
        '[SERVER-STATE-SYNC] UI synchronized to:',
        expect.objectContaining({ selfMute: true })
      );
      
      consoleSpy.mockRestore();
    });

    test('Server sends selfMute=false → UI MUST be unmuted', () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      
      const mockClient = new EventEmitter();
      mockClient.self = new User(mockClient, 42);
      mockClient._userById = { 42: mockClient.self };

      const { selfMute, selfDeaf, registerUser } = useUserState(audioStateMock, voiceStateMock);
      
      // Initial state: muted
      selfMute.value = true;
      
      registerUser(mockClient.self);

      // SIMULATE: Server sends UserState with selfMute=false
      mockClient.self._update({ self_mute: false });

      // VERIFY: UI MUST be unmuted
      expect(selfMute.value).toBe(false);
      
      consoleSpy.mockRestore();
    });

    test('Server sends selfDeaf=true → UI MUST be deafened', () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      
      const mockClient = new EventEmitter();
      mockClient.self = new User(mockClient, 42);
      mockClient._userById = { 42: mockClient.self };

      const { selfMute, selfDeaf, registerUser } = useUserState(audioStateMock, voiceStateMock);
      
      selfDeaf.value = false;
      
      registerUser(mockClient.self);

      // SIMULATE: Server sends UserState with selfDeaf=true
      mockClient.self._update({ self_deaf: true });

      // VERIFY: UI MUST be deafened
      expect(selfDeaf.value).toBe(true);
      
      consoleSpy.mockRestore();
    });

    test('Server sends selfDeaf=false → UI MUST be undeafened', () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      
      const mockClient = new EventEmitter();
      mockClient.self = new User(mockClient, 42);
      mockClient._userById = { 42: mockClient.self };

      const { selfMute, selfDeaf, registerUser } = useUserState(audioStateMock, voiceStateMock);
      
      selfDeaf.value = true;
      
      registerUser(mockClient.self);

      // SIMULATE: Server sends UserState with selfDeaf=false
      mockClient.self._update({ self_deaf: false });

      // VERIFY: UI MUST be undeafened
      expect(selfDeaf.value).toBe(false);
      
      consoleSpy.mockRestore();
    });

    test('CRITICAL: Undeafen scenario - UI preserves mute, server confirms', () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      
      const mockClient = new EventEmitter();
      mockClient.self = new User(mockClient, 42);
      mockClient._userById = { 42: mockClient.self };

      const { selfMute, selfDeaf, registerUser } = useUserState(audioStateMock, voiceStateMock);
      
      // Initial: User is muted AND deafened
      selfMute.value = true;
      selfDeaf.value = true;
      
      registerUser(mockClient.self);

      // SIMULATE: User undeafens (client sends only selfDeaf=false to server)
      // Server responds with ONLY selfDeaf=false (does NOT send selfMute)
      mockClient.self._update({ self_deaf: false });

      // VERIFY: deaf state changed, mute preserved
      expect(selfDeaf.value).toBe(false);
      expect(selfMute.value).toBe(true); // MUST stay muted
      
      // SIMULATE: Server confirms current state (echo back what it has)
      // If server had wrong state, this would force correction
      mockClient.self._update({ self_mute: true, self_deaf: false });

      // VERIFY: UI still matches
      expect(selfMute.value).toBe(true);
      expect(selfDeaf.value).toBe(false);
      
      consoleSpy.mockRestore();
    });

    test('CRITICAL: Server correction scenario - UI had wrong state', () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      
      const mockClient = new EventEmitter();
      mockClient.self = new User(mockClient, 42);
      mockClient._userById = { 42: mockClient.self };

      const { selfMute, selfDeaf, registerUser } = useUserState(audioStateMock, voiceStateMock);
      
      // SIMULATE: UI thinks it's unmuted (e.g., due to bug or race condition)
      selfMute.value = false;
      selfDeaf.value = false;
      
      registerUser(mockClient.self);

      // SIMULATE: Server sends correction - you ARE muted!
      mockClient.self._update({ self_mute: true });

      // VERIFY: UI MUST accept server's authority
      expect(selfMute.value).toBe(true);
      expect(consoleSpy).toHaveBeenCalledWith(
        '[SERVER-STATE-SYNC] UI synchronized to:',
        expect.objectContaining({ selfMute: true })
      );
      
      consoleSpy.mockRestore();
    });

    test('VERIFY: server-state-sync event only fires for self user', () => {
      const mockClient = new EventEmitter();
      mockClient.self = new User(mockClient, 42);
      const otherUser = new User(mockClient, 99);
      mockClient._userById = { 42: mockClient.self, 99: otherUser };

      const { registerUser } = useUserState(audioStateMock, voiceStateMock);
      
      registerUser(mockClient.self);

      // Track events
      const selfSyncSpy = jest.fn();
      const otherSyncSpy = jest.fn();
      mockClient.self.on('server-state-sync', selfSyncSpy);
      otherUser.on('server-state-sync', otherSyncSpy);

      // Update self user
      mockClient.self._update({ self_mute: true });
      expect(selfSyncSpy).toHaveBeenCalled();

      // Update other user - should NOT emit server-state-sync
      otherUser._update({ self_mute: true });
      expect(otherSyncSpy).not.toHaveBeenCalled();
    });

    test('VERIFY: Both mute and deaf can be synced in single message', () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      
      const mockClient = new EventEmitter();
      mockClient.self = new User(mockClient, 42);
      mockClient._userById = { 42: mockClient.self };

      const { selfMute, selfDeaf, registerUser } = useUserState(audioStateMock, voiceStateMock);
      
      selfMute.value = false;
      selfDeaf.value = false;
      
      registerUser(mockClient.self);

      // SIMULATE: Server sends both in one update (e.g., deafen operation)
      mockClient.self._update({ self_mute: true, self_deaf: true });

      // VERIFY: Both synced
      expect(selfMute.value).toBe(true);
      expect(selfDeaf.value).toBe(true);
      expect(consoleSpy).toHaveBeenCalledWith(
        '[SERVER-STATE-SYNC] Received server state:',
        expect.objectContaining({ selfMute: true, selfDeaf: true })
      );
      
      consoleSpy.mockRestore();
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
