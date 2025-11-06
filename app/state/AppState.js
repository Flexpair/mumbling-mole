import ko from "knockout";
import ConnectionState from "./ConnectionState";
import AudioState from "./AudioState";
import VoiceState from "./VoiceState";
import UIState from "./UIState";
import UserState from "./UserState";
import { translate } from "../localize";
import packageJson from "../../package.json";

/**
 * AppState - main state coordinator
 * 
 * Composes all state modules and provides a unified API.
 * Replaces the GlobalBindings god object with a modular architecture.
 * 
 * Architecture:
 * - ConnectionState: client connection, root user/channel setup
 * - AudioState: AudioContext, beeper, audio pipeline
 * - VoiceState: voice handler, loopback mode, voice controls
 * - UIState: modals, message box, settings dialog
 * - UserState: current user, self mute/deaf, user registration, voice streams
 */
export default class AppState {
  constructor(config, log) {
    this.config = config;
    this.log = log || console.log.bind(console);
    
    // Initialize state modules
    this.connection = new ConnectionState(this.log);
    this.audio = new AudioState();
    this.voice = new VoiceState();
    this.ui = new UIState();
    this.user = new UserState(this.audio, this.voice);
    
    // Store references for backward compatibility
    this.settings = null; // Set externally
    this.connectDialog = null; // Set externally
    this.connectErrorDialog = null; // Set externally
    this.sampleRateWarningDialog = null; // Set externally
    this.guacamoleFrame = null; // Set externally
    this.connectionInfo = null; // Set externally
    this.auth = null; // Set externally
    
    // Guacamole credentials storage
    this._guacLogin = null;
    this._guacPassword = null;
    
    // Set up subscriptions
    this._setupSubscriptions();
  }

