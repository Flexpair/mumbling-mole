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

const mockVoiceStore = {
  isLoopbackMode: false,
  voiceHandler: null,
  voiceHandlerReady: false,
  setupVoiceForConnection: jest.fn().mockResolvedValue(undefined),
  updateVoiceHandler: jest.fn(),
  setMute: jest.fn(),
  endVoiceHandler: jest.fn(),
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
  sampleRateDialog: { sampleRate: null, connectionParams: null },
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
    mockAudioStore.micPermissionDenied = false;
    mockAudioStore.beeperReady = false;
    mockVoiceStore.voiceHandlerReady = false;
    
    mockAuth = {
      currentUser: jest.fn(() => ({
        token: { access_token: 'test-jwt-token' },
        app_metadata: {
          roles: ['watch', 'listen'],
        },
      })),
      logout: jest.fn(),
    };
    
    // Reset credentials mock
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

  describe('getGuacamoleLogin', () => {
    it('should return admin for admin role', () => {
      expect(logic.getGuacamoleLogin(['admin'])).toBe('admin');
    });

    it('should return editor for edit role', () => {
      expect(logic.getGuacamoleLogin(['edit'])).toBe('editor');
    });

    it('should return watcher for watch role', () => {
      expect(logic.getGuacamoleLogin(['watch'])).toBe('watcher');
    });

    it('should return false for no matching role', () => {
      expect(logic.getGuacamoleLogin(['other'])).toBe(false);
    });

    it('should return false for empty roles', () => {
      expect(logic.getGuacamoleLogin([])).toBe(false);
    });

    it('should return false for undefined roles', () => {
      expect(logic.getGuacamoleLogin()).toBe(false);
    });

    it('should prioritize admin over other roles', () => {
      expect(logic.getGuacamoleLogin(['watch', 'admin', 'edit'])).toBe('admin');
    });
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
      
      expect(globalThis.alert).toHaveBeenCalledWith(
        'You do not have permission to connect to the server. Please contact the administrator.'
      );
    });

    it('should alert when credentials fetch fails', async () => {
      mockFetchCredentials.mockRejectedValue(new Error('Token expired'));
      
      await logic.connect('host', 64738, 'user', 'pass');
      
      expect(globalThis.alert).toHaveBeenCalledWith(
        'Failed to authenticate. Please log in again.'
      );
      expect(mockAuth.logout).toHaveBeenCalled();
    });

    it('should initialize AudioContext if not present', async () => {
      mockAudioStore.audioContext = null;
      
      await logic.connect('host', 64738, 'user', 'pass');
      
      expect(mockAudioStore.initializeAudioContext).toHaveBeenCalled();
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
  });

  describe('connectLoopback()', () => {
    it('should set loopback mode before connecting', async () => {
      await logic.connectLoopback('host', 64738, 'user', 'pass');
      
      expect(mockVoiceStore.isLoopbackMode).toBe(true);
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
      await logic.performConnect({ host: 'h', port: 1, username: 'u', password: 'p' }, { audioEnabled: true });
      
      expect(mockVoiceStore.setupVoiceForConnection).toHaveBeenCalledWith(true, null);
    });

    it('should show an error when voice setup fails', async () => {
      const setupError = new Error('Audio setup failed');
      mockVoiceStore.setupVoiceForConnection.mockRejectedValueOnce(setupError);

      await logic.performConnect(
        { host: 'h', port: 1, username: 'u', password: 'p' },
        { audioEnabled: true }
      );

      expect(mockDialogStore.showErrorDialog).toHaveBeenCalledWith(
        setupError,
        expect.objectContaining({ host: 'h', port: 1 })
      );
      expect(mockConnectionStore.connect).not.toHaveBeenCalled();
    });

    it('should set loopback mode if specified', async () => {
      await logic.performConnect({ host: 'h', port: 1, username: 'u', password: 'p', isLoopback: true }, {});
      
      expect(mockVoiceStore.isLoopbackMode).toBe(true);
    });
  });

  describe('connect() edge cases', () => {
    it('should alert when user has no app_metadata', async () => {
      mockAuth.currentUser.mockReturnValue({ app_metadata: null });
      
      await logic.connect('host', 1234, 'user', 'pass');
      
      expect(globalThis.alert).toHaveBeenCalled();
    });

    it('should handle user without access_token gracefully', async () => {
      mockAuth.currentUser.mockReturnValue({ 
        app_metadata: { roles: ['watch'] }
        // No token property
      });
      
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
    it('should show error dialog on connection failure', async () => {
      const testError = new Error('Connection refused');
      mockConnectionStore.connect.mockRejectedValueOnce(testError);
      
      await logic.connect('host', 1234, 'user', 'pass');
      
      expect(mockDialogStore.showErrorDialog).toHaveBeenCalled();
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

  describe('handleMicrophonePermission edge cases', () => {
    it('should handle missing mediaDevices API', async () => {
      const originalMediaDevices = navigator.mediaDevices;
      Object.defineProperty(navigator, 'mediaDevices', {
        value: undefined,
        configurable: true
      });
      
      // Should not throw when mediaDevices is undefined
      await expect(logic.connect('host', 1234, 'user', 'pass')).resolves.not.toThrow();
      
      // Restore
      Object.defineProperty(navigator, 'mediaDevices', {
        value: originalMediaDevices,
        configurable: true
      });
    });

    it('should set micPermissionDenied on getUserMedia error', async () => {
      const originalMediaDevices = navigator.mediaDevices;

      Object.defineProperty(navigator, 'mediaDevices', {
        value: {
          getUserMedia: jest.fn().mockRejectedValue(new Error('Permission denied'))
        },
        configurable: true
      });
      
      await logic.connect('host', 1234, 'user', 'pass');
      
      // Wait for async permission check
      await new Promise(resolve => setTimeout(resolve, 10));
      
      // Should have set permission denied
      expect(mockAudioStore.micPermissionDenied).toBe(true);
      
      // Restore
      Object.defineProperty(navigator, 'mediaDevices', {
        value: originalMediaDevices,
        configurable: true
      });
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

