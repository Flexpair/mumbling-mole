import { useConnectionStore } from '../stores/connectionStore';
import { useAudioStore } from '../stores/audioStore';
import { useVoiceStore } from '../stores/voiceStore';
import { useUIStore } from '../stores/uiStore';
import { useUserStore } from '../stores/userStore';
import { useSettingsStore } from '../stores/settingsStore';
import { useDialogStore } from '../stores/dialogStore';
import { translate } from '../localize';
import { fetchCredentials } from '../auth/credentials-service.js';
import { getGuacamoleLogin, getGuacamoleCredentials, startGuacamoleFrame, notifyGuacamoleUnavailable } from './useGuacamole';
import { registerExistingUsers, resetUIForConnection } from './useMumbleHelpers';

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
  
  // Connection tracking for race safety
  let _currentConnectionId = null;
  
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

  /**
   * Common connection setup for both normal and loopback modes
   * @private
   */
  async function _setupConnection(params) {
    const { host, port, username, tokens = [], isLoopback = false } = params;

    // Auth check
    if (!auth) {
      console.error('[useConnectionLogic] Auth provider not available');
      alert('Authentication system not initialized. Please refresh the page.');
      return;
    }
    
    const identity = auth.currentUser();
    if (!identity) {
      alert('You do not have permission to connect to the server. Please contact the administrator.');
      return;
    }

    // Fetch credentials from auth server (validates JWT server-side)
    let serverCredentials;
    try {
      const token = identity.token?.access_token || identity.access_token;
      if (!token) {
        throw new Error('No access token available');
      }
      serverCredentials = await fetchCredentials(token);
    } catch (error) {
      console.error('[useConnectionLogic] Failed to fetch credentials:', error);
      alert('Failed to authenticate. Please log in again.');
      auth.logout();
      return;
    }

    // Use server-provided password
    const password = serverCredentials.mumblePassword;

    // Initialize AudioContext
    if (!audioStore.audioContext) {
      await audioStore.initializeAudioContext();
    }

    // Sample rate check (ONLY for normal mode, skip in loopback)
    if (!isLoopback) {
      const currentSampleRate = audioStore.audioContext ? audioStore.audioContext.sampleRate : null;
      const audioCompatible = currentSampleRate === 48000;
      
      if (!audioCompatible) {
        const connectionParams = { host, port, username, password, tokens, serverCredentials };
        dialogStore.sampleRateDialog.sampleRate = currentSampleRate;
        dialogStore.sampleRateDialog.connectionParams = connectionParams;
        dialogStore.showSampleRateDialog();
        return;
      }
    }

    // Prepare connection parameters
    const connectionParams = {
      host, 
      port, 
      username, 
      password, 
      tokens,
      isLoopback,
      serverCredentials
    };

    // Request microphone permission
    const connectionId = isLoopback ? Symbol('loopback-connection') : Symbol('connection');
    _currentConnectionId = connectionId;
    
    if (navigator.mediaDevices?.getUserMedia) {
      navigator.mediaDevices.getUserMedia({ audio: true })
        .then(stream => {
          // RACE-SAFE: Only update state if this connection is still active
          if (_currentConnectionId === connectionId) {
            audioStore.micPermissionDenied = false;
          }
          // Always stop tracks to avoid mic staying active
          for (const track of stream.getTracks()) {
            track.stop();
          }
        })
        .catch(err => {
          console.warn('Microphone permission denied:', err);
          // RACE-SAFE: Only update state if this connection is still active
          if (_currentConnectionId === connectionId) {
            audioStore.micPermissionDenied = true;
          }
        });
    }

    // Clear audio lock
    audioStore.clearAudioLock({ resetStates: true });

    // Loopback-specific setup
    if (isLoopback) {
      voiceStore.isLoopbackMode = true;
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
    const { host, port, username, password, tokens = [], serverCredentials } = connectionParams;
    const isLoopback = connectionParams.isLoopback || false;

    if (isLoopback) {
      voiceStore.isLoopbackMode = true;
    }

    try {
      // Setup voice/audio before opening the Mumble connection.
      // Keep this inside the same error boundary so audio initialization
      // failures are visible instead of silently aborting the handoff.
      await voiceStore.setupVoiceForConnection(audioEnabled, sampleRate);

      // Reset UI state
      resetUIForConnection(audioStore, userStore, voiceStore);

      await _establishClientConnection(host, port, username, password, tokens, serverCredentials);
    } catch (err) {
      console.error('Connection failed:', err);
      if (dialogStore) {
         dialogStore.showErrorDialog(err, connectionParams);
      } else {
         alert('Connection failed: ' + err.message);
      }
    }
  }

  /**
   * Establish client connection and setup
   * @private
   */
  async function _establishClientConnection(host, port, username, password, tokens, serverCredentials) {
    const client = await connectionStore.connect(host, port, username, password, tokens);
    
    _initializeGuacamole(serverCredentials, password);
    
    const logKey = voiceStore.isLoopbackMode ? 'logentry.connected_loopback' : 'logentry.connected';
    console.log(translate(logKey));

    _initializeClientState(client);
    _initializeAudio(client);
  }

  function _initializeGuacamole(serverCredentials, password) {
    if (voiceStore.isLoopbackMode) return;

    const guacCreds = getGuacamoleCredentials(serverCredentials, password, auth);
    if (guacCreds.user) {
      startGuacamoleFrame(guacCreds.user, guacCreds.password, uiStore);
    } else {
      notifyGuacamoleUnavailable();
    }
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
  const resetClient = () => {
    // Clear message confirmation timer
    if (_messageConfirmationTimer) {
      clearTimeout(_messageConfirmationTimer);
      _messageConfirmationTimer = null;
    }
    
    _currentConnectionId = null;
    audioStore.stopBeep();
    connectionStore.disconnect();
    userStore.thisUser = null;
    
    const wasLoopback = voiceStore.isLoopbackMode;
    voiceStore.isLoopbackMode = false;
    
    if (!wasLoopback) {
      audioStore.beeperReady = false;
      voiceStore.voiceHandlerReady = false;
    }
  };

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
    performConnect: _performConnect, // Export for SampleRateWarningDialog
    getGuacamoleLogin // Export for ConnectDialog
  };
}