  /**
   * Set up reactive subscriptions between modules
   */
  _setupSubscriptions() {
    // When selfMute changes, update voice handler
    this.user.selfMute.subscribe((mute) => {
      this.voice.setMute(mute);
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
    return this.user.thisUser() != null;
  }

  /**
   * Get current client
   * @returns {object|null}
   */
  getClient = () => {
    return this.connection.getClient();
  }

  /**
   * Connect to Mumble server
   */
  async connect(host, port, username, password, tokens = [], channelName = "") {
    // Auth check
    const identity = this.auth.currentUser();
    if (!identity?.app_metadata) {
      alert("You do not have permission to connect to the server. Please contact the administrator.");
      return;
    }

    let user_roles = identity.app_metadata.roles || [];
    if (!Array.isArray(user_roles)) {
      user_roles = [];
    }

    if (!user_roles.includes("watch")) user_roles.push("watch");
    if (!user_roles.includes("listen")) user_roles.push("listen");
    identity.app_metadata.roles = user_roles;

    // Prepare AudioContext
    if (!this.audio.audioContext) {
      await this.audio.initializeAudioContext();
    }
    
    const currentSampleRate = this.audio.audioContext ? this.audio.audioContext.sampleRate : null;
    const audioCompatible = currentSampleRate === 48000;
    const connectionParams = { host, port, username, password, tokens, channelName };

    if (!audioCompatible) {
      this.sampleRateWarningDialog.show(currentSampleRate, connectionParams);
      return;
    }

    // Request microphone permission
    // Store connection ID to detect if connection was cancelled during async operations
    const connectionId = Symbol('connection');
    this._currentConnectionId = connectionId;
    
    if (navigator.mediaDevices?.getUserMedia) {
      navigator.mediaDevices
        .getUserMedia({ audio: true })
        .then((stream) => {
          // RACE-SAFE: Only update state if this connection is still active
          if (this._currentConnectionId === connectionId) {
            this.audio.micPermissionDenied(false);
          }
          // Always stop tracks to avoid mic staying active
          for (const track of stream.getTracks()) {
            track.stop();
          }
        })
        .catch((err) => {
          console.warn("Microphone permission denied:", err);
          // RACE-SAFE: Only update state if this connection is still active
          if (this._currentConnectionId === connectionId) {
            this.audio.micPermissionDenied(true);
          }
        });
    }

    this.audio.clearAudioLock({ resetStates: true });
    await this._performConnect(connectionParams, { audioEnabled: true });
  }

  /**
   * Connect in loopback test mode
   */
  async connectLoopback(host, port, username, password, tokens = [], channelName = "") {
    const identity = this.auth.currentUser();
    if (!identity?.app_metadata) {
      alert("You do not have permission to connect to the server. Please contact the administrator.");
      return;
    }

    let user_roles = identity.app_metadata.roles || [];
    if (!Array.isArray(user_roles)) {
      user_roles = [];
    }

    if (!user_roles.includes("watch")) user_roles.push("watch");
    if (!user_roles.includes("listen")) user_roles.push("listen");
    identity.app_metadata.roles = user_roles;

    if (!this.audio.audioContext) {
      await this.audio.initializeAudioContext();
    }

    const connectionParams = {
      host, port, username, password, tokens, channelName,
      isLoopback: true,
    };

    // Store connection ID to detect if connection was cancelled during async operations
    const connectionId = Symbol('loopback-connection');
    this._currentConnectionId = connectionId;

    if (navigator.mediaDevices?.getUserMedia) {
      navigator.mediaDevices
        .getUserMedia({ audio: true })
        .then((stream) => {
          // RACE-SAFE: Only update state if this connection is still active
          if (this._currentConnectionId === connectionId) {
            this.audio.micPermissionDenied(false);
          }
          // Always stop tracks to avoid mic staying active
          for (const track of stream.getTracks()) {
            track.stop();
          }
        })
        .catch((err) => {
          console.warn("Microphone permission denied:", err);
          // RACE-SAFE: Only update state if this connection is still active
          if (this._currentConnectionId === connectionId) {
            this.audio.micPermissionDenied(true);
          }
        });
    }

    this.audio.clearAudioLock({ resetStates: true });
    this.voice.isLoopbackMode(true);
    
    // Ensure microphone is NOT muted for loopback test
    this.user.selfMute(false);
    
    await this._performConnect(connectionParams, { audioEnabled: true });
  }

  /**
   * Start loopback test on existing connection
   */
  startLoopbackTest = async () => {
    if (this.connected()) {
      this.voice.isLoopbackMode(true);
      
      if (this.voice.voiceHandler) {
        this.voice.setMute(true);
        this.voice.endVoiceHandler();
      }
      
      this._updateVoiceHandler();
      await this.audio.initializePersistentBeeper();
    } else {
      const host = this.config.defaults.host || "localhost";
      const port = this.config.defaults.port || 64738;
      const username = this.config.defaults.username || "WebClient";
      const password = this.config.defaults.password || "";
      this.connectLoopback(host, port, username, password);
    }
  }

  /**
   * Validate authentication for connection
   * @private
   */
  _validateAuthForConnection() {
    const identity = this.auth.currentUser();
    if (!identity?.app_metadata) {
      alert("You do not have permission to connect to the server. Please contact the administrator.");
      return false;
    }

    let user_roles = identity.app_metadata.roles || [];
    if (!Array.isArray(user_roles)) {
      user_roles = [];
    }

    if (!user_roles.includes("watch")) user_roles.push("watch");
    if (!user_roles.includes("listen")) user_roles.push("listen");
    identity.app_metadata.roles = user_roles;
    
    return true;
  }

  /**
   * Setup audio for connection
   * @private
   */
  async _setupAudioForConnection(audioEnabled, sampleRate, isLoopback) {
    if (audioEnabled) {
      this.voice.initVoiceInput(
        (data) => {
          if (this.connection.client) {
            this.voice.writeVoiceData(data);
          } else {
            this.voice.endVoiceHandler();
          }
        },
        (err) => {
          this.log(translate("logentry.mic_init_error"), err);
        },
        () => {
          this.audio.initializePersistentBeeper();
          if (this.voice.isLoopbackMode()) {
            this.voice.voiceHandlerReady(true);
          }
        }
      );
    } else {
      this.audio.activateAudioLock("sample-rate", { sampleRate });
      this.voice.endVoiceHandler();
    }

    try {
      await this.audio.resumeAudioContext();
      
      try {
        await this.audio.loadAudioWorkletModule('playback-buffer-processor.js');
      } catch (err) {
        console.warn('[AUDIO-INIT] Playback AudioWorklet pre-warm failed:', err);
      }
    } catch (error) {
      console.warn("AudioContext resume failed, continuing anyway:", error);
    }
  }

  /**
   * Reset UI state for new connection
   * @private
   */
  _resetUIForConnection() {
    this.audio.stopBeep();
    this.user.thisUser(null);
    
    const wasLoopback = this.voice.isLoopbackMode();
    if (!wasLoopback) {
      this.audio.beeperReady(false);
      this.voice.voiceHandlerReady(false);
    }
  }

  /**
   * Setup Guacamole frame if needed
   * @private
   */
  _setupGuacamoleFrame(guac_login) {
    if (guac_login && !this.voice.isLoopbackMode()) {
      this.guacamoleFrame.start(guac_login, this._guacPassword);
      this.guacamoleFrame.show();
    } else if (!guac_login && !this.voice.isLoopbackMode()) {
      alert("For visual access please ask your administrator.");
    }
  }

  /**
   * Setup minimal client event handlers
   * Only registers self user initially - no dynamic channel/user registration.
   * App uses single-channel mode with all users in same room.
   * @private
   */
  _setupClientHandlers(client) {
    // No dynamic registration needed - single channel mode
    // Users/channels managed by protocol, not UI
  }

  /**
   * Establish client connection and setup
   * @private
   */
  async _establishClientConnection(host, port, username, password, tokens, channelName) {
    const client = await this.connection.connect(host, port, username, password, tokens);
    
    const user_roles = (this.auth.currentUser()?.app_metadata?.roles) || [];
    let guac_login = false;
    if (user_roles.includes("admin")) {
      guac_login = "admin";
    } else if (user_roles.includes("edit")) {
      guac_login = "editor";
    } else if (user_roles.includes("watch")) {
      guac_login = "watcher";
    }
    
    this._guacLogin = guac_login;
    this._guacPassword = this.connectDialog.password();
    this._setupGuacamoleFrame(guac_login);
    
    if (this.voice.isLoopbackMode()) {
      this.log(translate("logentry.connected_loopback"));
    } else {
      this.log(translate("logentry.connected"));
    }

    // Register root channel and self user (minimal UI wrappers for protocol)
    // Single channel mode - no tree traversal
    this._registerChannel(client.root);
    
    if (client.self) {
      this.user.registerUser(client.self);
      this.user.thisUser(client.self.__ui);
    }

    this._setupClientHandlers(client);

    this._updateVoiceHandler();

    if (this.audio.audioLockActive()) {
      this.connection.setSelfMute(true);
      this.connection.setSelfDeaf(true);
    } else if (this.user.selfDeaf()) {
      this.connection.setSelfDeaf(true);
    } else if (this.user.selfMute()) {
      this.connection.setSelfMute(true);
    }
  }

  /**
   * Register channel with minimal UI wrapper for protocol compatibility
   * Creates channel.__ui with model and name observable only.
   * @private
   */
  _registerChannel(channel) {
    if (channel.__ui) {
      return; // Skip if already initialized
    }
    
    channel.__ui = {
      model: channel,
      name: ko.observable(channel.name),
    };
  }

  /**
   * Perform the actual connection
   * @private
   */
  async _performConnect(connectionParams, { audioEnabled = true, sampleRate = null } = {}) {
    const { host, port, username, password, tokens = [], channelName: targetChannel = "" } = connectionParams;
    const isLoopback = connectionParams.isLoopback || false;

    if (isLoopback) {
      this.voice.isLoopbackMode(true);
    }

    await this._setupAudioForConnection(audioEnabled, sampleRate, isLoopback);
    this._resetUIForConnection();

    try {
      await this._establishClientConnection(host, port, username, password, tokens, targetChannel);
    } catch (err) {
      if (err.$type?.name === "Reject") {
        this.connectErrorDialog.type(err.type);
        this.connectErrorDialog.reason(err.reason);
        this.connectErrorDialog.show();
      } else {
        this.log(translate("logentry.connection_error"), err);
      }
    }
  }

  /**
   * Update voice handler
   * @private
   */
  _updateVoiceHandler() {
    this.voice.updateVoiceHandler(
      this.connection.client,
      this.settings,
      () => {
        if (this.user.thisUser()) {
          this.user.thisUser().talking("on");
        }
      },
      () => {
        if (this.user.thisUser()) {
          this.user.thisUser().talking("off");
        }
        // Clear frequency display when stopped talking in loopback mode
        // This happens when mute is activated or voice stream ends
        if (this.voice.isLoopbackMode()) {
          this.voice.loopbackDominantFrequency(0);
        }
      }
    );
    
    // In loopback mode, ensure microphone is NOT muted initially
    if (this.voice.isLoopbackMode()) {
      this.voice.setMute(false);
    } else if (this.audio.audioLockActive() || this.user.selfMute()) {
      this.voice.setMute(true);
    }

    this.connection.setAudioQuality(
      this.settings.audioBitrate,
      this.settings.samplesPerPacket
    );
    
    // EVENT-BASED: Beeper initialization happens automatically when mixer becomes ready
    // No need for setTimeout() - see _performConnect() mixer ready callback
  }

  /**
   * Reset client and all state
   */
  resetClient = () => {
    // RACE-SAFE: Cancel any in-progress connections
    this._currentConnectionId = null;
    
    this.audio.stopBeep();
    this.connection.resetClient();
    this.user.thisUser(null);
    
    // Keep beeper/voice ready state in loopback mode (for test button)
    // Only reset loopback mode flag itself
    const wasLoopback = this.voice.isLoopbackMode();
    this.voice.isLoopbackMode(false);
    
    if (!wasLoopback) {
      this.audio.beeperReady(false);
      this.voice.voiceHandlerReady(false);
    }
  }

  /**
   * Send message to channel or user
   */
  sendMessage = (target, message) => {
    if (this.connected()) {
      if (!target) {
        // Default to current channel
        target = this.user.thisUser()?.channel();
      }
      if (!target) {
        return; // No target available
      }
      target.model.sendMessage(message);
    }
  }

  // ============================================================
  // DELEGATION - Expose module properties/methods
  // ============================================================

  // Audio module
  get audioContext() { return this.audio.audioContext; }
  get audioLockActive() { return this.audio.audioLockActive; }
  get audioLockReason() { return this.audio.audioLockReason; }
  get audioLockDetails() { return this.audio.audioLockDetails; }
  get micPermissionDenied() { return this.audio.micPermissionDenied; }
  get micPermissionErrorMessage() { return this.audio.micPermissionErrorMessage; }
  get isBeeping() { return this.audio.isBeeping; }
  get beeperReady() { return this.audio.beeperReady; }
  
  startBeep = () => { return this.audio.startBeep(); }
  stopBeep = () => { return this.audio.stopBeep(); }
  retryMicrophonePermission = () => { return this.audio.retryMicrophonePermission(); }
  initializeAudioContext = () => { return this.audio.initializeAudioContext(); }
  _initializePersistentBeeper = () => { return this.audio.initializePersistentBeeper(); }

  // Voice module
  get isLoopbackMode() { return this.voice.isLoopbackMode; }
  get voiceHandlerReady() { return this.voice.voiceHandlerReady; }
  get voiceHandler() { return this.voice.voiceHandler; }

  // UI module
  get currentOpenModal() { return this.ui.currentOpenModal; }
  get messageBox() { return this.ui.messageBox; }
  get settingsDialog() { return this.ui.settingsDialog; }
  
  openSettings = (SettingsDialogClass) => { return this.ui.openSettings(this.settings, SettingsDialogClass); }
  closeSettings = () => { return this.ui.closeSettings(); }
  /**
   * Submit message box - always sends to current channel
   */
  submitMessageBox = () => {
    const target = this.user.thisUser()?.channel();
    return this.ui.submitMessageBox((t, m) => this.sendMessage(t, m), target);
  }

  // User module
  get thisUser() { return this.user.thisUser; }
  get selfMute() { return this.user.selfMute; }
  get selfDeaf() { return this.user.selfDeaf; }
  
  requestMute = (user) => { 
    this.user.requestMute(user);
    if (this.connected()) {
      this.connection.setSelfMute(true);
    }
  }
  
  requestDeaf = (user) => { 
    this.user.requestDeaf(user, this.voice.isLoopbackMode());
    if (this.connected()) {
      this.connection.setSelfDeaf(true);
    }
  }
  
  requestUnmute = (user) => {
    if (this.audio.audioLockActive()) {
      this.notifyAudioLock();
      return;
    }
    this.user.requestUnmute(user);
    if (this.connected()) {
      this.connection.setSelfMute(false);
      this.connection.setSelfDeaf(false);
    }
  }
  
  requestUndeaf = (user) => {
    if (this.audio.audioLockActive()) {
      this.notifyAudioLock();
      return;
    }
    this.user.requestUndeaf(user);
    if (this.connected()) {
      this.connection.setSelfDeaf(false);
    }
  }

  // Connection module
  get remoteHost() { return this.connection.remoteHost; }
  get remotePort() { return this.connection.remotePort; }
  get client() { return this.connection.client; }
  set client(value) { this.connection.client = value; }

  // Helpers
  notifyAudioLock = () => {
    const details = this.audio.audioLockDetails() || {};
    const sr = details.sampleRate ?? this.audio.audioContext?.sampleRate;
    this.sampleRateWarningDialog.showInfo(sr);
  }

  handleUnmuteClick = () => {
    if (this.user.thisUser()) {
      this.requestUnmute(this.user.thisUser());
    }
  }

  handleUndeafClick = () => {
    if (this.user.thisUser()) {
      this.requestUndeaf(this.user.thisUser());
    }
  }

  applySettings = () => {
    const settingsDialog = this.ui.settingsDialog();
    settingsDialog.applyTo(this.settings);
    this._updateVoiceHandler();
    this.settings.save();
    this.ui.closeSettings();
  }

  // Computed observables
  messageBoxHint = ko.pureComputed(() => {
    if (!this.user.thisUser()) {
      return "";
    }
    // Always send to current channel - no selection UI exists
    const target = this.user.thisUser().channel();
    if (!target) {
      return "";
    }
    // Single-channel mode: messages always go to channel (never private user messages)
    return translate("chat.channel_message_placeholder").replace("%1", target.name());
  });

  mailToDesktop = ko.observable(
    "mailto:mail@" +
    globalThis.location.hostname +
    "?subject=Send%20attachment%20to%20desktop"
  );

  logoutUser = () => {
    this.auth.logout();
    location.reload();
  }

  openSourceCode = () => {
    window.open(packageJson.homepage, "_blank").focus();
  }
}
