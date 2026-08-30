import { useConnectionStore } from '../stores/connectionStore';
import { useAudioStore } from '../stores/audioStore';
import { useVoiceStore } from '../stores/voiceStore';
import { useUIStore } from '../stores/uiStore';
import { useUserStore } from '../stores/userStore';
import { useSettingsStore } from '../stores/settingsStore';
import { useDialogStore } from '../stores/dialogStore';
import { translate } from '../localize';
import { clearCredentials, fetchCredentials } from '../auth/credentials-service.js';
import { startGuacamoleFrame } from './useGuacamole';
import { registerExistingUsers, resetUIForConnection } from './useMumbleHelpers';
import {
  beginConnectionAttempt,
  invalidateConnectionAttempt,
  isConnectionAttemptCurrent,
} from './connectionAttempt.js';
import { logoutForReauthentication } from './useAuthLogout.js';

const CONNECTION_CANCELLED_CODES = new Set([
  'CONNECTION_ATTEMPT_SUPERSEDED',
  'CREDENTIALS_REQUEST_SUPERSEDED',
  'GUACAMOLE_START_CANCELLED',
  'VOICE_CAPTURE_CANCELLED',
]);

function isConnectionCancellation(error) {
  return CONNECTION_CANCELLED_CODES.has(error?.code);
}

/**
 * Composable for connection orchestration logic
 * Replaces the connection logic previously in AppState.js
 * 
 * @param {Object} options - Injected dependencies
 * @param {Object} options.auth - Auth provider instance
 * @returns {Object} Connection logic methods
 */
