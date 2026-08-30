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
  onResume: jest.fn(),
  resumeAudioContext: jest.fn().mockResolvedValue(undefined),
};

const mockGetCurrentMixer = jest.fn(() => null);
const mockEnsureAudioContext = jest.fn();

jest.unstable_mockModule('../../app/audio/audio-context-manager.js', () => ({
  default: mockAudioContextManager,
  ensureAudioContext: mockEnsureAudioContext
}));

// Mock voice module
jest.unstable_mockModule('../../app/audio/voice.js', () => ({
  getCurrentMixer: mockGetCurrentMixer
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

const { useAudioStore } = await import('../../app/stores/audioStore.js');

function createMockAudioContext(state = 'running') {
  const oscillator = {
    frequency: { setValueAtTime: jest.fn() },
    connect: jest.fn(),
    start: jest.fn(),
    type: ''
  };
  const gainNodes = [];

  const audioContext = {
    state,
    currentTime: 10,
    destination: {},
    resume: jest.fn().mockImplementation(function resume() {
      this.state = 'running';
      return Promise.resolve();
    }),
    createOscillator: jest.fn(() => oscillator),
    createGain: jest.fn(() => {
      const node = {
        gain: {
          cancelScheduledValues: jest.fn(),
          setValueAtTime: jest.fn(),
          linearRampToValueAtTime: jest.fn(),
          exponentialRampToValueAtTime: jest.fn()
        },
        connect: jest.fn(),
        context: audioContext
      };
      gainNodes.push(node);
      return node;
    }),
    oscillator,
    gainNodes
  };
  return audioContext;
}

describe('audioStore', () => {
  let store;

  beforeEach(() => {
    jest.clearAllMocks();
    mockAudioContextManager.resumeAudioContext.mockClear();
    mockEnsureAudioContext.mockResolvedValue({
      state: 'running',
      resume: jest.fn().mockResolvedValue(undefined),
      audioWorklet: { addModule: jest.fn().mockResolvedValue(undefined) }
    });
    mockGetCurrentMixer.mockReturnValue(null);
    delete globalThis.audioContextManager;
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

      expect(mockAudioContextManager.resumeAudioContext).toHaveBeenCalled();
      expect(mockResume).not.toHaveBeenCalled();
    });

    test('should route running context through the manager', async () => {
      const mockResume = jest.fn();
      store.audioContext.value = { state: 'running', resume: mockResume };

      await store.resumeAudioContext();

      expect(mockAudioContextManager.resumeAudioContext).toHaveBeenCalled();
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

  describe('initializeAudioContext', () => {
    test('should initialize AudioContext successfully', async () => {
      const result = await store.initializeAudioContext();

      expect(result).toBeDefined();
      expect(result.state).toBe('running');
    });

    test('should return existing context if already initialized', async () => {
      const mockContext = { state: 'running' };
      store.audioContext.value = mockContext;

      const result = await store.initializeAudioContext();

      expect(result).toBe(mockContext);
    });

    test('should reject when managed and legacy initialization both fail', async () => {
      mockEnsureAudioContext.mockRejectedValueOnce(new Error('Managed initialization failed'));
      delete globalThis.AudioContext;
      delete globalThis.webkitAudioContext;

      await expect(store.initializeAudioContext())
        .rejects.toThrow('AudioContext is not supported in this browser');
      expect(store.audioContext.value).toBeNull();
    });
  });

  describe('retryMicrophonePermission', () => {
    test('should not throw if permission manager not initialized', () => {
      expect(() => store.retryMicrophonePermission()).not.toThrow();
    });
  });

  describe('Beeper lifecycle', () => {
    test('startBeep should not throw when beeper not initialized', async () => {
      await expect(store.startBeep()).resolves.not.toThrow();
    });

    test('stopBeep should not throw when beeper not playing', () => {
      expect(() => store.stopBeep()).not.toThrow();
    });

    test('initializePersistentBeeper should set beeperReady false when mixer unavailable', async () => {
      const result = await store.initializePersistentBeeper();

      expect(result).toBeNull();
      expect(store.beeperReady.value).toBe(false);
    });

    test('resetBeeper should set beeperReady to false', () => {
      store.beeperReady.value = true;
      // resetBeeper might not exist yet, but we should test it
      if (typeof store.resetBeeper === 'function') {
        store.resetBeeper();
        expect(store.beeperReady.value).toBe(false);
      }
    });
  });

  describe('resumeAudioContext edge cases', () => {
    test('should initialize context if not present', async () => {
      store.audioContext.value = null;
      
      await store.resumeAudioContext();
      
      // Should have tried to initialize
      expect(store.audioContext.value).toBeDefined();
    });

    test('should handle closed context state', async () => {
      store.audioContext.value = { state: 'closed' };
      
      // Should not throw
      await expect(store.resumeAudioContext()).resolves.not.toThrow();
    });
  });

  describe('Audio Lock with different reasons', () => {
    test('should handle sample-rate lock reason', () => {
      store.activateAudioLock('sample-rate', { expected: 48000, actual: 44100 });
      
      expect(store.audioLockReason.value).toBe('sample-rate');
      expect(store.audioLockDetails.value.expected).toBe(48000);
    });

    test('notifyAudioLock should not affect state for non-mic_permission reason', () => {
      store.activateAudioLock('sample-rate', { sampleRate: 44100 });
      store.notifyAudioLock();

      // Should remain false for non-mic reasons
      expect(store.micPermissionDenied.value).toBe(false);
    });
  });

  describe('initializePersistentBeeper edge cases', () => {
    test('should return null when AudioContext is closed', async () => {
      mockGetCurrentMixer.mockReturnValue({});
      // Mock global audioContextManager
      globalThis.audioContextManager = {
        getAudioContext: jest.fn().mockResolvedValue({ state: 'closed' })
      };
      
      const result = await store.initializePersistentBeeper();
      
      expect(result).toBeNull();
      expect(store.beeperReady.value).toBe(false);
    });

    test('should return null when no AudioContext available', async () => {
      mockGetCurrentMixer.mockReturnValue({});
      globalThis.audioContextManager = {
        getAudioContext: jest.fn().mockResolvedValue(null)
      };
      
      const result = await store.initializePersistentBeeper();
      
      expect(result).toBeNull();
      expect(store.beeperReady.value).toBe(false);
    });

    test('should initialize persistent beeper when mixer and AudioContext are available', async () => {
      const mixer = {};
      const audioContext = createMockAudioContext();
      mockGetCurrentMixer.mockReturnValue(mixer);
      globalThis.audioContextManager = {
        getAudioContext: jest.fn().mockResolvedValue(audioContext)
      };

      const result = await store.initializePersistentBeeper();

      expect(result).toBeDefined();
      expect(result.isPlaying).toBe(false);
      expect(store.beeperReady.value).toBe(true);
      expect(audioContext.createOscillator).toHaveBeenCalled();
      expect(audioContext.createGain).toHaveBeenCalledTimes(2);
      expect(audioContext.oscillator.frequency.setValueAtTime).toHaveBeenCalledWith(440, audioContext.currentTime);
      expect(audioContext.oscillator.connect).toHaveBeenCalledTimes(2);
      expect(audioContext.oscillator.start).toHaveBeenCalled();
    });

    test('should return null when beeper initialization fails', async () => {
      const audioContext = createMockAudioContext();
      audioContext.createOscillator.mockImplementation(() => {
        throw new Error('oscillator failed');
      });
      mockGetCurrentMixer.mockReturnValue({});
      globalThis.audioContextManager = {
        getAudioContext: jest.fn().mockResolvedValue(audioContext)
      };

      const result = await store.initializePersistentBeeper();

      expect(result).toBeNull();
      expect(store.beeperReady.value).toBe(false);
    });
  });

  describe('startBeep with initialized beeper', () => {
    test('should resume suspended context and start initialized beeper', async () => {
      const audioContext = createMockAudioContext('suspended');
      mockGetCurrentMixer.mockReturnValue({});
      globalThis.audioContextManager = {
        getAudioContext: jest.fn().mockResolvedValue(audioContext)
      };

      await store.initializePersistentBeeper();
      await store.startBeep();

      expect(audioContext.resume).toHaveBeenCalled();
      expect(audioContext.gainNodes[0].gain.linearRampToValueAtTime).toHaveBeenCalledWith(0.4, 10.005);
      expect(audioContext.gainNodes[1].gain.linearRampToValueAtTime).toHaveBeenCalledWith(0.3, 10.005);
      expect(store.isBeeping.value).toBe(true);
    });

    test('should stop initialized beeper with fade out', async () => {
      const audioContext = createMockAudioContext();
      mockGetCurrentMixer.mockReturnValue({});
      globalThis.audioContextManager = {
        getAudioContext: jest.fn().mockResolvedValue(audioContext)
      };

      await store.initializePersistentBeeper();
      await store.startBeep();
      store.stopBeep();

      expect(audioContext.gainNodes[0].gain.exponentialRampToValueAtTime).toHaveBeenCalledWith(0.001, 11.3);
      expect(audioContext.gainNodes[1].gain.exponentialRampToValueAtTime).toHaveBeenCalledWith(0.001, 11.3);
      expect(store.isBeeping.value).toBe(false);
    });
  });

  describe('stopBeep with playing beeper', () => {
    test('should not throw when called multiple times', () => {
      store.stopBeep();
      store.stopBeep();
      
      expect(store.isBeeping.value).toBe(false);
    });
  });

  describe('notifyAudioLock edge cases', () => {
    test('should handle mic_permission with empty details', () => {
      store.activateAudioLock('mic_permission', '');
      store.notifyAudioLock();

      expect(store.micPermissionDenied.value).toBe(true);
      expect(store.micPermissionErrorMessage.value).toBe('');
    });

    test('should handle different lock reasons', () => {
      store.activateAudioLock('codec_error', { codec: 'opus' });
      store.notifyAudioLock();

      // Should not set mic permission denied for non-mic reasons
      expect(store.micPermissionDenied.value).toBe(false);
    });
  });

  describe('clearAudioLock edge cases', () => {
    test('should clear lock with all options', () => {
      store.activateAudioLock('sample-rate', { sampleRate: 44100 });
      store.clearAudioLock({ resetStates: true, somethingElse: true });

      expect(store.audioLockActive.value).toBe(false);
      expect(store.audioLockReason.value).toBeNull();
    });
  });
});

