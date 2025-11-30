import { jest } from '@jest/globals';

// Define Vue mock logic
const watchers = new Map();
const mockRef = (val) => {
    const r = {
      _value: val,
      get value() { return this._value; },
      set value(v) {
        const old = this._value;
        this._value = v;
        if (watchers.has(r)) {
            for (const cb of watchers.get(r)) {
                cb(v, old, () => {});
            }
        }
      },
      __v_isRef: true
    };
    return r;
};

const mockWatch = (source, cb) => {
    if (!watchers.has(source)) {
        watchers.set(source, []);
    }
    watchers.get(source).push(cb);
    return () => {};
};

const mockNextTick = () => Promise.resolve();
const mockMarkRaw = (o) => o;

// Mock Vue module
jest.unstable_mockModule('vue', () => ({
    ref: mockRef,
    watch: mockWatch,
    nextTick: mockNextTick,
    markRaw: mockMarkRaw,
    reactive: (o) => {
      // Simple proxy to handle ref unwrapping for Pinia
      return new Proxy(o, {
        get(target, prop, receiver) {
          const val = target[prop];
          return (val?.__v_isRef) ? val.value : val;
        },
        set(target, prop, value, receiver) {
          const current = target[prop];
          if (current?.__v_isRef) {
            current.value = value;
            return true;
          }
          target[prop] = value;
          return true;
        }
      });
    },
    computed: (fn) => ({ value: fn() }),
    effectScope: () => ({ active: true, run: fn => fn(), stop: () => {} }),
    getCurrentScope: () => null,
    onScopeDispose: () => {},
    toRaw: (o) => o,
    isRef: (r) => r?.__v_isRef === true,
    toRef: (o, k) => ({ get value() { return o[k]; }, set value(v) { o[k] = v; }, __v_isRef: true }),
    toRefs: (o) => {
      const ret = {};
      for (const k in o) ret[k] = { get value() { return o[k]; }, set value(v) { o[k] = v; }, __v_isRef: true };
      return ret;
    },
    inject: () => {},
    provide: () => {},
    getCurrentInstance: () => null,
    hasInjectionContext: () => false,
    isReactive: () => false,
    shallowRef: (v) => ({ value: v, __v_isRef: true }),
    unref: (r) => r?.__v_isRef ? r.value : r,
    triggerRef: () => {},
    customRef: (factory) => {
      const { get, set } = factory(() => {}, () => {});
      return { get value() { return get(); }, set value(v) { set(v); }, __v_isRef: true };
    },
    onWatcherCleanup: () => {},
}));

// Import Vue (mocked)
const { ref, nextTick } = await import('vue');

// Mock dependencies
const mockAudioState = {
  audioContext: { state: 'running' },
  loadAudioWorkletModule: jest.fn().mockResolvedValue(),
  resumeAudioContext: jest.fn().mockResolvedValue()
};

const mockVoiceState = {
  setMute: jest.fn(),
  setDeaf: jest.fn()
};

jest.unstable_mockModule('../../app/stores/audioStore.js', () => ({
  useAudioStore: () => mockAudioState
}));

jest.unstable_mockModule('../../app/stores/voiceStore.js', () => ({
  useVoiceStore: () => mockVoiceState
}));

const mockConnectionState = {
  getClient: jest.fn()
};

// Mock settings as a Pinia store (settingsStore)
const mockSettingsStore = {
  jitterBufferSize: 3,
  jitterBufferMode: 'balanced'
};

jest.unstable_mockModule('../../app/stores/settingsStore', () => ({
  useSettingsStore: () => mockSettingsStore
}));

jest.unstable_mockModule('../../app/utils/voice-stream-manager', () => ({
  createVoiceStreamManager: () => {
    const map = new Map();
    map.cleanupUser = jest.fn();
    map.cleanupAll = jest.fn();
    return map;
  }
}));

jest.unstable_mockModule('../../app/utils/frequency-analyzer', () => ({
  createFrequencyAnalyzer: () => ({
    update: jest.fn(),
    reset: jest.fn()
  })
}));

// Mock debug-utils before importing useUserStore
jest.unstable_mockModule('../../app/utils/debug-utils', () => ({
  debugLog: jest.fn()
}));

// Mock BufferQueueNode dependency
jest.unstable_mockModule('../../app/audio/buffer-queue-node', () => ({
  default: class MockBufferQueueNode {
    setJitterBufferSize() {}
  }
}));

// Import the composable
const { createPinia, setActivePinia, storeToRefs } = await import('pinia');

const { useUserStore } = await import('../../app/stores/userStore.js');

describe('useUserStore Jitter Buffer Calculation', () => {
  let userStore;
  let mockClient;
  let mockUser;
  let dataPingCallback;

  beforeEach(() => {
    setActivePinia(createPinia());
    // Reset watchers
    watchers.clear();
    
    // Reset settings store mock
    mockSettingsStore.jitterBufferSize = 3;
    mockSettingsStore.jitterBufferMode = 'balanced';
    
    mockClient = {
      self: { id: 1 },
      on: jest.fn((event, cb) => {
        if (event === 'dataPing') {
          dataPingCallback = cb;
        }
      }),
      off: jest.fn(),
      dataStats: null
    };

    mockUser = {
      id: 1,
      name: 'TestUser',
      channel: { id: 0 },
      _client: mockClient,
      on: jest.fn(),
      off: jest.fn()
    };
    // Simulate the UI wrapper created by AppState
    mockUser.__ui = {
      model: mockUser,
      name: ref('TestUser')
    };

    mockConnectionState.getClient.mockReturnValue(mockClient);
    
    userStore = useUserStore();
  });

  test('should calculate correct jitter buffer for 143ms latency', async () => {
    // Setup user
    const { thisUser } = storeToRefs(userStore);
    thisUser.value = mockUser.__ui;
    await nextTick();

    // Verify user is set
    expect(thisUser.value).toBeTruthy();
    
    // Setup stats
    // Latency 143ms, Variance 0 (for simplicity)
    // Target = 143 + 4 * 0 = 143ms
    // Packets = ceil(143 / 20) = 8 packets
    mockClient.dataStats = {
      mean: 143,
      variance: 0,
      n: 10
    };

    // Trigger dataPing
    expect(dataPingCallback).toBeDefined();
    dataPingCallback();

    // Check if jitterBufferSize updated
    expect(mockSettingsStore.jitterBufferSize).toBe(8);
  });

  test('should handle stats.n = 0 correctly (skip calculation)', async () => {
    const { thisUser } = storeToRefs(userStore);
    thisUser.value = mockUser.__ui;
    await nextTick();

    mockSettingsStore.jitterBufferSize = 5; // Set to non-default

    mockClient.dataStats = {
      mean: 143,
      variance: 0,
      n: 0 // No samples
    };

    dataPingCallback();

    // Should fall back to default (3) because stats are invalid
    expect(mockSettingsStore.jitterBufferSize).toBe(3);
  });
});
