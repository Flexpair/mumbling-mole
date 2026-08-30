/**
 * useConnectionLogic Tests
 * 
 * Tests for the connection orchestration composable
 */
import { jest, describe, it, expect, beforeEach, afterEach } from '@jest/globals';

// Mock all Vue reactivity
jest.unstable_mockModule('vue', () => ({
  ref: (val) => ({ value: val, __v_isRef: true }),
  shallowRef: (val) => ({ value: val, __v_isRef: true }),
  computed: (fn) => ({ value: typeof fn === 'function' ? fn() : fn }),
  watch: jest.fn(() => () => {}),
  reactive: (o) => o,
  markRaw: (o) => o,
  nextTick: async () => {},
  effectScope: () => ({ active: true, run: fn => fn(), stop: () => {} }),
  getCurrentScope: () => null,
  onScopeDispose: () => {},
  toRaw: (o) => o,
  isRef: (r) => r?.__v_isRef === true,
}));

// Mock localize
jest.unstable_mockModule('../../app/localize', () => ({
  translate: jest.fn((key) => key),
}));

// Create mock stores
const mockConnectionStore = {
  connect: jest.fn().mockResolvedValue({
    root: { name: 'Root' },
    self: { session: 1, username: 'TestUser', __ui: {} },
    users: new Map(),
    setAudioQuality: jest.fn(),
    on: jest.fn(),
  }),
  disconnect: jest.fn(),
  getClient: jest.fn(() => null),
  registerChannel: jest.fn(),
};

function createClient(name) {
  return {
    name,
    root: { name: 'Root' },
    self: { session: 1, username: name, __ui: {} },
    users: new Map(),
    setAudioQuality: jest.fn(),
    on: jest.fn(),
    disconnect: jest.fn(),
  };
}

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

const mockAudioStore = {
  audioContext: { sampleRate: 48000 },
  initializeAudioContext: jest.fn().mockResolvedValue({}),
  micPermissionDenied: false,
  clearAudioLock: jest.fn(),
  stopBeep: jest.fn(),
  beeperReady: false,
  initializePersistentBeeper: jest.fn().mockResolvedValue(null),
  audioLockActive: false,
};
let cachedAudioContextRead;
Object.defineProperty(mockAudioStore, 'audioContext', {
  configurable: true,
  get() {
    cachedAudioContextRead?.();
    return this._audioContext;
  },
  set(value) {
    this._audioContext = value;
  },
});

const mockVoiceStore = {
  isLoopbackMode: false,
  voiceHandler: null,
  voiceHandlerReady: false,
  setupVoiceForConnection: jest.fn().mockResolvedValue(undefined),
  updateVoiceHandler: jest.fn(),
  setMute: jest.fn(),
  endVoiceHandler: jest.fn(),
  stopVoiceCapture: jest.fn(),
  reset: jest.fn(() => {
    mockVoiceStore.stopVoiceCapture();
    mockVoiceStore.endVoiceHandler();
    mockVoiceStore.isLoopbackMode = false;
    mockVoiceStore.voiceHandlerReady = false;
  }),
  loopbackDominantFrequency: 0,
};

const mockUIStore = {
  guacamoleFrame: null,
  messageConfirmed: false,
};

const mockUserStore = {
  thisUser: null,
  selfMute: false,
  registerUser: jest.fn(),
};

const mockSettingsStore = {
  samplesPerPacket: 960,
  audioBitrate: 40000,
};

const mockDialogStore = {
  connectDialog: { isTestActive: false },
  sampleRateDialog: { sampleRate: null, connectionParams: null },
  showConnectDialog: jest.fn(),
  showSampleRateDialog: jest.fn(),
  showErrorDialog: jest.fn(),
};

jest.unstable_mockModule('../../app/stores/connectionStore', () => ({
  useConnectionStore: () => mockConnectionStore,
}));

jest.unstable_mockModule('../../app/stores/audioStore', () => ({
  useAudioStore: () => mockAudioStore,
}));

jest.unstable_mockModule('../../app/stores/voiceStore', () => ({
  useVoiceStore: () => mockVoiceStore,
}));

jest.unstable_mockModule('../../app/stores/uiStore', () => ({
  useUIStore: () => mockUIStore,
}));

jest.unstable_mockModule('../../app/stores/userStore', () => ({
  useUserStore: () => mockUserStore,
}));

jest.unstable_mockModule('../../app/stores/settingsStore', () => ({
  useSettingsStore: () => mockSettingsStore,
}));

jest.unstable_mockModule('../../app/stores/dialogStore', () => ({
  useDialogStore: () => mockDialogStore,
}));

