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

jest.unstable_mockModule('../../app/utils/debug-utils', () => ({
  debugLog: (...args) => console.log(...args)
}));

// Mock AudioStore
const mockAudioState = {
  audioContext: {},
  audioLockActive: false,
  notifyAudioLock: jest.fn(),
  getAudioContext: jest.fn(() => ({}))
};

// Mock VoiceStore
const mockVoiceState = {
  isLoopbackMode: false,
  loopbackDominantFrequency: 0,
  setMute: jest.fn(),
  updateVoiceHandler: jest.fn(),
  updateLoopbackFrequency: jest.fn()
};

// Mock ConnectionStore
const mockConnectionStore = {
  getClient: jest.fn(() => ({
    setSelfMute: jest.fn(),
    setSelfDeaf: jest.fn()
  }))
};

// Mock SettingsStore - the state that userStore reads from
const mockSettingsStore = {
  jitterBufferSize: 3,
  jitterBufferMode: 'balanced'
};

jest.unstable_mockModule('../../app/stores/audioStore.js', () => ({
  useAudioStore: () => mockAudioState
}));

jest.unstable_mockModule('../../app/stores/voiceStore.js', () => ({
  useVoiceStore: () => mockVoiceState
}));

jest.unstable_mockModule('../../app/stores/connectionStore.js', () => ({
  useConnectionStore: () => mockConnectionStore
}));