export function useConnectionLogic({ auth } = {}) {
  const connectionStore = useConnectionStore();
  const audioStore = useAudioStore();
  const voiceStore = useVoiceStore();
  const uiStore = useUIStore();
  const userStore = useUserStore();
  const settingsStore = useSettingsStore();
  
  const dialogStore = useDialogStore();
  
  // External dependencies
  const config = globalThis.mumbleWebConfig || {};
  
  // Timer tracking for message confirmation
  let _messageConfirmationTimer = null;

  /**
   * Check if connected
   * @returns {boolean}
   */
  const connected = () => {
    return userStore.thisUser != null;
  };

  /**
   * Connect to Mumble server
   */
  async function connect(host, port, username, password, tokens = []) {
    await _setupConnection({
      host, 
      port, 
      username, 
      password, 
      tokens,
      isLoopback: false
    });
  }

  /**
   * Connect in loopback test mode
   */
  async function connectLoopback(host, port, username, password, tokens = []) {
    await _setupConnection({
      host, 
      port, 
      username, 
      password, 
      tokens,
      isLoopback: true
    });
  }

  async function _ensureAuthenticated(attempt) {
    let identity;
    try {
      identity = await auth.getCurrentUser();
    } catch (error) {
      if (!isConnectionAttemptCurrent(attempt)) return false;
      console.error('[useConnectionLogic] Failed to read authentication session:', error);
    }

    if (!isConnectionAttemptCurrent(attempt)) return false;
    if (identity) return true;

    await _requestLogin();
    return false;
  }

  async function _fetchServerCredentials(attempt) {
    try {
      const token = await auth.getAccessToken();
      if (!isConnectionAttemptCurrent(attempt)) return null;
      if (!token) throw new Error('No access token available');

      const serverCredentials = await fetchCredentials(token);
      if (!isConnectionAttemptCurrent(attempt)) return null;
      return serverCredentials;
    } catch (error) {
      if (!isConnectionAttemptCurrent(attempt) || isConnectionCancellation(error)) return null;
      console.error('[useConnectionLogic] Failed to fetch credentials:', error);
      await _requestLogin({ logout: true });
      return null;
    }
  }

  async function _initializeAudioContext(attempt, connectionParams) {
    if (audioStore.audioContext) return isConnectionAttemptCurrent(attempt);

    try {
      const audioContext = await audioStore.initializeAudioContext();
      if (!isConnectionAttemptCurrent(attempt)) return false;
      if (!audioContext && !audioStore.audioContext) {
        throw new Error('AudioContext initialization failed');
      }
      return true;
    } catch (error) {
      _handleConnectionFailure(error, connectionParams, attempt);
      return false;
    }
  }

  /**
   * Common connection setup for both normal and loopback modes
   * @private
   */
  async function _setupConnection(params) {
    const { host, port, username, tokens = [], isLoopback = false } = params;
    _resetConnection();
    dialogStore.connectDialog.isTestActive = isLoopback;
    const attempt = beginConnectionAttempt();

    // Auth check
    if (!auth) {
      console.error('[useConnectionLogic] Auth provider not available');
      alert('Authentication system not initialized. Please refresh the page.');
      return;
    }

    if (!(await _ensureAuthenticated(attempt))) return;

    // Fetch credentials from auth server (validates JWT server-side)
    const serverCredentials = await _fetchServerCredentials(attempt);
    if (!serverCredentials) return;

    // Use server-provided password
    const password = serverCredentials.mumblePassword;

    const connectionParams = {
      host,
      port,
      username,
      password,
      tokens,
      isLoopback,
      serverCredentials,
      attempt,
    };

    if (!(await _initializeAudioContext(attempt, connectionParams))) return;

    // Sample rate check (ONLY for normal mode, skip in loopback)
    if (!isLoopback) {
      const currentSampleRate = audioStore.audioContext ? audioStore.audioContext.sampleRate : null;
      const audioCompatible = currentSampleRate === 48000;
      
      if (!audioCompatible) {
        dialogStore.sampleRateDialog.sampleRate = currentSampleRate;
        dialogStore.sampleRateDialog.connectionParams = connectionParams;
        dialogStore.showSampleRateDialog();
        return;
      }
    }

    // Clear audio lock
    audioStore.clearAudioLock({ resetStates: true });

    voiceStore.isLoopbackMode = isLoopback;
    if (isLoopback) {
      // Ensure microphone is NOT muted for loopback test
      userStore.selfMute = false;
    }
    
    // Perform connection
    await _performConnect(connectionParams, { audioEnabled: true });
  }

  /**
   * Perform the actual connection
   * @private
   */
  async function _performConnect(connectionParams, { audioEnabled = true, sampleRate = null } = {}) {
    const { host, port, username, password, tokens = [], serverCredentials, attempt } = connectionParams;
    const isLoopback = connectionParams.isLoopback || false;

    if (!attempt || !isConnectionAttemptCurrent(attempt)) return;

    if (isLoopback) {
      voiceStore.isLoopbackMode = true;
    }

    try {
      // Setup voice/audio before opening the Mumble connection.
      // Keep this inside the same error boundary so audio initialization
      // failures are visible instead of silently aborting the handoff.
      const stopVoiceInput = await voiceStore.setupVoiceForConnection(audioEnabled, sampleRate);
      if (!isConnectionAttemptCurrent(attempt)) {
        stopVoiceInput?.();
        return;
      }

      // Reset UI state
      resetUIForConnection(audioStore, userStore, voiceStore);

      await _establishClientConnection(host, port, username, password, tokens, serverCredentials, attempt);
    } catch (err) {
      _handleConnectionFailure(err, connectionParams, attempt);
    }
  }

  /**
   * Establish client connection and setup
   * @private
   */
  async function _establishClientConnection(host, port, username, password, tokens, serverCredentials, attempt) {
    const client = await connectionStore.connect(host, port, username, password, tokens);
    if (!isConnectionAttemptCurrent(attempt)) {
      if (connectionStore.getClient() === client) {
        connectionStore.disconnect();
      } else {
        client.disconnect();
      }
      return;
    }

    _initializeClientState(client);
    _initializeAudio(client);
    await _initializeGuacamole(serverCredentials);
    if (!isConnectionAttemptCurrent(attempt)) return;

    const logKey = voiceStore.isLoopbackMode ? 'logentry.connected_loopback' : 'logentry.connected';
    console.log(translate(logKey));
  }

  function _resetConnection() {
    if (_messageConfirmationTimer) {
      clearTimeout(_messageConfirmationTimer);
      _messageConfirmationTimer = null;
    }

    invalidateConnectionAttempt();
    uiStore.guacamoleFrame?.stop?.();
    audioStore.stopBeep();
    voiceStore.reset();
    userStore.thisUser = null;
    dialogStore.connectDialog.isTestActive = false;
    audioStore.beeperReady = false;
    connectionStore.disconnect();
  }

  function cancelConnect(connectionParams) {
    const attempt = connectionParams?.attempt;
    if (!attempt || !isConnectionAttemptCurrent(attempt)) return;

    clearCredentials();
    _resetConnection();
    dialogStore.showConnectDialog();
  }

  function _handleConnectionFailure(error, connectionParams, attempt) {
    if (isConnectionCancellation(error) || !isConnectionAttemptCurrent(attempt)) return;

    _resetConnection();
    console.error('Connection failed:', error);
    if (dialogStore) {
      dialogStore.showErrorDialog(error, connectionParams);
    } else {
      alert('Connection failed: ' + error.message);
    }
  }

  async function _requestLogin({ logout = false } = {}) {
    clearCredentials();
    _resetConnection();
    alert('Failed to authenticate. Please log in again.');

    if (logout) {
      try {
        await logoutForReauthentication(auth);
      } catch (error) {
        console.error('[useConnectionLogic] Failed to clear authentication session:', error);
      }
    }

    try {
      await auth.openAuth('login');
    } catch (error) {
      console.error('[useConnectionLogic] Failed to open authentication:', error);
    }
  }

  async function _initializeGuacamole(serverCredentials) {
    if (voiceStore.isLoopbackMode) return;

    await startGuacamoleFrame(
      serverCredentials.guacamoleUser,
      serverCredentials.guacamolePassword,
      uiStore
    );
  }

  function _initializeClientState(client) {
    connectionStore.registerChannel(client.root);
    if (client.self) {
      userStore.registerUser(client.self);
      userStore.thisUser = client.self.__ui;
    }
    registerExistingUsers(client, userStore);
    _setupClientHandlers(client);
  }

  function _initializeAudio(client) {
    const samplesPerPacket = settingsStore.samplesPerPacket || 960;
    const audioBitrate = settingsStore.audioBitrate || 40000;
    client.setAudioQuality(audioBitrate, samplesPerPacket);
    updateVoiceHandler();
  }

  /**
   * Setup minimal client event handlers
   * @private
   */
  function _setupClientHandlers(client) {
    // Register voice listeners for other users joining
    client.on('newUser', (user) => {
      userStore.registerUser(user);
    });
    
    // Listen for messageSent event
    client.on('messageSent', (messageText) => {
      if (_messageConfirmationTimer) {
        clearTimeout(_messageConfirmationTimer);
      }
      
      uiStore.messageConfirmed = true;
      
      _messageConfirmationTimer = setTimeout(() => {
        uiStore.messageConfirmed = false;
        _messageConfirmationTimer = null;
      }, 2000);
    });
  }

  /**
   * Update voice handler
   */
  function updateVoiceHandler() {
    voiceStore.updateVoiceHandler(
      connectionStore.getClient(),
      () => {
        if (userStore.thisUser) {
          userStore.thisUser.talking.value = 'on';
        }
      },
      () => {
        if (userStore.thisUser) {
          userStore.thisUser.talking.value = 'off';
        }
        if (voiceStore.isLoopbackMode) {
          voiceStore.loopbackDominantFrequency = 0;
        }
      }
    );
    
    if (voiceStore.isLoopbackMode) {
      voiceStore.setMute(false);
    } else if (audioStore.audioLockActive || userStore.selfMute) {
      voiceStore.setMute(true);
    }

    const client = connectionStore.getClient();
    if (client) {
      client.setAudioQuality(
        settingsStore.audioBitrate,
        settingsStore.samplesPerPacket
      );
    }
  }

  /**
   * Start loopback test on existing connection
   */
  const startLoopbackTest = async () => {
    if (connected()) {
      voiceStore.isLoopbackMode = true;
      
      if (voiceStore.voiceHandler) {
        voiceStore.setMute(true);
        voiceStore.endVoiceHandler();
      }
      
      updateVoiceHandler();
      await audioStore.initializePersistentBeeper();
    } else {
      const host = config.defaults?.host || 'localhost';
      const port = config.defaults?.port || 64738;
      const username = config.defaults?.username || 'WebClient';
      const password = config.defaults?.password || '';
      connectLoopback(host, port, username, password);
    }
  };

  /**
   * Reset client and all state
   */
  const resetClient = () => _resetConnection();

  /**
   * Send message to channel or user
   */
  const sendMessage = (target, message) => {
    if (connected()) {
      if (!target) {
        target = userStore.thisUser?.channel;
      }
      if (!target) {
        return;
      }
      if (target.model) {
        target.model.sendMessage(message);
      } else if (target.value?.model) {
         target.value.model.sendMessage(message);
      }
    }
  };

  return {
    connect,
    connectLoopback,
    startLoopbackTest,
    resetClient,
    sendMessage,
    connected,
    updateVoiceHandler,
    cancelConnect,
    performConnect: _performConnect // Export for SampleRateWarningDialog
  };
}