// Mock credentials service
const mockFetchCredentials = jest.fn().mockResolvedValue({
  mumblePassword: 'test-password',
  guacamoleUser: 'watcher',
  guacamolePassword: 'guac-password'
});
const mockClearCredentials = jest.fn();

jest.unstable_mockModule('../../app/auth/credentials-service.js', () => ({
  fetchCredentials: mockFetchCredentials,
  clearCredentials: mockClearCredentials
}));

const mockStartGuacamoleFrame = jest.fn();

jest.unstable_mockModule('../../app/composables/useGuacamole.js', () => ({
  startGuacamoleFrame: mockStartGuacamoleFrame,
}));

const { useConnectionLogic } = await import('../../app/composables/useConnectionLogic.js');

describe('useConnectionLogic', () => {
  let logic;
  let mockAuth;
  let originalAlert;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Reset store state
    mockUserStore.thisUser = null;
    mockVoiceStore.isLoopbackMode = false;
    mockAudioStore.audioContext = { sampleRate: 48000 };
    cachedAudioContextRead = undefined;
    mockAudioStore.micPermissionDenied = false;
    mockAudioStore.beeperReady = false;
    mockVoiceStore.voiceHandlerReady = false;
    mockUIStore.guacamoleFrame = null;
    mockDialogStore.connectDialog.isTestActive = false;
    mockConnectionStore.connect.mockResolvedValue(createClient('default'));
    mockConnectionStore.getClient.mockReturnValue(null);
    
    mockAuth = {
      currentUser: jest.fn(() => ({
        id: 'test-user',
        token: { access_token: 'test-jwt-token' },
        app_metadata: {
          roles: ['watch', 'listen'],
        },
      })),
      getCurrentUser: jest.fn(async () => mockAuth.currentUser()),
      getAccessToken: jest.fn().mockResolvedValue('test-jwt-token'),
      openAuth: jest.fn().mockResolvedValue(undefined),
      logout: jest.fn().mockResolvedValue(undefined),
    };
    
    // Reset credentials mock
    mockFetchCredentials.mockReset();
    mockFetchCredentials.mockResolvedValue({
      mumblePassword: 'test-password',
      guacamoleUser: 'watcher',
      guacamolePassword: 'guac-password'
    });
    
    originalAlert = globalThis.alert;
    globalThis.alert = jest.fn();
    
    logic = useConnectionLogic({ auth: mockAuth });
  });

  afterEach(() => {
    globalThis.alert = originalAlert;
  });


  describe('connected()', () => {
    it('should return false when not connected', () => {
      mockUserStore.thisUser = null;
      expect(logic.connected()).toBe(false);
    });

    it('should return true when connected', () => {
      mockUserStore.thisUser = { session: 1 };
      expect(logic.connected()).toBe(true);
    });
  });

  describe('connect()', () => {
    it('should alert when auth is not provided', async () => {
      const logicNoAuth = useConnectionLogic({});
      
      await logicNoAuth.connect('host', 64738, 'user', 'pass');
      
      expect(globalThis.alert).toHaveBeenCalledWith(
        'Authentication system not initialized. Please refresh the page.'
      );
    });

    it('should alert when user is not authenticated', async () => {
      mockAuth.currentUser.mockReturnValue(null);
      
      await logic.connect('host', 64738, 'user', 'pass');
      
      expect(globalThis.alert).toHaveBeenCalledWith('Failed to authenticate. Please log in again.');
      expect(mockAuth.openAuth).toHaveBeenCalledWith('login');
    });

    it('should alert when credentials fetch fails', async () => {
      mockFetchCredentials.mockRejectedValue(new Error('Token expired'));
      
      await logic.connect('host', 64738, 'user', 'pass');
      
      expect(globalThis.alert).toHaveBeenCalledWith(
        'Failed to authenticate. Please log in again.'
      );
      expect(mockAuth.logout).toHaveBeenCalled();
      expect(mockAuth.openAuth).toHaveBeenCalledWith('login');
    });

    it('should open login when provider logout never settles', async () => {
      jest.useFakeTimers();
      mockFetchCredentials.mockRejectedValue(new Error('Token expired'));
      mockAuth.logout.mockReturnValue(new Promise(() => {}));

      try {
        const connection = logic.connect('host', 64738, 'user', 'pass');
        await Promise.resolve();
        await Promise.resolve();
        await jest.advanceTimersByTimeAsync(1500);
        await connection;

        expect(mockAuth.openAuth).toHaveBeenCalledWith('login');
      } finally {
        jest.useRealTimers();
      }
    });

    it('should initialize audio context if not present', async () => {
      mockAudioStore.audioContext = null;

      await logic.connect('host', 64738, 'user', 'pass');

      expect(mockAudioStore.initializeAudioContext).toHaveBeenCalled();
    });

    it('should roll back when AudioContext initialization returns no context', async () => {
      mockAudioStore.audioContext = null;
      mockAudioStore.initializeAudioContext.mockResolvedValueOnce(null);

      await logic.connect('host', 64738, 'user', 'pass');

      expect(mockDialogStore.showErrorDialog).toHaveBeenCalledWith(
        expect.objectContaining({ message: expect.stringContaining('AudioContext') }),
        expect.objectContaining({ host: 'host', port: 64738 })
      );
      expect(mockVoiceStore.endVoiceHandler).toHaveBeenCalled();
      expect(mockConnectionStore.disconnect).toHaveBeenCalled();
      expect(mockConnectionStore.connect).not.toHaveBeenCalled();
    });

    it('should roll back and show an error when AudioContext initialization fails', async () => {
      const audioError = new Error('Audio initialization failed');
      mockAudioStore.audioContext = null;
      mockAudioStore.initializeAudioContext.mockRejectedValueOnce(audioError);

      await logic.connect('host', 64738, 'user', 'pass');

      expect(mockDialogStore.showErrorDialog).toHaveBeenCalledWith(
        audioError,
        expect.objectContaining({ host: 'host', port: 64738 })
      );
      expect(mockVoiceStore.endVoiceHandler).toHaveBeenCalled();
      expect(mockConnectionStore.disconnect).toHaveBeenCalled();
      expect(mockConnectionStore.connect).not.toHaveBeenCalled();
    });

    it('should show sample rate dialog for non-48kHz', async () => {
      mockAudioStore.audioContext = { sampleRate: 44100 };
      
      await logic.connect('host', 64738, 'user', 'pass');
      
      expect(mockDialogStore.showSampleRateDialog).toHaveBeenCalled();
      expect(mockDialogStore.sampleRateDialog.sampleRate).toBe(44100);
    });

    it('should proceed with 48kHz sample rate', async () => {
      mockAudioStore.audioContext = { sampleRate: 48000 };
      
      await logic.connect('host', 64738, 'user', 'pass');
      
      expect(mockDialogStore.showSampleRateDialog).not.toHaveBeenCalled();
      expect(mockVoiceStore.setupVoiceForConnection).toHaveBeenCalled();
    });

    it('should replace an active loopback connection through the normal pipeline', async () => {
      mockVoiceStore.isLoopbackMode = true;
      mockUserStore.thisUser = { session: 1 };

      await logic.connect('host', 64738, 'user', 'dialog-password');

      expect(mockConnectionStore.disconnect).toHaveBeenCalled();
      expect(mockVoiceStore.isLoopbackMode).toBe(false);
      expect(mockConnectionStore.connect).toHaveBeenCalledWith(
        'host',
        64738,
        'user',
        'test-password',
        []
      );
      expect(mockStartGuacamoleFrame).toHaveBeenCalledWith(
        'watcher',
        'guac-password',
        mockUIStore
      );
    });

    it('should roll back Mumble when Guacamole startup fails', async () => {
      const guacamoleError = new Error('Remote desktop is not ready');
      mockStartGuacamoleFrame.mockRejectedValueOnce(guacamoleError);

      await logic.connect('host', 64738, 'user', 'dialog-password');

      expect(mockConnectionStore.connect).toHaveBeenCalled();
      expect(mockConnectionStore.disconnect).toHaveBeenCalled();
      expect(mockDialogStore.showErrorDialog).toHaveBeenCalledWith(
        guacamoleError,
        expect.objectContaining({ host: 'host', port: 64738 })
      );
    });

    it('should tear down Mumble and Guacamole when the auth session changes during remote desktop startup', async () => {
      const guacamoleStarted = deferred();
      const guacamoleReady = deferred();
      let guacamoleStartupActive = false;
      const stopGuacamole = jest.fn(() => {
        if (!guacamoleStartupActive) return;
        guacamoleStartupActive = false;
        const cancelled = new Error('Remote desktop startup was cancelled');
        cancelled.code = 'GUACAMOLE_START_CANCELLED';
        guacamoleReady.reject(cancelled);
      });
      mockUIStore.guacamoleFrame = { stop: stopGuacamole };
      mockStartGuacamoleFrame.mockImplementationOnce(() => {
        guacamoleStartupActive = true;
        guacamoleStarted.resolve();
        return guacamoleReady.promise;
      });

      const connection = logic.connect('host', 64738, 'user', 'pass');
      await guacamoleStarted.promise;
      expect(mockStartGuacamoleFrame).toHaveBeenCalledTimes(1);
      const stopCallsBeforeReset = stopGuacamole.mock.calls.length;
      const disconnectCallsBeforeReset = mockConnectionStore.disconnect.mock.calls.length;

      logic.resetClient();
      await connection;

      expect(stopGuacamole).toHaveBeenCalledTimes(stopCallsBeforeReset + 1);
      expect(mockConnectionStore.disconnect)
        .toHaveBeenCalledTimes(disconnectCallsBeforeReset + 1);
      expect(mockUserStore.thisUser).toBeNull();
      expect(mockDialogStore.showErrorDialog).not.toHaveBeenCalled();
    });

    it('should stop after credentials when the auth session changes', async () => {
      mockFetchCredentials.mockImplementationOnce(async () => {
        logic.resetClient();
        return {
          mumblePassword: 'old-password',
          guacamoleUser: 'watcher',
          guacamolePassword: 'old-guac-password',
        };
      });

      await logic.connect('host', 64738, 'user', 'pass');

      expect(mockVoiceStore.setupVoiceForConnection).not.toHaveBeenCalled();
      expect(mockConnectionStore.connect).not.toHaveBeenCalled();
      expect(mockStartGuacamoleFrame).not.toHaveBeenCalled();
    });

    it('should stop after audio initialization when the user logs out', async () => {
      mockAudioStore.audioContext = null;
      mockAudioStore.initializeAudioContext.mockImplementationOnce(async () => {
        logic.resetClient();
        mockAudioStore.audioContext = { sampleRate: 48000 };
      });

      await logic.connect('host', 64738, 'user', 'pass');

      expect(mockVoiceStore.setupVoiceForConnection).not.toHaveBeenCalled();
      expect(mockConnectionStore.connect).not.toHaveBeenCalled();
      expect(mockStartGuacamoleFrame).not.toHaveBeenCalled();
    });

    it('should stop before the sample-rate handoff when a cached AudioContext attempt is stale', async () => {
      mockAudioStore.audioContext = { sampleRate: 44100 };
      cachedAudioContextRead = () => logic.resetClient();

      await logic.connect('old-host', 64738, 'old-user', 'pass');

      expect(mockDialogStore.showSampleRateDialog).not.toHaveBeenCalled();
      expect(mockConnectionStore.connect).not.toHaveBeenCalled();
    });

    it('should stop existing microphone capture as soon as a new attempt starts', async () => {
      const identity = deferred();
      const nextAuth = {
        ...mockAuth,
        getCurrentUser: jest.fn(() => identity.promise),
      };
      mockVoiceStore.stopVoiceCapture.mockClear();

      const connection = useConnectionLogic({ auth: nextAuth })
        .connect('next-host', 64738, 'next-user', 'pass');

      expect(mockVoiceStore.stopVoiceCapture).toHaveBeenCalledTimes(1);

      identity.resolve(null);
      await connection;
    });

    it('should let only the newest connection attempt reach Mumble and Guacamole', async () => {
      const firstCredentials = deferred();
      const secondAuth = {
        ...mockAuth,
        getAccessToken: jest.fn().mockResolvedValue('new-session-token'),
      };
      mockAuth.getAccessToken.mockResolvedValue('old-session-token');
      mockFetchCredentials.mockImplementation(token => token === 'old-session-token'
        ? firstCredentials.promise
        : Promise.resolve({
          mumblePassword: 'new-password',
          guacamoleUser: 'watcher',
          guacamolePassword: 'new-guac-password',
        }));

      const firstConnection = logic.connect('old-host', 64738, 'old-user', 'pass');
      const otherLogic = useConnectionLogic({ auth: secondAuth });
      const secondConnection = otherLogic.connect('new-host', 64738, 'new-user', 'pass');
      await secondConnection;
      firstCredentials.resolve({
        mumblePassword: 'old-password',
        guacamoleUser: 'watcher',
        guacamolePassword: 'old-guac-password',
      });
      await firstConnection;

      expect(mockConnectionStore.connect).toHaveBeenCalledTimes(1);
      expect(mockConnectionStore.connect).toHaveBeenCalledWith(
        'new-host',
        64738,
        'new-user',
        'new-password',
        []
      );
      expect(mockStartGuacamoleFrame).toHaveBeenCalledTimes(1);
      expect(mockStartGuacamoleFrame).toHaveBeenCalledWith(
        'watcher',
        'new-guac-password',
        mockUIStore
      );
    });

    it('should ignore a stale unauthenticated session lookup after a newer connection succeeds', async () => {
      const staleIdentity = deferred();
      const staleAuth = {
        ...mockAuth,
        getCurrentUser: jest.fn(() => staleIdentity.promise),
        openAuth: jest.fn().mockResolvedValue(undefined),
      };
      const currentAuth = {
        ...mockAuth,
        getCurrentUser: jest.fn().mockResolvedValue({ id: 'current-user' }),
        getAccessToken: jest.fn().mockResolvedValue('current-token'),
      };

      const staleConnection = useConnectionLogic({ auth: staleAuth })
        .connect('stale-host', 64738, 'stale-user', 'pass');
      await useConnectionLogic({ auth: currentAuth })
        .connect('current-host', 64738, 'current-user', 'pass');

      staleIdentity.resolve(null);
      await staleConnection;

      expect(staleAuth.openAuth).not.toHaveBeenCalled();
      expect(mockConnectionStore.disconnect).toHaveBeenCalled();
      expect(mockConnectionStore.connect).toHaveBeenCalledTimes(1);
      expect(mockConnectionStore.connect).toHaveBeenCalledWith(
        'current-host',
        64738,
        'current-user',
        'test-password',
        []
      );
    });

    it('should ignore a stale token lookup without superseding the newer credentials request', async () => {
      const staleToken = deferred();
      const currentCredentials = deferred();
      const staleAuth = {
        ...mockAuth,
        getAccessToken: jest.fn(() => staleToken.promise),
      };
      const currentAuth = {
        ...mockAuth,
        getAccessToken: jest.fn().mockResolvedValue('current-token'),
      };
      mockFetchCredentials.mockImplementation(token => {
        if (token === 'current-token') return currentCredentials.promise;
        return Promise.reject(new Error('stale token must not be fetched'));
      });

      const staleConnection = useConnectionLogic({ auth: staleAuth })
        .connect('stale-host', 64738, 'stale-user', 'pass');
      await Promise.resolve();
      await Promise.resolve();
      expect(staleAuth.getAccessToken).toHaveBeenCalledTimes(1);

      const currentConnection = useConnectionLogic({ auth: currentAuth })
        .connect('current-host', 64738, 'current-user', 'pass');
      await Promise.resolve();
      await Promise.resolve();

      staleToken.resolve('stale-token');
      currentCredentials.resolve({
        mumblePassword: 'current-password',
        guacamoleUser: 'watcher',
        guacamolePassword: 'current-guac-password',
      });
      await Promise.all([staleConnection, currentConnection]);

      expect(mockFetchCredentials).toHaveBeenCalledTimes(1);
      expect(mockFetchCredentials).toHaveBeenCalledWith('current-token');
      expect(mockConnectionStore.connect).toHaveBeenCalledTimes(1);
      expect(mockConnectionStore.connect).toHaveBeenCalledWith(
        'current-host',
        64738,
        'current-user',
        'current-password',
        []
      );
    });

    it('should clear a stored client superseded before post-connect setup', async () => {
      const nextIdentity = deferred();
      const staleClient = createClient('stale');
      const nextAuth = {
        ...mockAuth,
        getCurrentUser: jest.fn(() => nextIdentity.promise),
      };
      let nextConnection;

      mockConnectionStore.connect.mockImplementationOnce(async () => {
        mockConnectionStore.getClient.mockReturnValue(staleClient);
        nextConnection = useConnectionLogic({ auth: nextAuth })
          .connect('next-host', 64738, 'next-user', 'pass');
        return staleClient;
      });

      await logic.connect('stale-host', 64738, 'stale-user', 'pass');

      expect(mockConnectionStore.disconnect).toHaveBeenCalled();
      nextIdentity.resolve(null);
      await nextConnection;
    });
  });

  describe('connectLoopback()', () => {
    it('should set loopback mode before connecting', async () => {
      await logic.connectLoopback('host', 64738, 'user', 'pass');
      
      expect(mockVoiceStore.isLoopbackMode).toBe(true);
    });

    it('should keep the audio test active while connecting', async () => {
      const identity = deferred();
      const pendingAuth = {
        ...mockAuth,
        getCurrentUser: jest.fn(() => identity.promise),
      };
      mockDialogStore.connectDialog.isTestActive = true;

      const connection = useConnectionLogic({ auth: pendingAuth })
        .connectLoopback('host', 64738, 'user', 'pass');

      expect(mockDialogStore.connectDialog.isTestActive).toBe(true);

      identity.resolve(null);
      await connection;
    });

    it('should skip sample rate check in loopback mode', async () => {
      mockAudioStore.audioContext = { sampleRate: 44100 };
      
      await logic.connectLoopback('host', 64738, 'user', 'pass');
      
      // Should NOT show sample rate dialog in loopback mode
      expect(mockDialogStore.showSampleRateDialog).not.toHaveBeenCalled();
    });

    it('should ensure mic is not muted for loopback', async () => {
      mockUserStore.selfMute = true;
      
      await logic.connectLoopback('host', 64738, 'user', 'pass');
      
      expect(mockUserStore.selfMute).toBe(false);
    });
  });

  describe('resetClient()', () => {
    it('should stop beep', () => {
      logic.resetClient();
      expect(mockAudioStore.stopBeep).toHaveBeenCalled();
    });

    it('should disconnect', () => {
      logic.resetClient();
      expect(mockConnectionStore.disconnect).toHaveBeenCalled();
    });

    it('should clear thisUser', () => {
      mockUserStore.thisUser = { session: 1 };
      logic.resetClient();
      expect(mockUserStore.thisUser).toBeNull();
    });

    it('should reset loopback mode', () => {
      mockVoiceStore.isLoopbackMode = true;
      logic.resetClient();
      expect(mockVoiceStore.isLoopbackMode).toBe(false);
    });
  });

  describe('sendMessage()', () => {
    it('should not send when not connected', () => {
      mockUserStore.thisUser = null;
      const mockTarget = { model: { sendMessage: jest.fn() } };
      
      logic.sendMessage(mockTarget, 'Hello');
      
      expect(mockTarget.model.sendMessage).not.toHaveBeenCalled();
    });

    it('should send message to target with model', () => {
      mockUserStore.thisUser = { channel: {} };
      const mockTarget = { model: { sendMessage: jest.fn() } };
      
      logic.sendMessage(mockTarget, 'Hello');
      
      expect(mockTarget.model.sendMessage).toHaveBeenCalledWith('Hello');
    });

    it('should send message to target with value.model', () => {
      mockUserStore.thisUser = { channel: {} };
      const mockTarget = { value: { model: { sendMessage: jest.fn() } } };
      
      logic.sendMessage(mockTarget, 'Hello');
      
      expect(mockTarget.value.model.sendMessage).toHaveBeenCalledWith('Hello');
    });

    it('should use thisUser channel as default target', () => {
      const mockChannel = { model: { sendMessage: jest.fn() } };
      mockUserStore.thisUser = { channel: mockChannel };
      
      logic.sendMessage(null, 'Hello');
      
      expect(mockChannel.model.sendMessage).toHaveBeenCalledWith('Hello');
    });
  });

  describe('startLoopbackTest()', () => {
    it('should set loopback mode when already connected', async () => {
      mockUserStore.thisUser = { session: 1 };
      
      await logic.startLoopbackTest();
      
      expect(mockVoiceStore.isLoopbackMode).toBe(true);
    });

    it('should end existing voice handler when connected', async () => {
      mockUserStore.thisUser = { session: 1 };
      mockVoiceStore.voiceHandler = {};
      
      await logic.startLoopbackTest();
      
      expect(mockVoiceStore.setMute).toHaveBeenCalledWith(true);
      expect(mockVoiceStore.endVoiceHandler).toHaveBeenCalled();
    });

    it('should initialize beeper when connected', async () => {
      mockUserStore.thisUser = { session: 1 };
      
      await logic.startLoopbackTest();
      
      expect(mockAudioStore.initializePersistentBeeper).toHaveBeenCalled();
    });
  });

  describe('updateVoiceHandler()', () => {
    it('should call voiceStore.updateVoiceHandler', () => {
      logic.updateVoiceHandler();
      
      expect(mockVoiceStore.updateVoiceHandler).toHaveBeenCalled();
    });

    it('should mute when audio lock is active', () => {
      mockAudioStore.audioLockActive = true;
      mockVoiceStore.isLoopbackMode = false;
      
      logic.updateVoiceHandler();
      
      expect(mockVoiceStore.setMute).toHaveBeenCalledWith(true);
    });

    it('should not mute in loopback mode', () => {
      mockVoiceStore.isLoopbackMode = true;
      
      logic.updateVoiceHandler();
      
      expect(mockVoiceStore.setMute).toHaveBeenCalledWith(false);
    });
  });

  describe('performConnect()', () => {
    it('should setup voice for connection', async () => {
      await logic.connect('h', 1, 'u', 'p');
      
      expect(mockVoiceStore.setupVoiceForConnection).toHaveBeenCalledWith(true, null);
    });

    it('should show an error when voice setup fails', async () => {
      const setupError = new Error('Audio setup failed');
      mockVoiceStore.setupVoiceForConnection.mockRejectedValueOnce(setupError);

      await logic.connect('h', 1, 'u', 'p');

      expect(mockDialogStore.showErrorDialog).toHaveBeenCalledWith(
        setupError,
        expect.objectContaining({ host: 'h', port: 1 })
      );
      expect(mockConnectionStore.connect).not.toHaveBeenCalled();
      expect(mockVoiceStore.endVoiceHandler).toHaveBeenCalled();
      expect(mockConnectionStore.disconnect).toHaveBeenCalled();
    });

    it('should wait for voice capture readiness before connecting Mumble', async () => {
      const voiceReady = deferred();
      mockVoiceStore.setupVoiceForConnection.mockReturnValueOnce(voiceReady.promise);

      const connection = logic.connect('h', 1, 'u', 'p');
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();

      expect(mockConnectionStore.connect).not.toHaveBeenCalled();
      expect(mockStartGuacamoleFrame).not.toHaveBeenCalled();

      voiceReady.resolve(jest.fn());
      await connection;
      expect(mockConnectionStore.connect).toHaveBeenCalledTimes(1);
    });

    it('should set loopback mode if specified', async () => {
      await logic.connectLoopback('h', 1, 'u', 'p');
      
      expect(mockVoiceStore.isLoopbackMode).toBe(true);
    });

    it('should reject a dialog continuation after its auth session changes', async () => {
      mockAudioStore.audioContext = { sampleRate: 44100 };
      await logic.connect('h', 1, 'u', 'p');
      const connectionParams = mockDialogStore.sampleRateDialog.connectionParams;
      logic.resetClient();

      jest.clearAllMocks();
      await logic.performConnect(connectionParams, { audioEnabled: false });

      expect(mockVoiceStore.setupVoiceForConnection).not.toHaveBeenCalled();
      expect(mockConnectionStore.connect).not.toHaveBeenCalled();
      expect(mockStartGuacamoleFrame).not.toHaveBeenCalled();
    });

    it('should cancel the pending sample-rate continuation and restore the retry dialog', async () => {
      mockAudioStore.audioContext = { sampleRate: 44100 };
      await logic.connect('h', 1, 'u', 'p');
      const connectionParams = mockDialogStore.sampleRateDialog.connectionParams;

      logic.cancelConnect(connectionParams);

      expect(mockClearCredentials).toHaveBeenCalled();
      expect(mockVoiceStore.endVoiceHandler).toHaveBeenCalled();
      expect(mockDialogStore.showConnectDialog).toHaveBeenCalledTimes(1);
      jest.clearAllMocks();

      await logic.performConnect(connectionParams, { audioEnabled: false });

      expect(mockVoiceStore.setupVoiceForConnection).not.toHaveBeenCalled();
      expect(mockConnectionStore.connect).not.toHaveBeenCalled();
    });

    it('should stop attempt-owned voice capture when superseded during setup', async () => {
      const voiceSetup = deferred();
      const stopVoiceInput = jest.fn();
      mockVoiceStore.setupVoiceForConnection.mockImplementationOnce(() => voiceSetup.promise);

      const connection = logic.connect('h', 1, 'u', 'p');
      for (let attempt = 0; attempt < 10 && !mockVoiceStore.setupVoiceForConnection.mock.calls.length; attempt++) {
        await Promise.resolve();
      }
      expect(mockVoiceStore.setupVoiceForConnection).toHaveBeenCalledTimes(1);
      logic.resetClient();
      voiceSetup.resolve(stopVoiceInput);
      await connection;

      expect(stopVoiceInput).toHaveBeenCalledTimes(1);
      expect(mockConnectionStore.connect).not.toHaveBeenCalled();
    });
  });

  describe('connect() edge cases', () => {
    it('should alert when user has no app_metadata', async () => {
      mockAuth.getCurrentUser.mockResolvedValueOnce({ id: 'test-user' });
      mockAuth.getAccessToken.mockResolvedValueOnce(null);
      
      await logic.connect('host', 1234, 'user', 'pass');
      
      expect(globalThis.alert).toHaveBeenCalled();
    });

    it('should handle user without access_token gracefully', async () => {
      mockAuth.getAccessToken.mockResolvedValueOnce(null);
      
      await logic.connect('host', 1234, 'user', 'pass');
      
      // Should show auth error since no token available
      expect(globalThis.alert).toHaveBeenCalledWith(
        'Failed to authenticate. Please log in again.'
      );
    });

    it('should show sample rate dialog for non-48kHz audio', async () => {
      mockAudioStore.audioContext = { sampleRate: 44100 };
      
      await logic.connect('host', 1234, 'user', 'pass');
      
      expect(mockDialogStore.showSampleRateDialog).toHaveBeenCalled();
    });

    it('should skip sample rate check in loopback mode', async () => {
      mockAudioStore.audioContext = { sampleRate: 44100 };
      
      // Use connectLoopback instead of connect
      await logic.connectLoopback('host', 1234, 'user', 'pass');
      
      // Should not show sample rate dialog in loopback mode
      expect(mockDialogStore.showSampleRateDialog).not.toHaveBeenCalled();
    });
  });

  describe('connected()', () => {
    it('should return false when thisUser is null', () => {
      mockUserStore.thisUser = null;
      
      expect(logic.connected()).toBe(false);
    });

    it('should return true when thisUser exists', () => {
      mockUserStore.thisUser = { session: 1 };
      
      expect(logic.connected()).toBe(true);
    });
  });

  describe('disconnect()', () => {
    it('should call connectionStore.disconnect', async () => {
      logic.resetClient();
      
      expect(mockConnectionStore.disconnect).toHaveBeenCalled();
    });

    it('should reset loopback mode', async () => {
      mockVoiceStore.isLoopbackMode = true;
      
      logic.resetClient();
      
      expect(mockVoiceStore.isLoopbackMode).toBe(false);
    });
  });

  describe('connection error handling', () => {
    it('should roll back and show an error when Mumble connection fails', async () => {
      const testError = new Error('Connection refused');
      mockUIStore.guacamoleFrame = { stop: jest.fn() };
      mockDialogStore.connectDialog.isTestActive = true;
      mockConnectionStore.connect.mockRejectedValueOnce(testError);
      
      await logic.connect('host', 1234, 'user', 'pass');
      
      expect(mockDialogStore.showErrorDialog).toHaveBeenCalled();
      expect(mockUIStore.guacamoleFrame.stop).toHaveBeenCalled();
      expect(mockVoiceStore.endVoiceHandler).toHaveBeenCalled();
      expect(mockConnectionStore.disconnect).toHaveBeenCalled();
      expect(mockUserStore.thisUser).toBeNull();
      expect(mockVoiceStore.isLoopbackMode).toBe(false);
      expect(mockDialogStore.connectDialog.isTestActive).toBe(false);
    });
  });

  describe('_setupGuacamoleFrame edge cases', () => {
    it('should not show guacamole when no login in loopback mode', async () => {
      mockVoiceStore.isLoopbackMode = true;
      mockUIStore.guacamoleFrame = { start: jest.fn(), show: jest.fn() };
      
      await logic.connectLoopback('host', 1234, 'user', 'pass');
      
      // Should not call guacamole frame in loopback mode
      expect(mockUIStore.guacamoleFrame.start).not.toHaveBeenCalled();
    });
  });


  describe('updateVoiceHandler callbacks', () => {
    it('should update talking state on voice start', () => {
      mockUserStore.thisUser = { talking: { value: 'off' } };
      
      // Capture the callbacks passed to updateVoiceHandler
      mockVoiceStore.updateVoiceHandler = jest.fn((client, onStart, onEnd) => {
        // Call the onStart callback
        onStart();
      });
      
      logic.updateVoiceHandler();
      
      expect(mockUserStore.thisUser.talking.value).toBe('on');
    });

    it('should update talking state on voice end', () => {
      mockUserStore.thisUser = { talking: { value: 'on' } };
      
      // Capture the callbacks passed to updateVoiceHandler
      mockVoiceStore.updateVoiceHandler = jest.fn((client, onStart, onEnd) => {
        // Call the onEnd callback
        onEnd();
      });
      
      logic.updateVoiceHandler();
      
      expect(mockUserStore.thisUser.talking.value).toBe('off');
    });

    it('should reset loopback frequency on voice end in loopback mode', () => {
      mockUserStore.thisUser = { talking: { value: 'on' } };
      mockVoiceStore.isLoopbackMode = true;
      mockVoiceStore.loopbackDominantFrequency = 440;
      
      // Capture the callbacks passed to updateVoiceHandler
      mockVoiceStore.updateVoiceHandler = jest.fn((client, onStart, onEnd) => {
        // Call the onEnd callback
        onEnd();
      });
      
      logic.updateVoiceHandler();
      
      expect(mockVoiceStore.loopbackDominantFrequency).toBe(0);
    });
  });
});

