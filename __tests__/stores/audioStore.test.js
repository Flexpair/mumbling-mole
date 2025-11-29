/**
 * Jest Unit Tests for audioStore
 * 
 * Tests the Pinia store that manages:
 * - AudioContext lifecycle
 * - Audio lock state
 * - Microphone permissions
 * - Beeper (440 Hz tone) state
 */

import { jest } from '@jest/globals';

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
  watch: jest.fn(() => () => {}),
  computed: (fn) => ({ value: typeof fn === 'function' ? fn() : fn.get() }),
  markRaw: (o) => o,
  nextTick: async () => {},
  effectScope: () => ({ active: true, run: fn => fn(), stop: () => {} }),
  getCurrentScope: () => null
}));

// Mock Pinia
jest.unstable_mockModule('pinia', () => ({
  defineStore: (id, setup) => {
    return () => {
      const result = setup();
      return result;
    };
  },
  createPinia: () => ({})
}));

// Mock audio-context-manager
const mockAudioContextManager = {
  audioContext: null,
  onReady: jest.fn(),
  onSuspend: jest.fn(),
  onResume: jest.fn()
};

jest.unstable_mockModule('../../app/audio/audio-context-manager.js', () => ({
  default: mockAudioContextManager,
  ensureAudioContext: jest.fn().mockResolvedValue({
    state: 'running',
    resume: jest.fn().mockResolvedValue(undefined),
    audioWorklet: { addModule: jest.fn().mockResolvedValue(undefined) }
  })
}));

// Mock voice module
jest.unstable_mockModule('../../app/audio/voice.js', () => ({
  getCurrentMixer: jest.fn(() => null)
}));

// Mock debug utils
jest.unstable_mockModule('../../app/utils/debug-utils.js', () => ({
  debugLog: jest.fn()
}));

// Mock promise-cache-utils
jest.unstable_mockModule('../../app/utils/promise-cache-utils.js', () => ({
  createCachedInitWithCheck: (check, init) => async () => {
    const existing = check();
    if (existing) return existing;
    return init();
  }
}));

// Mock microphone-permission
jest.unstable_mockModule('../../app/utils/microphone-permission.js', () => ({
  createMicrophonePermissionManager: jest.fn(() => ({
    attemptPermission: jest.fn(),
    retryPermission: jest.fn()
  }))
}));

const { useAudioStore } = await import('../../app/stores/audioStore.js');

