/**
 * Basic smoke test for Vue composables
 * Ensures composables can be imported and instantiated
 */

import { describe, it, expect, beforeEach } from '@jest/globals';

describe('Vue Composables', () => {
  // Mock Worker for ConnectionState tests
  beforeEach(() => {
    global.Worker = class Worker {
      constructor(url, options) {
        this.url = url;
        this.options = options;
        this.onmessage = null;
        this.onerror = null;
        this._listeners = new Map();
      }
      postMessage() {}
      terminate() {}
      addEventListener(event, callback) {
        if (!this._listeners.has(event)) {
          this._listeners.set(event, []);
        }
        this._listeners.get(event).push(callback);
      }
      removeEventListener(event, callback) {
        if (this._listeners.has(event)) {
          const callbacks = this._listeners.get(event);
          if (callbacks.includes(callback)) {
            callbacks.splice(callbacks.indexOf(callback), 1);
          }
        }
      }
    };
  });
  
  describe('useConnectionState', () => {
    it('can be imported and instantiated', async () => {
      const { useConnectionState } = await import('../../app/composables/useConnectionState.js');
      const state = useConnectionState();
      
      expect(state).toBeDefined();
      expect(state.remoteHost).toBeDefined();
      expect(state.remotePort).toBeDefined();
      expect(state.connect).toBeInstanceOf(Function);
      expect(state.disconnect).toBeInstanceOf(Function);
    });
  });

  describe('useAudioState', () => {
    it('can be imported and instantiated', async () => {
      const { useAudioState } = await import('../../app/composables/useAudioState.js');
      const state = useAudioState();
      
      expect(state).toBeDefined();
      expect(state.audioLockActive).toBeDefined();
      expect(state.isBeeping).toBeDefined();
      expect(state.beeperReady).toBeDefined();
      expect(state.initializeAudioContext).toBeInstanceOf(Function);
      expect(state.startBeep).toBeInstanceOf(Function);
    });
  });

  describe('useVoiceState', () => {
    it('can be imported and instantiated', async () => {
      const { useVoiceState } = await import('../../app/composables/useVoiceState.js');
      const state = useVoiceState();
      
      expect(state).toBeDefined();
      expect(state.isLoopbackMode).toBeDefined();
      expect(state.voiceHandlerReady).toBeDefined();
      expect(state.initVoiceInput).toBeInstanceOf(Function);
      expect(state.updateVoiceHandler).toBeInstanceOf(Function);
    });
  });

  describe('useUIState', () => {
    it('can be imported and instantiated', async () => {
      const { useUIState } = await import('../../app/composables/useUIState.js');
      const state = useUIState();
      
      expect(state).toBeDefined();
      expect(state.currentOpenModal).toBeDefined();
      expect(state.messageBox).toBeDefined();
      expect(state.openSettings).toBeInstanceOf(Function);
      expect(state.closeSettings).toBeInstanceOf(Function);
    });
  });

  describe('useUserState', () => {
    it('can be imported and instantiated', async () => {
      const { useUserState } = await import('../../app/composables/useUserState.js');
      
      // Mock dependencies
      const mockAudioState = {
        getAudioContext: () => null,
      };
      const mockVoiceState = {
        isLoopbackMode: { value: false },
        updateLoopbackFrequency: () => {},
        loopbackDominantFrequency: { value: 0 },
      };
      
      const state = useUserState(mockAudioState, mockVoiceState);
      
      expect(state).toBeDefined();
      expect(state.thisUser).toBeDefined();
      expect(state.selfMute).toBeDefined();
      expect(state.selfDeaf).toBeDefined();
      expect(state.registerUser).toBeInstanceOf(Function);
    });
  });

  describe('Composables index', () => {
    it('exports all composables', async () => {
      const composables = await import('../../app/composables/index.js');
      
      expect(composables.useConnectionState).toBeDefined();
      expect(composables.useAudioState).toBeDefined();
      expect(composables.useVoiceState).toBeDefined();
      expect(composables.useUIState).toBeDefined();
      expect(composables.useUserState).toBeDefined();
    });
  });
});
