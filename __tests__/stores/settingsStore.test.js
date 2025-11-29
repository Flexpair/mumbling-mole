/**
 * Jest Unit Tests for settingsStore
 * 
 * Tests the Pinia store that manages:
 * - Voice mode (continuous/PTT)
 * - PTT key binding
 * - Audio settings (bitrate, packet size, jitter buffer)
 * - User preferences (channel name display)
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
  computed: (getterOrOptions) => {
    if (typeof getterOrOptions === 'function') {
      return { value: getterOrOptions() };
    }
    // Handle writable computed
    return {
      get value() { return getterOrOptions.get(); },
      set value(v) { getterOrOptions.set(v); }
    };
  },
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

// Mock useLocalStorage to return simple refs
jest.unstable_mockModule('../../app/composables/useLocalStorage.js', () => ({
  useLocalStorage: (key, defaultValue) => ({
    _val: defaultValue,
    get value() { return this._val; },
    set value(v) { this._val = v; },
    __v_isRef: true
  })
}));

// Mock MumbleClient for bandwidth calculation
jest.unstable_mockModule('../../app/mumble-client/index.js', () => ({
  default: {
    calcEnforcableBandwidth: jest.fn((bitrate, samples, vad) => {
      // Simplified bandwidth calculation for testing
      const overhead = Math.ceil(1000 / (samples / 48)) * 28 * 8;
      return bitrate + overhead;
    })
  }
}));

const { useSettingsStore } = await import('../../app/stores/settingsStore.js');

describe('settingsStore', () => {
  let store;
  let consoleWarnSpy;

  beforeEach(() => {
    jest.clearAllMocks();
    consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();
    store = useSettingsStore();
  });

  afterEach(() => {
    consoleWarnSpy.mockRestore();
  });

  describe('Initial State', () => {
    test('should initialize voiceMode to cont', () => {
      expect(store.voiceMode.value).toBe('cont');
    });

    test('should initialize pttKey with default binding', () => {
      expect(store.pttKey.value).toBe('ctrl + shift');
    });

    test('should initialize userCountInChannelName to false', () => {
      expect(store.userCountInChannelName.value).toBe(false);
    });

    test('should initialize audioBitrate to 40000', () => {
      expect(store.audioBitrate.value).toBe(40000);
    });

    test('should initialize samplesPerPacket to 960', () => {
      expect(store.samplesPerPacket.value).toBe(960);
    });

    test('should initialize jitterBufferSize to 3', () => {
      expect(store.jitterBufferSize.value).toBe(3);
    });

    test('should initialize jitterBufferMode to balanced', () => {
      expect(store.jitterBufferMode.value).toBe('balanced');
    });

    test('should initialize pttKeyDisplay with pttKey value', () => {
      expect(store.pttKeyDisplay.value).toBe('ctrl + shift');
    });
  });

  describe('Voice Mode', () => {
    test('should allow changing voice mode', () => {
      store.voiceMode.value = 'ptt';
      expect(store.voiceMode.value).toBe('ptt');
    });
  });

  describe('PTT Key', () => {
    test('should allow changing PTT key', () => {
      store.pttKey.value = 'space';
      expect(store.pttKey.value).toBe('space');
    });
  });

  describe('Audio Settings', () => {
    test('should allow changing audio bitrate', () => {
      store.audioBitrate.value = 72000;
      expect(store.audioBitrate.value).toBe(72000);
    });

    test('should allow changing samples per packet', () => {
      store.samplesPerPacket.value = 480;
      expect(store.samplesPerPacket.value).toBe(480);
    });

    test('should allow changing jitter buffer size', () => {
      store.jitterBufferSize.value = 5;
      expect(store.jitterBufferSize.value).toBe(5);
    });

    test('should allow changing jitter buffer mode', () => {
      store.jitterBufferMode.value = 'low-latency';
      expect(store.jitterBufferMode.value).toBe('low-latency');
    });
  });

  describe('Computed: msPerPacket', () => {
    test('should calculate ms per packet from samples', () => {
      store.samplesPerPacket.value = 960;
      expect(store.msPerPacket.value).toBe(20); // 960 / 48 = 20ms
    });

    test('should calculate for different sample sizes', () => {
      store.samplesPerPacket.value = 480;
      expect(store.msPerPacket.value).toBe(10); // 480 / 48 = 10ms
    });
  });

  describe('recordPttKey', () => {
    test('should update pttKeyDisplay during recording', () => {
      let keydownHandler;
      const mockKeyboardjs = {
        bind: jest.fn((pattern, keydown, keyup) => {
          keydownHandler = keydown;
        }),
        unbind: jest.fn()
      };

      store.recordPttKey(mockKeyboardjs);
      
      // Now simulate keydown after placeholder is set
      keydownHandler({ pressedKeys: ['ctrl', 'alt'] });

      expect(store.pttKeyDisplay.value).toBe('> ctrl + alt <');
    });

    test('should set placeholder when recording starts', () => {
      const mockKeyboardjs = {
        bind: jest.fn(),
        unbind: jest.fn()
      };

      store.recordPttKey(mockKeyboardjs);

      expect(store.pttKeyDisplay.value).toBe('> ? <');
    });

    test('should save key combo on keyup', () => {
      let keyupHandler;
      const mockKeyboardjs = {
        bind: jest.fn((pattern, keydown, keyup) => {
          keydown({ pressedKeys: ['shift', 'a'] });
          keyupHandler = keyup;
        }),
        unbind: jest.fn()
      };

      store.recordPttKey(mockKeyboardjs);
      keyupHandler();

      expect(store.pttKey.value).toBe('shift + a');
      expect(store.pttKeyDisplay.value).toBe('shift + a');
    });

    test('should unbind on keyup', () => {
      let keyupHandler;
      const mockKeyboardjs = {
        bind: jest.fn((pattern, keydown, keyup) => {
          keydown({ pressedKeys: ['space'] });
          keyupHandler = keyup;
        }),
        unbind: jest.fn()
      };

      store.recordPttKey(mockKeyboardjs);
      keyupHandler();

      expect(mockKeyboardjs.unbind).toHaveBeenCalledWith('', expect.any(Function), expect.any(Function));
    });

    test('should restore previous value if no keys pressed', () => {
      let keyupHandler;
      const mockKeyboardjs = {
        bind: jest.fn((pattern, keydown, keyup) => {
          keyupHandler = keyup;
        }),
        unbind: jest.fn()
      };

      store.pttKey.value = 'original';
      store.pttKeyDisplay.value = 'original';
      store.recordPttKey(mockKeyboardjs);
      keyupHandler(); // No keydown called, so combo is empty

      expect(store.pttKeyDisplay.value).toBe('original');
    });
  });

  describe('initWithDefaults', () => {
    test('should apply audio bitrate default', () => {
      store.initWithDefaults({ audioBitrate: 96000 });
      expect(store.audioBitrate.value).toBe(96000);
    });

    test('should apply samples per packet default', () => {
      store.initWithDefaults({ samplesPerPacket: 480 });
      expect(store.samplesPerPacket.value).toBe(480);
    });

    test('should apply jitter buffer size default', () => {
      store.initWithDefaults({ jitterBufferSize: 5 });
      expect(store.jitterBufferSize.value).toBe(5);
    });

    test('should apply jitter buffer mode default', () => {
      store.initWithDefaults({ jitterBufferMode: 'low-latency' });
      expect(store.jitterBufferMode.value).toBe('low-latency');
    });

    test('should apply user count in channel name default', () => {
      store.initWithDefaults({ userCountInChannelName: true });
      expect(store.userCountInChannelName.value).toBe(true);
    });

    test('should apply PTT key default', () => {
      store.initWithDefaults({ pttKey: 'space' });
      expect(store.pttKey.value).toBe('space');
    });

    test('should handle empty defaults object', () => {
      const originalBitrate = store.audioBitrate.value;
      store.initWithDefaults({});
      expect(store.audioBitrate.value).toBe(originalBitrate);
    });
  });
});
