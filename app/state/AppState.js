import { watch, ref, computed } from 'vue';
import {
  useConnectionState,
  useAudioState,
  useVoiceState,
  useUIState,
  useUserState,
  useConnectionDialog,
  useConnectErrorDialog,
  useSampleRateWarningDialog,
  useConnectionInfo,
} from '../composables';
import { translate } from '../localize';
import packageJson from '../../package.json';

/**
 * AppState - main state coordinator
 * 
 * Composes all state modules using Vue 3 composables.
 * Provides a centralized API for application-wide state management.
 * 
 * Architecture:
 * - ConnectionState: client connection, root user/channel setup
 * - AudioState: AudioContext, beeper, audio pipeline
 * - VoiceState: voice handler, loopback mode, voice controls
 * - UIState: modals, message box, settings dialog
 * - UserState: current user, self mute/deaf, user registration, voice streams
 * 
 * State management:
 * - All state uses Vue 3 reactive primitives (ref, computed, watch)
 * - Composables provide modular, reusable state logic
 * - Cross-module dependencies handled via watchers and subscriptions
 */
export default class AppState {
  constructor(config, log) {
    this.config = config;
    this.log = log || console.log.bind(console);
    
    // Store Vue runtime for creating refs/computed
    this._vue = { ref, computed };
    
    // Initialize Vue composables (source of truth)
    const connectionState = useConnectionState(this.log);
    const audioState = useAudioState();
    const voiceState = useVoiceState();
    const uiState = useUIState();
    const userState = useUserState(audioState, voiceState, connectionState);
    const connectionDialog = useConnectionDialog();
    const connectErrorDialog = useConnectErrorDialog();
    const sampleRateWarningDialog = useSampleRateWarningDialog();
    const connectionInfo = useConnectionInfo();
    
    // Store composable references
    this._vueState = {
      connection: connectionState,
      audio: audioState,
      voice: voiceState,
      ui: uiState,
      user: userState,
      dialog: connectionDialog,
      errorDialog: connectErrorDialog,
      sampleRateDialog: sampleRateWarningDialog,
      connectionInfoDialog: connectionInfo,
    };
    
    // External dependencies (set during initialization)
    this.settings = null; // Set externally from index.js
    this.guacamoleFrame = null; // Set externally from index.js
    this.auth = null; // Set externally from index.js
    
    // Guacamole credentials storage
    this._guacLogin = null;
    this._guacPassword = null;
    
    // Connection tracking for race safety
    this._currentConnectionId = null;
    
    // Timer tracking for message confirmation
    this._messageConfirmationTimer = null;
    
    // Set up cross-module subscriptions
    this._setupSubscriptions();
    
    // Initialize lazy computed properties after _vueState is ready
    this._initializeComputedProperties();
  }

  /**
   * Initialize computed properties (called after _vueState is ready)
   * @private
   */
  _initializeComputedProperties() {
    // Message box placeholder hint
    this.messageBoxHint = this._vue.computed(() => {
      if (!this._vueState.user.thisUser.value) {
        return '';
      }
      // With markRaw, channel is a ref that might be undefined
      const channelRef = this._vueState.user.thisUser.value.channel;
      if (!channelRef?.value) {
        return '';
      }
      const target = channelRef.value;
      if (!target?.name) {
        return '';
      }
      return translate('chat.channel_message_placeholder').replace('%1', target.name.value);
    });
    
    // Mailto link for desktop attachment
    this.mailToDesktop = this._vue.ref(
      'mailto:mail@' +
      globalThis.location.hostname +
      '?subject=Send%20attachment%20to%20desktop'
    );
  }

  /**
   * Set up reactive subscriptions between modules
   * @private
   */
  _setupSubscriptions() {
    // When selfMute changes, update voice handler
    watch(() => this._vueState.user.selfMute.value, (mute) => {
      this._vueState.voice.setMute(mute);
    });
  }

  // ============================================================
  // PUBLIC API - Expose module functionality
  // ============================================================

  /**
   * Check if connected
   * @returns {boolean}
   */
  connected = () => {
    return this._vueState.user.thisUser.value != null;
  }

  /**
   * Get current client
   * @returns {object|null}
   */
  getClient = () => {
    return this._vueState.connection.getClient();
  }

