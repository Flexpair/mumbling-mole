/**
 * Jest Unit Tests for voiceStore
 * 
 * Tests the Pinia store that manages:
 * - Voice handler lifecycle
 * - Loopback mode
 * - Voice data transmission
 * - Frequency analysis for loopback
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

// Mock audioStore
const mockAudioStore = {
  activateAudioLock: jest.fn(),
  resetBeeper: jest.fn(),
  resumeAudioContext: jest.fn().mockResolvedValue(undefined),
  loadAudioWorkletModule: jest.fn().mockResolvedValue(undefined),
  initializePersistentBeeper: jest.fn()
};

jest.unstable_mockModule('../../app/stores/audioStore.js', () => ({
  useAudioStore: () => mockAudioStore
}));

// Mock connectionStore
const mockConnectionStore = {
  getClient: jest.fn(() => null)
};

jest.unstable_mockModule('../../app/stores/connectionStore.js', () => ({
  useConnectionStore: () => mockConnectionStore
}));

// Mock settingsStore
const mockSettingsStore = {
  voiceMode: 'cont'
};

jest.unstable_mockModule('../../app/stores/settingsStore.js', () => ({
  useSettingsStore: () => mockSettingsStore
}));

// Mock voice module
const mockVoiceHandler = {
  end: jest.fn(),
  setMute: jest.fn(),
  write: jest.fn(),
  on: jest.fn()
};
const mockStopVoiceInput = jest.fn();

jest.unstable_mockModule('../../app/audio/voice.js', () => ({
  ContinuousVoiceHandler: jest.fn(() => mockVoiceHandler),
  PushToTalkVoiceHandler: jest.fn(() => mockVoiceHandler),
  initVoice: jest.fn((_onData, _onError, onReady) => {
    onReady?.({});
    return mockStopVoiceInput;
  })
}));

// Mock localize
jest.unstable_mockModule('../../app/localize.js', () => ({
  translate: jest.fn((key) => key)
}));

// Mock debug utils
jest.unstable_mockModule('../../app/utils/debug-utils.js', () => ({
  debugLog: jest.fn()
}));

const { useVoiceStore } = await import('../../app/stores/voiceStore.js');
const { ContinuousVoiceHandler, PushToTalkVoiceHandler, initVoice } =
  await import('../../app/audio/voice.js');

describe('voiceStore', () => {
  let store;

  beforeEach(() => {
    jest.clearAllMocks();
    mockVoiceHandler.end.mockClear();
    mockVoiceHandler.setMute.mockClear();
    mockVoiceHandler.write.mockClear();
    mockVoiceHandler.on.mockClear();
    mockStopVoiceInput.mockClear();
    initVoice.mockImplementation((_onData, _onError, onReady) => {
      onReady?.({});
      return mockStopVoiceInput;
    });
    store = useVoiceStore();
  });

  describe('Initial State', () => {
    test('should initialize with null voice handler', () => {
      expect(store.voiceHandler.value).toBeNull();
    });

    test('should initialize with loopback mode off', () => {
      expect(store.isLoopbackMode.value).toBe(false);
    });

    test('should initialize with voice handler not ready', () => {
      expect(store.voiceHandlerReady.value).toBe(false);
    });

    test('should initialize loopback frequency to 0', () => {
      expect(store.loopbackDominantFrequency.value).toBe(0);
    });
  });

  describe('initVoiceInput', () => {
    test('should call initVoice with callbacks', () => {
      const onData = jest.fn();
      const onError = jest.fn();

      store.initVoiceInput(onData, onError);

      expect(initVoice).toHaveBeenCalledWith(
        onData,
        expect.any(Function),
        expect.any(Function)
      );
    });

    test('should invoke mixer ready callback when capture is ready', () => {
      const onData = jest.fn();
      const onError = jest.fn();
      const onMixerReady = jest.fn();

      store.initVoiceInput(onData, onError, onMixerReady);

      expect(onMixerReady).toHaveBeenCalled();
    });
  });

  describe('updateVoiceHandler', () => {
    test('should not create handler when client is null', () => {
      store.updateVoiceHandler(null, jest.fn(), jest.fn());

      expect(ContinuousVoiceHandler).not.toHaveBeenCalled();
      expect(store.voiceHandler.value).toBeNull();
    });

    test('should create ContinuousVoiceHandler for cont mode', () => {
      mockSettingsStore.voiceMode = 'cont';
      const mockClient = { id: 1 };

      store.updateVoiceHandler(mockClient, jest.fn(), jest.fn());

      expect(ContinuousVoiceHandler).toHaveBeenCalledWith(
        mockClient, 
        mockSettingsStore, 
        0 // target=0 for normal mode
      );
    });

    test('should create PushToTalkVoiceHandler for ptt mode', () => {
      mockSettingsStore.voiceMode = 'ptt';
      const mockClient = { id: 1 };

      store.updateVoiceHandler(mockClient, jest.fn(), jest.fn());

      expect(PushToTalkVoiceHandler).toHaveBeenCalledWith(
        mockClient, 
        mockSettingsStore, 
        0
      );
    });

    test('should use target=31 in loopback mode', () => {
      mockSettingsStore.voiceMode = 'cont';
      store.isLoopbackMode.value = true;
      const mockClient = { id: 1 };

      store.updateVoiceHandler(mockClient, jest.fn(), jest.fn());

      expect(ContinuousVoiceHandler).toHaveBeenCalledWith(
        mockClient, 
        mockSettingsStore, 
        31 // target=31 for loopback
      );
    });

    test('should cleanup existing handler before creating new one', () => {
      const oldHandler = { end: jest.fn() };
      store.voiceHandler.value = oldHandler;
      const mockClient = { id: 1 };

      store.updateVoiceHandler(mockClient, jest.fn(), jest.fn());

      expect(oldHandler.end).toHaveBeenCalled();
    });

    test('should connect started_talking event', () => {
      const onStarted = jest.fn();
      const mockClient = { id: 1 };

      store.updateVoiceHandler(mockClient, onStarted, jest.fn());

      expect(mockVoiceHandler.on).toHaveBeenCalledWith('started_talking', onStarted);
    });

    test('should connect stopped_talking event', () => {
      const onStopped = jest.fn();
      const mockClient = { id: 1 };

      store.updateVoiceHandler(mockClient, jest.fn(), onStopped);

      expect(mockVoiceHandler.on).toHaveBeenCalledWith('stopped_talking', onStopped);
    });

    test('should set voiceHandlerReady to true after creation', () => {
      const mockClient = { id: 1 };

      store.updateVoiceHandler(mockClient, jest.fn(), jest.fn());

      expect(store.voiceHandlerReady.value).toBe(true);
    });

    test('should handle cleanup error gracefully', () => {
      const errorHandler = { end: jest.fn(() => { throw new Error('Cleanup failed'); }) };
      store.voiceHandler.value = errorHandler;
      const mockClient = { id: 1 };
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      expect(() => store.updateVoiceHandler(mockClient, jest.fn(), jest.fn())).not.toThrow();
      expect(consoleSpy).toHaveBeenCalled();
      
      consoleSpy.mockRestore();
    });
  });

  describe('updateLoopbackFrequency', () => {
    test('should update frequency when in loopback mode', () => {
      store.isLoopbackMode.value = true;

      store.updateLoopbackFrequency(440.123);

      expect(store.loopbackDominantFrequency.value).toBe(440.1);
    });

    test('should round to one decimal place', () => {
      store.isLoopbackMode.value = true;

      store.updateLoopbackFrequency(439.999);

      expect(store.loopbackDominantFrequency.value).toBe(440);
    });

    test('should not update when not in loopback mode', () => {
      store.isLoopbackMode.value = false;
      store.loopbackDominantFrequency.value = 0;

      store.updateLoopbackFrequency(440);

      expect(store.loopbackDominantFrequency.value).toBe(0);
    });
  });

  describe('setMute', () => {
    test('should call setMute on voice handler', () => {
      store.voiceHandler.value = mockVoiceHandler;

      store.setMute(true);

      expect(mockVoiceHandler.setMute).toHaveBeenCalledWith(true);
    });

    test('should not throw when voice handler is null', () => {
      store.voiceHandler.value = null;

      expect(() => store.setMute(true)).not.toThrow();
    });
  });

  describe('writeVoiceData', () => {
    test('should write data to voice handler', () => {
      store.voiceHandler.value = mockVoiceHandler;
      const data = new ArrayBuffer(100);

      store.writeVoiceData(data);

      expect(mockVoiceHandler.write).toHaveBeenCalledWith(data);
    });

    test('should not throw when voice handler is null', () => {
      store.voiceHandler.value = null;

      expect(() => store.writeVoiceData(new ArrayBuffer(10))).not.toThrow();
    });
  });

  describe('getVoiceHandler', () => {
    test('should return current voice handler', () => {
      store.voiceHandler.value = mockVoiceHandler;

      expect(store.getVoiceHandler()).toBe(mockVoiceHandler);
    });

    test('should return null when no handler', () => {
      store.voiceHandler.value = null;

      expect(store.getVoiceHandler()).toBeNull();
    });
  });

  describe('endVoiceHandler', () => {
    test('should end and clear voice handler', () => {
      store.voiceHandler.value = mockVoiceHandler;

      store.endVoiceHandler();

      expect(mockVoiceHandler.end).toHaveBeenCalled();
      expect(store.voiceHandler.value).toBeNull();
    });

    test('should set voiceHandlerReady to false', () => {
      store.voiceHandler.value = mockVoiceHandler;
      store.voiceHandlerReady.value = true;

      store.endVoiceHandler();

      expect(store.voiceHandlerReady.value).toBe(false);
    });

    test('should handle null handler gracefully', () => {
      store.voiceHandler.value = null;

      expect(() => store.endVoiceHandler()).not.toThrow();
    });
  });

  describe('reset', () => {
    test('should end voice handler', () => {
      store.voiceHandler.value = mockVoiceHandler;

      store.reset();

      expect(mockVoiceHandler.end).toHaveBeenCalled();
      expect(store.voiceHandler.value).toBeNull();
    });

    test('should reset loopback mode to false', () => {
      store.isLoopbackMode.value = true;

      store.reset();

      expect(store.isLoopbackMode.value).toBe(false);
    });

    test('should reset voiceHandlerReady to false', () => {
      store.voiceHandlerReady.value = true;

      store.reset();

      expect(store.voiceHandlerReady.value).toBe(false);
    });

    test('should stop active microphone capture', async () => {
      await store.setupVoiceForConnection(true, 48000);

      store.reset();

      expect(mockStopVoiceInput).toHaveBeenCalledTimes(1);
    });
  });

  describe('stopVoiceCapture', () => {
    test('should stop the active capture without ending the Mumble handler', async () => {
      store.voiceHandler.value = mockVoiceHandler;
      await store.setupVoiceForConnection(true, 48000);

      store.stopVoiceCapture();

      expect(mockStopVoiceInput).toHaveBeenCalledTimes(1);
      expect(mockVoiceHandler.end).not.toHaveBeenCalled();
    });
  });

  describe('setupVoiceForConnection', () => {
    test('should call initVoiceInput when audio enabled', async () => {
      await store.setupVoiceForConnection(true, 48000);

      expect(initVoice).toHaveBeenCalled();
    });

    test('should reject when microphone capture fails to initialize', async () => {
      const captureError = new Error('Permission denied');
      initVoice.mockImplementationOnce((_onData, onError) => {
        onError(captureError);
        return mockStopVoiceInput;
      });

      await expect(store.setupVoiceForConnection(true, 48000)).rejects.toBe(captureError);
    });

    test('should not block voice readiness when optional beeper setup rejects', async () => {
      const beeperError = new Error('Beeper setup failed');
      mockAudioStore.initializePersistentBeeper.mockRejectedValueOnce(beeperError);

      await expect(store.setupVoiceForConnection(true, 48000)).resolves.toEqual(expect.any(Function));
      await Promise.resolve();
    });

    test('should activate audio lock when audio disabled', async () => {
      await store.setupVoiceForConnection(false, 44100);

      expect(mockAudioStore.activateAudioLock).toHaveBeenCalledWith('sample-rate', { sampleRate: 44100 });
    });

    test('should resume audio context', async () => {
      await store.setupVoiceForConnection(true, 48000);

      expect(mockAudioStore.resumeAudioContext).toHaveBeenCalled();
    });

    test('should pre-warm playback AudioWorklet', async () => {
      await store.setupVoiceForConnection(true, 48000);

      expect(mockAudioStore.loadAudioWorkletModule).toHaveBeenCalledWith('playback-buffer-processor.js');
    });

    test('should not let an older setup cleanup stop newer capture', async () => {
      let finishFirstResume;
      const firstResume = new Promise(resolve => { finishFirstResume = resolve; });
      const stopFirst = jest.fn();
      const stopSecond = jest.fn();
      initVoice
        .mockImplementationOnce((_onData, _onError, onReady) => {
          onReady({});
          return stopFirst;
        })
        .mockImplementationOnce((_onData, _onError, onReady) => {
          onReady({});
          return stopSecond;
        });
      mockAudioStore.resumeAudioContext
        .mockReturnValueOnce(firstResume)
        .mockResolvedValueOnce(undefined);

      const firstSetup = store.setupVoiceForConnection(true, 48000);
      await Promise.resolve();
      const secondCleanup = await store.setupVoiceForConnection(true, 48000);
      finishFirstResume();
      const firstCleanup = await firstSetup;

      firstCleanup();
      expect(stopSecond).not.toHaveBeenCalled();

      secondCleanup();
      expect(stopSecond).toHaveBeenCalledTimes(1);
    });

    test('should handle AudioContext resume failure gracefully', async () => {
      mockAudioStore.resumeAudioContext.mockRejectedValueOnce(new Error('Resume failed'));
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();

      await expect(store.setupVoiceForConnection(true, 48000)).resolves.not.toThrow();
      
      consoleSpy.mockRestore();
    });
  });
});
