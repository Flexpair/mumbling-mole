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
            watchers.get(r).forEach(cb => cb(v, old, () => {}));
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
    reactive: (o) => o,
    computed: (fn) => ({ value: fn() })
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

const mockConnectionState = {
  getClient: jest.fn()
};

// Mock settings
const mockSettings = {
  jitterBufferSize: ref(3),
  jitterBufferMode: ref('balanced'),
  jitterBufferTarget: ref(3)
};

jest.unstable_mockModule('../../app/composables/useSettings', () => ({
  useSettings: () => mockSettings
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

// Import the composable
const { useUserState } = await import('../../app/composables/useUserState.js');

describe('useUserState Jitter Buffer Calculation', () => {
  let userState;
  let mockClient;
  let mockUser;
  let dataPingCallback;

  beforeEach(() => {
    // Reset watchers
    watchers.clear();
    
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
    
    userState = useUserState(mockAudioState, mockVoiceState, mockConnectionState);
    userState.setSettings(mockSettings);
  });

  test('should calculate correct jitter buffer for 143ms latency', async () => {
    // Setup user
    userState.registerUser(mockUser);
    userState.thisUser.value = mockUser.__ui;
    await nextTick();

    // Verify user is set
    expect(userState.thisUser.value).toBeTruthy();
    
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
    expect(mockSettings.jitterBufferSize.value).toBe(8);
  });

  test('should handle stats.n = 0 correctly (skip calculation)', async () => {
    userState.registerUser(mockUser);
    userState.thisUser.value = mockUser.__ui;
    await nextTick();

    mockSettings.jitterBufferSize.value = 5; // Set to non-default

    mockClient.dataStats = {
      mean: 143,
      variance: 0,
      n: 0 // No samples
    };

    dataPingCallback();

    // Should fall back to default (3) because stats are invalid
    expect(mockSettings.jitterBufferSize.value).toBe(3);
  });
});
