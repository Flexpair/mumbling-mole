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
    reactive: (o) => o,
    markRaw: (o) => o,
    computed: () => ({ value: 0 }),
    nextTick: async () => {}
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

// Import the composable under test
const { useUserState } = await import('../../app/composables/useUserState.js');
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

describe('useUserState Jitter Buffer Calculation', () => {
  let userState;
  let mockClient;
  let mockUser;
  let mockUIUser;
  let mockAudioState;
  let mockVoiceState;
  let mockSettings;

  beforeEach(() => {
    mockAudioState = {
      audioContext: {},
      audioLockActive: ref(false)
    };

    mockVoiceState = {
      isLoopbackMode: ref(false),
      loopbackDominantFrequency: ref(0),
      setMute: jest.fn(),
      updateVoiceHandler: jest.fn()
    };

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

    userState = useUserState(mockAudioState, mockVoiceState);
    userState.setSettings(mockSettings);
  });


  test('should calculate jitter buffer based on client stats', async () => {
    // Set the current user to our mock UI wrapper
    userState.thisUser.value = mockUIUser;

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
