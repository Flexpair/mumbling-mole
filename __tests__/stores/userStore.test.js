import { jest } from '@jest/globals';

// Mock Vue with working reactivity for this test
jest.unstable_mockModule('vue', () => {
  const listeners = new Map();
  
  return {
    ref: (val) => {
      const r = {
        _val: val,
        get value() { return this._val; },
        set value(v) {
          this._val = v;
          if (listeners.has(this)) {
             listeners.get(this).forEach(cb => cb(v, null, () => {}));
          }
        },
        __v_isRef: true
      };
      return r;
    },
    watch: (source, cb) => {
      if (!listeners.has(source)) {
        listeners.set(source, []);
      }
      listeners.get(source).push(cb);
      return () => {};
    },
    reactive: (o) => {
      // Simple proxy to handle ref unwrapping for Pinia
      return new Proxy(o, {
        get(target, prop, receiver) {
          const val = target[prop];
          return (val && val.__v_isRef) ? val.value : val;
        },
        set(target, prop, value, receiver) {
          const current = target[prop];
          if (current && current.__v_isRef) {
            current.value = value;
            return true;
          }
          target[prop] = value;
          return true;
        }
      });
    },
    markRaw: (o) => o,
    computed: () => ({ value: 0 }),
    nextTick: async () => {},
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
  };
});

// Mock useLocalStorage
jest.unstable_mockModule('../../app/composables/useLocalStorage.js', async () => {
  const { ref } = await import('vue');
  return {
    useLocalStorage: (key, def) => ref(def)
  };
});

// Mock other dependencies
jest.unstable_mockModule('../../app/audio/buffer-queue-node', () => ({
  default: class MockBufferQueueNode {
    setJitterBufferSize() {}
  }
}));

jest.unstable_mockModule('../../app/utils/voice-stream-manager', () => ({
  createVoiceStreamManager: () => ({
    set: jest.fn(),
    get: jest.fn(),
    cleanup: jest.fn(),
    forEach: jest.fn()
  })
}));

jest.unstable_mockModule('../../app/utils/frequency-analyzer', () => ({
  createFrequencyAnalyzer: () => ({})
}));

jest.unstable_mockModule('../../app/composables/debug-utils', () => ({
  debugLog: (...args) => console.log(...args)
}));

// Mock AudioStore
const mockAudioState = {
  audioContext: {},
  audioLockActive: { value: false }
};

// Mock VoiceStore
const mockVoiceState = {
  isLoopbackMode: false,
  loopbackDominantFrequency: 0,
  setMute: jest.fn(),
  updateVoiceHandler: jest.fn()
};

jest.unstable_mockModule('../../app/stores/audioStore.js', () => ({
  useAudioStore: () => mockAudioState
}));

jest.unstable_mockModule('../../app/stores/voiceStore.js', () => ({
  useVoiceStore: () => mockVoiceState
}));

// Import the store under test
const { createPinia, setActivePinia, storeToRefs } = await import('pinia');
const { useUserStore } = await import('../../app/stores/userStore.js');
const { ref } = await import('vue');

// Mock mumble-client User and Client
class MockClient {
  constructor() {
    this.dataStats = { mean: 200, variance: 25, n: 100 }; // High latency (200ms)
    this.on = jest.fn();
    this.off = jest.fn();
  }
}

class MockUser {
  constructor(client) {
    this._client = client;
    this.session = 1;
    this.username = 'TestUser';
    this.on = jest.fn();
    this.off = jest.fn();
  }
}

describe('useUserStore Jitter Buffer Calculation', () => {
  let userStore;
  let mockClient;
  let mockUser;
  let mockUIUser;
  let mockSettings;

  beforeEach(() => {
    setActivePinia(createPinia());
    
    // Reset mocks
    mockAudioState.audioLockActive.value = false;
    mockVoiceState.isLoopbackMode = false;
    mockVoiceState.loopbackDominantFrequency = 0;
    mockVoiceState.setMute.mockClear();
    mockVoiceState.updateVoiceHandler.mockClear();

    mockSettings = {
      jitterBufferSize: ref(3),
      jitterBufferMode: ref('balanced')
    };

    mockClient = new MockClient();
    mockUser = new MockUser(mockClient);
    
    // Create UI wrapper structure as in registerUser
    mockUIUser = {
      model: mockUser,
      name: ref('TestUser'),
      channel: ref(null),
      selfMute: ref(false),
      selfDeaf: ref(false),
      talking: ref('off')
    };

    userStore = useUserStore();
    userStore.setSettings(mockSettings);
  });


  test('should calculate jitter buffer based on client stats', async () => {
    // Set the current user to our mock UI wrapper
    const { thisUser } = storeToRefs(userStore);
    thisUser.value = mockUIUser;

    // Wait for watcher to run
    await new Promise(r => setTimeout(r, 100));
    
    // Verify client.on('dataPing') was called
    expect(mockClient.on).toHaveBeenCalledWith('dataPing', expect.any(Function));
    
    // Get the callback
    const callback = mockClient.on.mock.calls.find(call => call[0] === 'dataPing')[1];
    
    // Call it
    callback();
    
    // Check if jitterBufferSize was updated
    // Formula: Latency + factor * Deviation
    // Latency = 200
    // Variance = 25 -> Deviation = 5
    // Mode = balanced -> factor = 4
    // TargetMs = 200 + 4 * 5 = 220ms
    // TargetPackets = ceil(220 / 20) = 11
    
    expect(mockSettings.jitterBufferSize.value).toBe(11);
  });
});