describe('audioStore', () => {
  let store;

  beforeEach(() => {
    jest.clearAllMocks();
    store = useAudioStore();
  });

  describe('Initial State', () => {
    test('should initialize with null audioContext', () => {
      expect(store.audioContext.value).toBeNull();
    });

    test('should initialize with audio lock inactive', () => {
      expect(store.audioLockActive.value).toBe(false);
      expect(store.audioLockReason.value).toBeNull();
      expect(store.audioLockDetails.value).toBeNull();
    });

    test('should initialize with mic permission not denied', () => {
      expect(store.micPermissionDenied.value).toBe(false);
      expect(store.micPermissionErrorMessage.value).toBe('');
    });

    test('should initialize with beeper not ready', () => {
      expect(store.isBeeping.value).toBe(false);
      expect(store.beeperReady.value).toBe(false);
    });
  });

  describe('Audio Lock Management', () => {
    test('should activate audio lock with reason and details', () => {
      store.activateAudioLock('sample-rate', { sampleRate: 44100 });

      expect(store.audioLockActive.value).toBe(true);
      expect(store.audioLockReason.value).toBe('sample-rate');
      expect(store.audioLockDetails.value).toEqual({ sampleRate: 44100 });
    });

    test('should activate audio lock with default empty details', () => {
      store.activateAudioLock('test-reason');

      expect(store.audioLockActive.value).toBe(true);
      expect(store.audioLockReason.value).toBe('test-reason');
      expect(store.audioLockDetails.value).toEqual({});
    });

    test('should clear audio lock', () => {
      store.activateAudioLock('sample-rate', { sampleRate: 44100 });
      store.clearAudioLock();

      expect(store.audioLockActive.value).toBe(false);
      expect(store.audioLockReason.value).toBeNull();
      expect(store.audioLockDetails.value).toBeNull();
    });

    test('should clear audio lock with resetStates option', () => {
      store.activateAudioLock('sample-rate', { sampleRate: 44100 });
      store.clearAudioLock({ resetStates: true });

      expect(store.audioLockActive.value).toBe(false);
    });
  });

  describe('getAudioContext', () => {
    test('should return null when not initialized', () => {
      expect(store.getAudioContext()).toBeNull();
    });

    test('should return audioContext when set', () => {
      const mockContext = { state: 'running' };
      store.audioContext.value = mockContext;

      expect(store.getAudioContext()).toBe(mockContext);
    });
  });

  describe('resumeAudioContext', () => {
    test('should resume suspended context', async () => {
      const mockResume = jest.fn().mockResolvedValue(undefined);
      store.audioContext.value = { state: 'suspended', resume: mockResume };

      await store.resumeAudioContext();

      expect(mockResume).toHaveBeenCalled();
    });

    test('should not call resume on running context', async () => {
      const mockResume = jest.fn();
      store.audioContext.value = { state: 'running', resume: mockResume };

      await store.resumeAudioContext();

      expect(mockResume).not.toHaveBeenCalled();
    });
  });

  describe('loadAudioWorkletModule', () => {
    test('should throw error when audioContext not initialized', async () => {
      store.audioContext.value = null;

      await expect(store.loadAudioWorkletModule('test.js'))
        .rejects.toThrow('AudioContext not initialized');
    });

    test('should load module via audioWorklet.addModule', async () => {
      const mockAddModule = jest.fn().mockResolvedValue(undefined);
      store.audioContext.value = { 
        audioWorklet: { addModule: mockAddModule } 
      };

      await store.loadAudioWorkletModule('recorder-worker.js');

      expect(mockAddModule).toHaveBeenCalledWith('recorder-worker.js');
    });

    test('should not reload already loaded module', async () => {
      const mockAddModule = jest.fn().mockResolvedValue(undefined);
      store.audioContext.value = { 
        audioWorklet: { addModule: mockAddModule } 
      };

      await store.loadAudioWorkletModule('test.js');
      await store.loadAudioWorkletModule('test.js');

      expect(mockAddModule).toHaveBeenCalledTimes(1);
    });

    test('should handle InvalidStateError (already loaded by another call)', async () => {
      const error = new Error('Already registered');
      error.name = 'InvalidStateError';
      const mockAddModule = jest.fn().mockRejectedValue(error);
      store.audioContext.value = { 
        audioWorklet: { addModule: mockAddModule } 
      };

      // Should not throw
      await expect(store.loadAudioWorkletModule('test.js')).resolves.not.toThrow();
    });

    test('should rethrow non-InvalidStateError errors', async () => {
      const error = new Error('Network error');
      const mockAddModule = jest.fn().mockRejectedValue(error);
      store.audioContext.value = { 
        audioWorklet: { addModule: mockAddModule } 
      };

      await expect(store.loadAudioWorkletModule('test.js'))
        .rejects.toThrow('Network error');
    });
  });

  describe('Beeper State', () => {
    test('should track isBeeping state', () => {
      expect(store.isBeeping.value).toBe(false);
      store.isBeeping.value = true;
      expect(store.isBeeping.value).toBe(true);
    });

    test('should track beeperReady state', () => {
      expect(store.beeperReady.value).toBe(false);
      store.beeperReady.value = true;
      expect(store.beeperReady.value).toBe(true);
    });
  });

  describe('notifyAudioLock', () => {
    test('should set mic permission denied when reason is mic_permission', () => {
      store.activateAudioLock('mic_permission', 'Microphone access denied');
      store.notifyAudioLock();

      expect(store.micPermissionDenied.value).toBe(true);
      expect(store.micPermissionErrorMessage.value).toBe('Microphone access denied');
    });

    test('should not change state when lock is inactive', () => {
      store.notifyAudioLock();

      expect(store.micPermissionDenied.value).toBe(false);
    });
  });
});
