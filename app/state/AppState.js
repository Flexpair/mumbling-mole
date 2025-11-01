import ko from "knockout";
import ConnectionState from "./ConnectionState";
import AudioState from "./AudioState";
import VoiceState from "./VoiceState";
import UIState from "./UIState";
import UserState from "./UserState";
import ChannelState from "./ChannelState";
import { translate } from "../localize";
import packageJson from "../../package.json";

/**
 * AppState - main state coordinator
 * 
 * Composes all state modules and provides a unified API.
 * Replaces the GlobalBindings god object with a modular architecture.
 * 
 * Architecture:
 * - ConnectionState: server connection management
 * - AudioState: audio context, locks, beeper
 * - VoiceState: voice handler, loopback mode
 * - UIState: UI state, modals
 * - UserState: user management, mute/deaf
 * - ChannelState: channel tree, links
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
    this.channel = new ChannelState();
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

    // Initialize audio context asynchronously after construction
    this.audio.initializeAudioContext().catch(err => {
      console.error('Failed to initialize AudioContext during AppState setup:', err);
    });
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
    this.ui.selected(null);
    this.channel.root(null);
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
   * Register channel and its children recursively
   * @private
   */
  _registerChannelTree(channel, channelPath, targetChannel, client) {
    this.channel.registerChannel(
      channel,
      (event, menu, ui) => this._openContextMenu(event, menu, ui),
      () => this.channelContextMenu,
      () => this.channel.updateLinks()
    );
    
    if (channelPath === targetChannel) {
      client.self.setChannel(channel);
    }
    
    for (const ch of channel.children) {
      this._registerChannelTree(ch, channelPath + "/" + ch.name, targetChannel, client);
    }
  }

  /**
   * Setup client event handlers and initial state
   * @private
   */
  _setupClientHandlers(client) {
    client.on("newChannel", (channel) => {
      this.channel.registerChannel(
        channel,
        (event, menu, ui) => this._openContextMenu(event, menu, ui),
        () => this.channelContextMenu,
        () => this.channel.updateLinks()
      );
    });
    
    client.on("newUser", (user) => {
      this.user.registerUser(
        user,
        (event, menu, ui) => this._openContextMenu(event, menu, ui),
        () => this.userContextMenu
      );
    });
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

    const normalizedChannelName = channelName.indexOf("/") === 0 ? channelName : "/" + channelName;
    this._registerChannelTree(client.root, "", normalizedChannelName, client);

    for (const user of client.users) {
      this.user.registerUser(
        user,
        (event, menu, ui) => this._openContextMenu(event, menu, ui),
        () => this.userContextMenu
      );
    }

    this._setupClientHandlers(client);

    if (client.self && !client.self.__ui) {
      this.user.registerUser(
        client.self,
        (event, menu, ui) => this._openContextMenu(event, menu, ui),
        () => this.userContextMenu
      );
    }
    
    this.user.thisUser(client.self.__ui);
    this.channel.root(client.root.__ui);
    this.channel.updateLinks();

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
      if (err.$type && err.$type.name === "Reject") {
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
    this.ui.selected(null);
    this.channel.root(null);
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
        target = this.user.thisUser();
      }
      if (target === this.user.thisUser()) {
        target = target.channel();
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
  get selected() { return this.ui.selected; }
  get messageBox() { return this.ui.messageBox; }
  get settingsDialog() { return this.ui.settingsDialog; }
  
  select = (element) => { return this.ui.select(element); }
  openSettings = (SettingsDialogClass) => { return this.ui.openSettings(this.settings, SettingsDialogClass); }
  closeSettings = () => { return this.ui.closeSettings(); }
  submitMessageBox = () => { return this.ui.submitMessageBox((t, m) => this.sendMessage(t, m), this.ui.selected()); }

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

  // Channel module
  get root() { return this.channel.root; }

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
    let target = this.ui.selected();
    if (!target) {
      target = this.user.thisUser();
    }
    if (target === this.user.thisUser()) {
      target = target.channel();
    }
    if (target.users) {
      return translate("chat.channel_message_placeholder").replace("%1", target.name());
    } else {
      return translate("chat.user_message_placeholder").replace("%1", target.name());
    }
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