jest.unstable_mockModule('../../app/stores/settingsStore.js', () => ({
  useSettingsStore: () => mockSettingsStore
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

  beforeEach(() => {
    setActivePinia(createPinia());
    
    // Reset mocks
    mockAudioState.audioLockActive = false;
    mockVoiceState.isLoopbackMode = false;
    mockVoiceState.loopbackDominantFrequency = 0;
    mockVoiceState.setMute.mockClear();
    mockVoiceState.updateVoiceHandler.mockClear();

    // Reset settings store mock
    mockSettingsStore.jitterBufferSize = 3;
    mockSettingsStore.jitterBufferMode = 'balanced';

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
    
    expect(mockSettingsStore.jitterBufferSize).toBe(11);
  });

  test('should use low-latency mode settings', async () => {
    mockSettingsStore.jitterBufferMode = 'low-latency';
    mockClient.dataStats = { mean: 50, variance: 4, n: 10 };
    
    const { thisUser } = storeToRefs(userStore);
    thisUser.value = mockUIUser;

    await new Promise(r => setTimeout(r, 100));
    
    const callback = mockClient.on.mock.calls.find(call => call[0] === 'dataPing')?.[1];
    if (callback) callback();
    
    // low-latency: factor=3, minPackets=2
    // 50 + 3*2 = 56ms -> ceil(56/20) = 3 packets
    expect(mockSettingsStore.jitterBufferSize).toBe(3);
  });

  test('should use high-quality mode settings', async () => {
    mockSettingsStore.jitterBufferMode = 'high-quality';
    mockClient.dataStats = { mean: 100, variance: 100, n: 50 };
    
    const { thisUser } = storeToRefs(userStore);
    thisUser.value = mockUIUser;

    await new Promise(r => setTimeout(r, 100));
    
    const callback = mockClient.on.mock.calls.find(call => call[0] === 'dataPing')?.[1];
    if (callback) callback();
    
    // high-quality: factor=5, minPackets=4
    // 100 + 5*10 = 150ms -> ceil(150/20) = 8 packets
    expect(mockSettingsStore.jitterBufferSize).toBe(8);
  });

  test('should skip calculation when no stats available', async () => {
    mockClient.dataStats = { n: 0 };
    mockSettingsStore.jitterBufferSize = 5;
    
    const { thisUser } = storeToRefs(userStore);
    thisUser.value = mockUIUser;

    await new Promise(r => setTimeout(r, 100));
    
    const callback = mockClient.on.mock.calls.find(call => call[0] === 'dataPing')?.[1];
    if (callback) callback();
    
    // Should set to minPackets for mode (balanced = 3)
    expect(mockSettingsStore.jitterBufferSize).toBe(3);
  });

  test('should skip calculation when no client', () => {
    mockUIUser.model._client = null;
    mockSettingsStore.jitterBufferSize = 7;
    
    const { thisUser } = storeToRefs(userStore);
    thisUser.value = mockUIUser;

    // Should not throw and should not change buffer size
    expect(mockSettingsStore.jitterBufferSize).toBe(7);
  });
});

describe('useUserStore state management', () => {
  let userStore;

  beforeEach(() => {
    setActivePinia(createPinia());
    mockAudioState.audioLockActive = false;
    mockAudioState.notifyAudioLock = jest.fn();
    mockVoiceState.setMute.mockClear();
    mockConnectionStore.getClient = jest.fn(() => ({
      setSelfMute: jest.fn(),
      setSelfDeaf: jest.fn()
    }));
    userStore = useUserStore();
  });

  test('store should expose thisUser state', () => {
    expect(userStore).toHaveProperty('thisUser');
  });

  test('store should expose selfMute state', () => {
    expect(userStore).toHaveProperty('selfMute');
  });

  test('store should expose selfDeaf state', () => {
    expect(userStore).toHaveProperty('selfDeaf');
  });

  test('reset should be a function', () => {
    expect(typeof userStore.reset).toBe('function');
  });

  test('requestMute should be a function', () => {
    expect(typeof userStore.requestMute).toBe('function');
  });

  test('requestDeaf should be a function', () => {
    expect(typeof userStore.requestDeaf).toBe('function');
  });

  test('requestUnmute should be a function', () => {
    expect(typeof userStore.requestUnmute).toBe('function');
  });

  test('requestUndeaf should be a function', () => {
    expect(typeof userStore.requestUndeaf).toBe('function');
  });

  test('requestUnmute should notify audio lock when active', () => {
    mockAudioState.audioLockActive = true;
    
    userStore.requestUnmute();
    
    expect(mockAudioState.notifyAudioLock).toHaveBeenCalled();
  });

  test('requestUndeaf should notify audio lock when active', () => {
    mockAudioState.audioLockActive = true;
    
    userStore.requestUndeaf();
    
    expect(mockAudioState.notifyAudioLock).toHaveBeenCalled();
  });

  test('registerUser should be a function', () => {
    expect(typeof userStore.registerUser).toBe('function');
  });
});

describe('useUserStore registerUser', () => {
  let userStore;
  let mockUser;

  beforeEach(() => {
    setActivePinia(createPinia());
    userStore = useUserStore();
    
    mockUser = {
      session: 42,
      username: 'TestUser',
      channel: null,
      selfMute: false,
      selfDeaf: false,
      on: jest.fn(),
      off: jest.fn()
    };
  });

  test('should create UI wrapper for user', () => {
    userStore.registerUser(mockUser);
    
    expect(mockUser.__ui).toBeDefined();
    expect(mockUser.__ui.name.value).toBe('TestUser');
    expect(mockUser.__ui.selfMute.value).toBe(false);
    expect(mockUser.__ui.selfDeaf.value).toBe(false);
    expect(mockUser.__ui.talking.value).toBe('off');
  });

  test('should register event listeners', () => {
    userStore.registerUser(mockUser);
    
    expect(mockUser.on).toHaveBeenCalledWith('update', expect.any(Function));
    expect(mockUser.on).toHaveBeenCalledWith('voice', expect.any(Function));
    expect(mockUser.on).toHaveBeenCalledWith('server-state-sync', expect.any(Function));
  });

  test('should clean up previous UI wrapper if exists', () => {
    const oldSyncFn = jest.fn();
    mockUser.__ui = { old: true };
    mockUser.__syncServerState = oldSyncFn;
    
    userStore.registerUser(mockUser);
    
    expect(mockUser.off).toHaveBeenCalledWith('server-state-sync', oldSyncFn);
    expect(mockUser.__ui.old).toBeUndefined();
  });

  test('handleUserUpdate should update channel', () => {
    userStore.registerUser(mockUser);
    
    const updateHandler = mockUser.on.mock.calls.find(c => c[0] === 'update')[1];
    
    const newChannel = { __ui: { name: 'NewChannel' } };
    mockUser.channel = newChannel;
    
    updateHandler(null, { channel: newChannel });
    
    expect(mockUser.__ui.channel.value).toEqual({ name: 'NewChannel' });
  });

  test('handleUserUpdate should update selfMute', () => {
    userStore.registerUser(mockUser);
    
    const updateHandler = mockUser.on.mock.calls.find(c => c[0] === 'update')[1];
    
    updateHandler(null, { selfMute: true });
    
    expect(mockUser.__ui.selfMute.value).toBe(true);
  });

  test('handleUserUpdate should update selfDeaf', () => {
    userStore.registerUser(mockUser);
    
    const updateHandler = mockUser.on.mock.calls.find(c => c[0] === 'update')[1];
    
    
    updateHandler(null, { selfDeaf: true });
    
    expect(mockUser.__ui.selfDeaf.value).toBe(true);
  });

  test('server-state-sync should update selfMute and selfDeaf', () => {
    userStore.registerUser(mockUser);
    
    const syncHandler = mockUser.on.mock.calls.find(c => c[0] === 'server-state-sync')[1];
    
    syncHandler({ selfMute: true, selfDeaf: true });
    
    expect(userStore.selfMute).toBe(true);
    expect(userStore.selfDeaf).toBe(true);
  });
});

describe('useUserStore Request Methods Branch Coverage', () => {
  let userStore;
  
  beforeEach(() => {
    setActivePinia(createPinia());
    mockAudioState.audioLockActive = false;
    mockConnectionStore.getClient.mockReturnValue({
      setSelfMute: jest.fn(),
      setSelfDeaf: jest.fn()
    });
    userStore = useUserStore();
  });

  describe('requestMute', () => {
    test('should mute when user is undefined (self)', () => {
      userStore.requestMute(undefined);
      expect(userStore.selfMute).toBe(true);
    });

    test('should mute when user equals thisUser', () => {
      const mockUser = { session: 1 };
      userStore.thisUser.value = mockUser;
      userStore.requestMute(mockUser);
      expect(userStore.selfMute).toBe(true);
    });

    test('should call client.setSelfMute when thisUser exists', () => {
      const mockClient = { setSelfMute: jest.fn(), setSelfDeaf: jest.fn() };
      mockConnectionStore.getClient.mockReturnValue(mockClient);
      const mockUser = { session: 1 };
      userStore.thisUser.value = mockUser;
      
      userStore.requestMute(undefined);
      
      expect(mockClient.setSelfMute).toHaveBeenCalledWith(true);
    });
  });

  describe('requestDeaf', () => {
    test('should deaf and mute when not in loopback mode', () => {
      userStore.requestDeaf(undefined, false);
      expect(userStore.selfDeaf).toBe(true);
      expect(userStore.selfMute).toBe(true);
    });

    test('should only deaf (not mute) when in loopback mode', () => {
      userStore.selfMute.value = false;
      userStore.requestDeaf(undefined, true);
      expect(userStore.selfDeaf).toBe(true);
      expect(userStore.selfMute).toBe(false);
    });

    test('should call client methods when thisUser exists', () => {
      const mockClient = { setSelfMute: jest.fn(), setSelfDeaf: jest.fn() };
      mockConnectionStore.getClient.mockReturnValue(mockClient);
      const mockUser = { session: 1 };
      userStore.thisUser.value = mockUser;
      
      userStore.requestDeaf(undefined, false);
      
      expect(mockClient.setSelfDeaf).toHaveBeenCalledWith(true);
      expect(mockClient.setSelfMute).toHaveBeenCalledWith(true);
    });
    
    test('should not call setSelfMute in loopback mode', () => {
      const mockClient = { setSelfMute: jest.fn(), setSelfDeaf: jest.fn() };
      mockConnectionStore.getClient.mockReturnValue(mockClient);
      const mockUser = { session: 1 };
      userStore.thisUser.value = mockUser;
      
      userStore.requestDeaf(undefined, true);
      
      expect(mockClient.setSelfDeaf).toHaveBeenCalledWith(true);
      expect(mockClient.setSelfMute).not.toHaveBeenCalled();
    });
  });

  describe('requestUnmute', () => {
    test('should return early and call notifyAudioLock when audio is locked', () => {
      mockAudioState.audioLockActive = true;
      userStore.selfMute.value = true;
      
      userStore.requestUnmute(undefined);
      
      expect(mockAudioState.notifyAudioLock).toHaveBeenCalled();
      expect(userStore.selfMute).toBe(true); // Should NOT unmute
    });

    test('should unmute and undeaf when audio is not locked', () => {
      mockAudioState.audioLockActive = false;
      userStore.selfMute.value = true;
      userStore.selfDeaf.value = true;
      
      userStore.requestUnmute(undefined);
      
      expect(userStore.selfMute).toBe(false);
      expect(userStore.selfDeaf).toBe(false);
    });

    test('should call client methods when thisUser exists', () => {
      const mockClient = { setSelfMute: jest.fn(), setSelfDeaf: jest.fn() };
      mockConnectionStore.getClient.mockReturnValue(mockClient);
      const mockUser = { session: 1 };
      userStore.thisUser.value = mockUser;
      
      userStore.requestUnmute(undefined);
      
      expect(mockClient.setSelfMute).toHaveBeenCalledWith(false);
      expect(mockClient.setSelfDeaf).toHaveBeenCalledWith(false);
    });
  });

  describe('requestUndeaf', () => {
    test('should return early and notify when audio is locked', () => {
      mockAudioState.audioLockActive = true;
      userStore.selfDeaf.value = true;
      
      userStore.requestUndeaf(undefined);
      
      expect(mockAudioState.notifyAudioLock).toHaveBeenCalled();
      expect(userStore.selfDeaf).toBe(true); // Should NOT undeaf
    });

    test('should undeaf when audio is not locked', () => {
      mockAudioState.audioLockActive = false;
      userStore.selfDeaf.value = true;
      
      userStore.requestUndeaf(undefined);
      
      expect(userStore.selfDeaf).toBe(false);
    });
  });

  describe('reset', () => {
    test('should reset all user state', () => {
      userStore.thisUser.value = { session: 1 };
      userStore.selfMute.value = true;
      userStore.selfDeaf.value = true;
      
      userStore.reset();
      
      // After reset, thisUser becomes null (ref gets replaced)
      expect(userStore.thisUser).toBe(null);
      expect(userStore.selfMute).toBe(false);
      expect(userStore.selfDeaf).toBe(false);
    });
  });
});

