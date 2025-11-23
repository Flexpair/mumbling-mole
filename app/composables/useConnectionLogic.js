import { useConnectionStore } from '../stores/connectionStore';
import { useAudioStore } from '../stores/audioStore';
import { useVoiceStore } from '../stores/voiceStore';
import { useUIStore } from '../stores/uiStore';
import { useUserStore } from '../stores/userStore';
import { useSampleRateWarningDialog } from './index';
import { translate } from '../localize';

/**
 * Composable for connection orchestration logic
 * Replaces the connection logic previously in AppState.js
 */
export function useConnectionLogic() {
  const connectionStore = useConnectionStore();
  const audioStore = useAudioStore();
  const voiceStore = useVoiceStore();
  const uiStore = useUIStore();
  const userStore = useUserStore();
  
  const sampleRateWarningDialog = useSampleRateWarningDialog();
  
  // External dependencies (injected or accessed via global config)
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
  async function connect(host, port, username, password, tokens = [], channelName = '') {
    await _setupConnection({
      host, 
      port, 
      username, 
      password, 
      tokens, 
      channelName,
      isLoopback: false
    });
  }

  /**
   * Connect in loopback test mode
   */
  async function connectLoopback(host, port, username, password, tokens = [], channelName = '') {
    await _setupConnection({
      host, 
      port, 
      username, 
      password, 
      tokens, 
      channelName,
      isLoopback: true
    });
  }

  /**
   * Common connection setup for both normal and loopback modes
   * @private
   */
  async function _setupConnection(params) {
    const { host, port, username, password, tokens = [], channelName = '', isLoopback = false } = params;

    // Auth check
    // Note: We need to access auth provider. 
    // Ideally this should be injected or in a store, but for now we access it via global or passed param
    const auth = globalThis.mumbleUi?.auth;
    const identity = auth?.currentUser();
    if (!identity?.app_metadata) {
      alert('You do not have permission to connect to the server. Please contact the administrator.');
      return;
    }

    // Ensure required roles
    let user_roles = identity.app_metadata.roles || [];
    if (!Array.isArray(user_roles)) {
      user_roles = [];
    }

    if (!user_roles.includes('watch')) user_roles.push('watch');
    if (!user_roles.includes('listen')) user_roles.push('listen');
    identity.app_metadata.roles = user_roles;

    // Initialize AudioContext
    if (!audioStore.audioContext) {
      await audioStore.initializeAudioContext();
    }

    // Sample rate check (ONLY for normal mode, skip in loopback)
    if (!isLoopback) {
      const currentSampleRate = audioStore.audioContext ? audioStore.audioContext.sampleRate : null;
      const audioCompatible = currentSampleRate === 48000;
      
      if (!audioCompatible) {
        const connectionParams = { host, port, username, password, tokens, channelName };
        sampleRateWarningDialog.show(currentSampleRate, connectionParams);
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
      channelName,
      isLoopback
    };

    // Request microphone permission
    const connectionId = isLoopback ? Symbol('loopback-connection') : Symbol('connection');
    _currentConnectionId = connectionId;
    
    if (navigator.mediaDevices?.getUserMedia) {
      navigator.mediaDevices
        .getUserMedia({ audio: true })
        .then((stream) => {
          // RACE-SAFE: Only update state if this connection is still active
          if (_currentConnectionId === connectionId) {
            audioStore.micPermissionDenied = false;
          }
          // Always stop tracks to avoid mic staying active
          for (const track of stream.getTracks()) {
            track.stop();
          }
        })
        .catch((err) => {
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
    const { host, port, username, password, tokens = [], channelName: targetChannel = '' } = connectionParams;
    const isLoopback = connectionParams.isLoopback || false;

    if (isLoopback) {
      voiceStore.isLoopbackMode = true;
    }

    // Setup voice/audio
    await voiceStore.setupVoiceForConnection(audioEnabled, sampleRate);

    // Reset UI state
    _resetUIForConnection();

    try {
      await _establishClientConnection(host, port, username, password, tokens, targetChannel);
    } catch (err) {
      console.error('Connection failed:', err);
      // Handle connection error
      // Note: Error dialog handling might need to be triggered here or in the caller
      // For now we just log it, as the original code did (mostly)
      if (globalThis.mumbleUi?.connectErrorDialog) {
         globalThis.mumbleUi.connectErrorDialog.show(err, connectionParams);
      } else {
         alert('Connection failed: ' + err.message);
      }
    }
  }

  /**
   * Reset UI state for new connection
   * @private
   */
  function _resetUIForConnection() {
    audioStore.stopBeep();
    userStore.thisUser = null;
    
    const wasLoopback = voiceStore.isLoopbackMode;
    if (!wasLoopback) {
      audioStore.beeperReady = false;
      voiceStore.voiceHandlerReady = false;
    }
  }

  /**
   * Establish client connection and setup
   * @private
   */
  async function _establishClientConnection(host, port, username, password, tokens, channelName) {
    const client = await connectionStore.connect(host, port, username, password, tokens);
    
    const auth = globalThis.mumbleUi?.auth;
    const user_roles = (auth?.currentUser()?.app_metadata?.roles) || [];
    let guac_login = false;
    if (user_roles.includes('admin')) {
      guac_login = 'admin';
    } else if (user_roles.includes('edit')) {
      guac_login = 'editor';
    } else if (user_roles.includes('watch')) {
      guac_login = 'watcher';
    }
    
    // Setup Guacamole
    _setupGuacamoleFrame(guac_login, password);
    
    if (voiceStore.isLoopbackMode) {
      console.log(translate('logentry.connected_loopback'));
    } else {
      console.log(translate('logentry.connected'));
    }

    // Register root channel and self user
    connectionStore.registerChannel(client.root);
    
    if (client.self) {
      userStore.registerUser(client.self);
      userStore.thisUser = client.self.__ui;
    }

    // CRITICAL: Register voice listeners for all existing users in the channel
    for (const user of client.users.values()) {
      if (user !== client.self) {
        userStore.registerUser(user);
      }
    }

    _setupClientHandlers(client);
    
    // CRITICAL: Set audio quality BEFORE creating voice handler
    const settings = globalThis.mumbleUi?.settings;
    if (settings) {
        // Extract and validate settings values with fallbacks
        const samplesPerPacket = settings.samplesPerPacket?.value || 960;
        const audioBitrate = settings.audioBitrate?.value || 40000;
        
        console.log('[DEBUG] setAudioQuality called with:', { audioBitrate, samplesPerPacket });
        
        client.setAudioQuality(audioBitrate, samplesPerPacket);
    }

    // Initialize voice handler
    updateVoiceHandler();

    // Join target channel if specified
    if (channelName) {
      // Find channel by name (simple search)
      // Note: This logic was implicit in original code or handled by client?
      // Original code didn't seem to have explicit channel join logic in _establishClientConnection
      // It might be handled by the server or client lib if passed in connect options?
      // Checking mumble-client connect options... it doesn't seem to take channelName.
      // The original AppState.js passed channelName to _setupConnection but didn't seem to use it in _establishClientConnection
      // except passing it through.
      // Wait, looking at AppState.js again...
      // It passes channelName to _establishClientConnection but doesn't use it there.
      // It seems unused in the original code too?
    }
  }

  /**
   * Setup Guacamole frame if needed
   * @private
   */
  function _setupGuacamoleFrame(guac_login, password) {
    if (guac_login && !voiceStore.isLoopbackMode) {
      if (uiStore.guacamoleFrame) {
        uiStore.guacamoleFrame.start(guac_login, password);
        uiStore.guacamoleFrame.show();
      }
    } else if (!guac_login && !voiceStore.isLoopbackMode) {
      alert('For visual access please ask your administrator.');
    }
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
    // Access settings via global ui object (set in index.js)
    const settings = globalThis.mumbleUi?.settings;
    if (!settings) {
      console.error('[updateVoiceHandler] settings not available yet');
      return;
    }

    voiceStore.updateVoiceHandler(
      connectionStore.getClient(),
      settings,
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
        userStore.settings.audioBitrate.value,
        userStore.settings.samplesPerPacket.value
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
      } else if (target.value && target.value.model) {
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
    updateVoiceHandler
  };
}