  /**
   * Connect to Mumble server
   */
  async connect(host, port, username, password, tokens = [], channelName = '') {
    await this._setupConnection({
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
  async connectLoopback(host, port, username, password, tokens = [], channelName = '') {
    await this._setupConnection({
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
   * REFACTORED: Eliminates 78 lines of code duplication (Nov 10, 2025)
   * @private
   */
  async _setupConnection(params) {
    const { host, port, username, password, tokens = [], channelName = '', isLoopback = false } = params;

    // Auth check (common for both modes)
    const identity = this.auth.currentUser();
    if (!identity?.app_metadata) {
      alert('You do not have permission to connect to the server. Please contact the administrator.');
      return;
    }

    // Ensure required roles (common for both modes)
    let user_roles = identity.app_metadata.roles || [];
    if (!Array.isArray(user_roles)) {
      user_roles = [];
    }

    if (!user_roles.includes('watch')) user_roles.push('watch');
    if (!user_roles.includes('listen')) user_roles.push('listen');
    identity.app_metadata.roles = user_roles;

    // Initialize AudioContext (common for both modes)
    if (!this._vueState.audio.audioContext) {
      await this._vueState.audio.initializeAudioContext();
    }

    // Sample rate check (ONLY for normal mode, skip in loopback)
    if (!isLoopback) {
      const currentSampleRate = this._vueState.audio.audioContext ? this._vueState.audio.audioContext.sampleRate : null;
      const audioCompatible = currentSampleRate === 48000;
      
      if (!audioCompatible) {
        const connectionParams = { host, port, username, password, tokens, channelName };
        this.sampleRateWarningDialog.show(currentSampleRate, connectionParams);
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

    // Request microphone permission (common for both modes)
    // Store connection ID to detect if connection was cancelled during async operations
    const connectionId = isLoopback ? Symbol('loopback-connection') : Symbol('connection');
    this._currentConnectionId = connectionId;
    
    if (navigator.mediaDevices?.getUserMedia) {
      navigator.mediaDevices
        .getUserMedia({ audio: true })
        .then((stream) => {
          // RACE-SAFE: Only update state if this connection is still active
          if (this._currentConnectionId === connectionId) {
            this._vueState.audio.micPermissionDenied.value = false;
          }
          // Always stop tracks to avoid mic staying active
          for (const track of stream.getTracks()) {
            track.stop();
          }
        })
        .catch((err) => {
          console.warn('Microphone permission denied:', err);
          // RACE-SAFE: Only update state if this connection is still active
          if (this._currentConnectionId === connectionId) {
            this._vueState.audio.micPermissionDenied.value = true;
          }
        });
    }

    // Clear audio lock (common for both modes)
    this._vueState.audio.clearAudioLock({ resetStates: true });

    // Loopback-specific setup
    if (isLoopback) {
      this._vueState.voice.isLoopbackMode.value = true;
      // Ensure microphone is NOT muted for loopback test
      this._vueState.user.selfMute.value = false;
    }
    
    // Perform connection (common for both modes)
    await this._performConnect(connectionParams, { audioEnabled: true });
  }

  /**
   * Start loopback test on existing connection
   */
  startLoopbackTest = async () => {
    if (this.connected()) {
      this._vueState.voice.isLoopbackMode.value = true;
      
      if (this._vueState.voice.voiceHandler) {
        this._vueState.voice.setMute(true);
        this._vueState.voice.endVoiceHandler();
      }
      
      this._updateVoiceHandler();
      await this._vueState.audio.initializePersistentBeeper();
    } else {
      const host = this.config.defaults.host || 'localhost';
      const port = this.config.defaults.port || 64738;
      const username = this.config.defaults.username || 'WebClient';
      const password = this.config.defaults.password || '';
      this.connectLoopback(host, port, username, password);
    }
  }

  /**
   * Setup audio for connection
   * @private
   */
  async _setupAudioForConnection(audioEnabled, sampleRate, isLoopback) {
    if (audioEnabled) {
      this._vueState.voice.initVoiceInput(
        (data) => {
          if (this._vueState.connection.getClient()) {
            this._vueState.voice.writeVoiceData(data);
          } else {
            this._vueState.voice.endVoiceHandler();
          }
        },
        (err) => {
          this.log(translate('logentry.mic_init_error'), err);
        },
        () => {
          this._vueState.audio.initializePersistentBeeper();
        }
      );
    } else {
      this._vueState.audio.activateAudioLock('sample-rate', { sampleRate });
      this._vueState.voice.endVoiceHandler();
    }

    try {
      await this._vueState.audio.resumeAudioContext();
      
      try {
        await this._vueState.audio.loadAudioWorkletModule('playback-buffer-processor.js');
      } catch (err) {
        console.warn('[AUDIO-INIT] Playback AudioWorklet pre-warm failed:', err);
      }
    } catch (error) {
      console.warn('AudioContext resume failed, continuing anyway:', error);
    }
  }

  /**
   * Reset UI state for new connection
   * @private
   */
  _resetUIForConnection() {
    this._vueState.audio.stopBeep();
    this._vueState.user.thisUser.value = null;
    
    const wasLoopback = this._vueState.voice.isLoopbackMode.value;
    if (!wasLoopback) {
      this._vueState.audio.beeperReady.value = false;
      this._vueState.voice.voiceHandlerReady.value = false;
    }
  }

  /**
   * Setup Guacamole frame if needed
   * @private
   */
  _setupGuacamoleFrame(guac_login) {
    if (guac_login && !this._vueState.voice.isLoopbackMode.value) {
      this.guacamoleFrame.start(guac_login, this._guacPassword);
      this.guacamoleFrame.show();
    } else if (!guac_login && !this._vueState.voice.isLoopbackMode.value) {
      alert('For visual access please ask your administrator.');
    }
  }

  /**
   * Setup minimal client event handlers
   * @private
   */
  _setupClientHandlers(client) {
    // Register voice listeners for other users joining
    client.on('newUser', (user) => {
      this._vueState.user.registerUser(user);
    });
    
    // Listen for messageSent event (fired when message written to network)
    client.on('messageSent', (messageText) => {
      // Clear any existing timer
      if (this._messageConfirmationTimer) {
        clearTimeout(this._messageConfirmationTimer);
      }
      
      // Trigger UI confirmation
      this._vueState.ui.messageConfirmed.value = true;
      
      // Reset after 2 seconds
      this._messageConfirmationTimer = setTimeout(() => {
        this._vueState.ui.messageConfirmed.value = false;
        this._messageConfirmationTimer = null;
      }, 2000);
    });
  }

  /**
   * Establish client connection and setup
   * @private
   */
  async _establishClientConnection(host, port, username, password, tokens, channelName) {
    const client = await this._vueState.connection.connect(host, port, username, password, tokens);
    
    const user_roles = (this.auth.currentUser()?.app_metadata?.roles) || [];
    let guac_login = false;
    if (user_roles.includes('admin')) {
      guac_login = 'admin';
    } else if (user_roles.includes('edit')) {
      guac_login = 'editor';
    } else if (user_roles.includes('watch')) {
      guac_login = 'watcher';
    }
    
    this._guacLogin = guac_login;
    this._guacPassword = this.connectDialog.password.value; // Vue ref
    this._setupGuacamoleFrame(guac_login);
    
    if (this._vueState.voice.isLoopbackMode.value) {
      this.log(translate('logentry.connected_loopback'));
    } else {
      this.log(translate('logentry.connected'));
    }

    // Register root channel and self user
    this._registerChannel(client.root);
    
    if (client.self) {
      this._vueState.user.registerUser(client.self);
      this._vueState.user.thisUser.value = client.self.__ui;
    }

    // CRITICAL: Register voice listeners for all existing users in the channel
    // Without this, users who joined before us won't have voice event handlers
    for (const user of client.users.values()) {
      if (user !== client.self) {
        this._vueState.user.registerUser(user);
      }
    }

    this._setupClientHandlers(client);
    
    // CRITICAL: Set audio quality BEFORE creating voice handler
    // This ensures client knows bitrate/samplesPerPacket for voice stream encoding
    client.setAudioQuality(
      this.settings.audioBitrate.value,
      this.settings.samplesPerPacket.value
    );
    
    this._updateVoiceHandler();

    if (this._vueState.audio.audioLockActive.value) {
      this._vueState.connection.getClient().setSelfMute(true);
      this._vueState.connection.getClient().setSelfDeaf(true);
    } else if (this._vueState.user.selfDeaf.value) {
      this._vueState.connection.getClient().setSelfDeaf(true);
    } else if (this._vueState.user.selfMute.value) {
      this._vueState.connection.getClient().setSelfMute(true);
    }
  }

  /**
   * Register channel UI wrapper (Vue refs instead of Knockout)
   * @private
   */
  _registerChannel(channel) {
    if (channel.__ui) {
      return;
    }
    
    const { ref } = this._vue;
    channel.__ui = {
      model: channel,
      name: ref(channel.name),
    };
    
    // Store root channel reference for sendMessage workaround
    if (channel._id === 0) {
      this._rootChannel = channel.__ui;
    }
  }

  /**
   * Perform the actual connection
   * @private
   */
  async _performConnect(connectionParams, { audioEnabled = true, sampleRate = null } = {}) {
    const { host, port, username, password, tokens = [], channelName: targetChannel = '' } = connectionParams;
    const isLoopback = connectionParams.isLoopback || false;

    if (isLoopback) {
      this._vueState.voice.isLoopbackMode.value = true;
    }

    await this._setupAudioForConnection(audioEnabled, sampleRate, isLoopback);
    this._resetUIForConnection();

    try {
      await this._establishClientConnection(host, port, username, password, tokens, targetChannel);
    } catch (err) {
      if (err.$type?.name === 'Reject') {
        this.connectErrorDialog.type.value = err.type;
        this.connectErrorDialog.reason.value = err.reason;
        this.connectErrorDialog.visible.value = true;
      } else {
        this.log(translate('logentry.connection_error'), err);
      }
    }
  }

  /**
   * Update voice handler
   * @private
   */
  _updateVoiceHandler() {
    this._vueState.voice.updateVoiceHandler(
      this._vueState.connection.getClient(),
      this.settings,
      () => {
        if (this._vueState.user.thisUser.value) {
          this._vueState.user.thisUser.value.talking.value = 'on';
        }
      },
      () => {
        if (this._vueState.user.thisUser.value) {
          this._vueState.user.thisUser.value.talking.value = 'off';
        }
        if (this._vueState.voice.isLoopbackMode.value) {
          this._vueState.voice.loopbackDominantFrequency.value = 0;
        }
      }
    );
    
    if (this._vueState.voice.isLoopbackMode.value) {
      this._vueState.voice.setMute(false);
    } else if (this._vueState.audio.audioLockActive.value || this._vueState.user.selfMute.value) {
      this._vueState.voice.setMute(true);
    }

    const client = this._vueState.connection.getClient();
    if (client) {
      client.setAudioQuality(
        this.settings.audioBitrate.value,
        this.settings.samplesPerPacket.value
      );
    }
  }

  /**
   * Reset client and all state
   */
  resetClient = () => {
    // Clear message confirmation timer
    if (this._messageConfirmationTimer) {
      clearTimeout(this._messageConfirmationTimer);
      this._messageConfirmationTimer = null;
    }
    
    this._currentConnectionId = null;
    this._vueState.audio.stopBeep();
    this._vueState.connection.disconnect();
    this._vueState.user.thisUser.value = null;
    
    const wasLoopback = this._vueState.voice.isLoopbackMode.value;
    this._vueState.voice.isLoopbackMode.value = false;
    
    if (!wasLoopback) {
      this._vueState.audio.beeperReady.value = false;
      this._vueState.voice.voiceHandlerReady.value = false;
    }
  }

  /**
   * Send message to channel or user
   */
  sendMessage = (target, message) => {
    if (this.connected()) {
      if (!target) {
        target = this._vueState.user.thisUser.value?.channel.value;
      }
      if (!target) {
        return;
      }
      target.model.sendMessage(message);
    }
  }

  // ============================================================
  // DELEGATION - Expose Knockout observables for backward compatibility
  // ============================================================

  // Connection Dialog module (Vue refs, no Knockout wrapper needed)
  get connectDialog() { return this._vueState.dialog; }

  // Audio module
  get audioContext() { return this._vueState.audio.audioContext; }
  get audioLockActive() { return this._vueState.audio.audioLockActive; }
  get audioLockReason() { return this._vueState.audio.audioLockReason; }
  get audioLockDetails() { return this._vueState.audio.audioLockDetails; }
  get micPermissionDenied() { return this._vueState.audio.micPermissionDenied; }
  get micPermissionErrorMessage() { return this._vueState.audio.micPermissionErrorMessage; }
  get isBeeping() { return this._vueState.audio.isBeeping; }
  get beeperReady() { return this._vueState.audio.beeperReady; }
  
  startBeep = () => { return this._vueState.audio.startBeep(); }
  stopBeep = () => { return this._vueState.audio.stopBeep(); }
  retryMicrophonePermission = () => { return this._vueState.audio.retryMicrophonePermission(); }
  initializeAudioContext = () => { return this._vueState.audio.initializeAudioContext(); }
  _initializePersistentBeeper = () => { return this._vueState.audio.initializePersistentBeeper(); }

  // Voice module
  get isLoopbackMode() { return this._vueState.voice.isLoopbackMode; }
  get voiceHandlerReady() { return this._vueState.voice.voiceHandlerReady; }
  get loopbackDominantFrequency() { return this._vueState.voice.loopbackDominantFrequency; }
  get voiceHandler() { return this._vueState.voice.voiceHandler; }

  // UI module
  get currentOpenModal() { return this._vueState.ui.currentOpenModal; }
  get messageBox() { return this._vueState.ui.messageBox; }
  get messageConfirmed() { return this._vueState.ui.messageConfirmed; }
  get settingsDialog() { return this._vueState.ui.settingsDialog; }
  
  openSettings = () => { return this._vueState.ui.openSettings(); }
  closeSettings = () => { return this._vueState.ui.closeSettings(); }
  submitMessageBox = () => {
    // WORKAROUND: user.channel is not set due to async worker property sync
    // Use root channel directly (all users start in root channel ID 0)
    const target = this._rootChannel;
    
    return this._vueState.ui.submitMessageBox((t, m) => this.sendMessage(t, m), target);
  }

  // User module
  get thisUser() { return this._vueState.user.thisUser; }
  get selfMute() { return this._vueState.user.selfMute; }
  get selfDeaf() { return this._vueState.user.selfDeaf; }
  
  requestMute = (user) => { 
    this._vueState.user.requestMute(user);
    if (this.connected()) {
      this._vueState.connection.getClient().setSelfMute(true);
    }
  }
  
  requestDeaf = (user) => { 
    this._vueState.user.requestDeaf(user, this._vueState.voice.isLoopbackMode.value);
    if (this.connected()) {
      this._vueState.connection.getClient().setSelfDeaf(true);
    }
  }
  
  requestUnmute = (user) => {
    if (this._vueState.audio.audioLockActive.value) {
      this.notifyAudioLock();
      return;
    }
    this._vueState.user.requestUnmute(user);
    if (this.connected()) {
      this._vueState.connection.getClient().setSelfMute(false);
      this._vueState.connection.getClient().setSelfDeaf(false);
    }
  }
  
  requestUndeaf = (user) => {
    if (this._vueState.audio.audioLockActive.value) {
      this.notifyAudioLock();
      return;
    }
    this._vueState.user.requestUndeaf(user);
    if (this.connected()) {
      this._vueState.connection.getClient().setSelfDeaf(false);
    }
  }

  // Connection module
  get remoteHost() { return this._vueState.connection.remoteHost; }
  get remotePort() { return this._vueState.connection.remotePort; }
  get client() { return this._vueState.connection.getClient(); }
  set client(value) { 
    // Direct assignment is no longer supported - use composable API or connection methods
    throw new Error('Direct assignment to appState.client is no longer supported. Use the composable API or appropriate methods to update the client.');
  }

  // Helpers
  notifyAudioLock = () => {
    const details = this._vueState.audio.audioLockDetails.value || {};
    const sr = details.sampleRate ?? this._vueState.audio.audioContext?.sampleRate;
    this.sampleRateWarningDialog.showInfo(sr);
  }

  handleUnmuteClick = () => {
    if (this._vueState.user.thisUser.value) {
      this.requestUnmute(this._vueState.user.thisUser.value);
    }
  }

  handleUndeafClick = () => {
    if (this._vueState.user.thisUser.value) {
      this.requestUndeaf(this._vueState.user.thisUser.value);
    }
  }

  applySettings = () => {
    // Settings are now managed by Vue composable and saved via dialog
    // Just update the voice handler with new settings
    this._updateVoiceHandler();
  }

  logoutUser = () => {
    this.auth.logout();
    location.reload();
  }

  openSourceCode = () => {
    globalThis.open(packageJson.homepage, '_blank').focus();
  }

  // Expose Vue state for direct access from Vue components
  get connection() { return this._vueState.connection; }
  get audio() { return this._vueState.audio; }
  get voice() { return this._vueState.voice; }
  get ui() { return this._vueState.ui; }
  get user() { return this._vueState.user; }
  get connectErrorDialog() { return this._vueState.errorDialog; }
  get sampleRateWarningDialog() { return this._vueState.sampleRateDialog; }
  get connectionInfo() { return this._vueState.connectionInfoDialog; }
}
