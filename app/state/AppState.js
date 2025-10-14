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
    this.user = new UserState(this.audio);
    
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
    if (!identity || !identity.app_metadata) {
      alert("You do not have permission to connect to the server. Please contact the administrator.");
      return;
    }

    var user_roles = identity.app_metadata.roles || [];
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
    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
      navigator.mediaDevices
        .getUserMedia({ audio: true })
        .then((stream) => {
          this.audio.micPermissionDenied(false);
          stream.getTracks().forEach((track) => track.stop());
        })
        .catch((err) => {
          console.warn("Microphone permission denied:", err);
          this.audio.micPermissionDenied(true);
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
    if (!identity || !identity.app_metadata) {
      alert("You do not have permission to connect to the server. Please contact the administrator.");
      return;
    }

    var user_roles = identity.app_metadata.roles || [];
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

    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
      navigator.mediaDevices
        .getUserMedia({ audio: true })
        .then((stream) => {
          this.audio.micPermissionDenied(false);
          stream.getTracks().forEach((track) => track.stop());
        })
        .catch((err) => {
          console.warn("Microphone permission denied:", err);
          this.audio.micPermissionDenied(true);
        });
    }

    this.audio.clearAudioLock({ resetStates: true });
    this.voice.isLoopbackMode(true);
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
   * Perform the actual connection
   * @private
   */
  async _performConnect(connectionParams, { audioEnabled = true, sampleRate = null } = {}) {
    const {
      host, port, username, password, tokens = [], channelName: targetChannel = "",
    } = connectionParams;

    let channelName = targetChannel;

    if (audioEnabled) {
      this.voice.initVoiceInput(
        (data) => {
          if (!this.connection.client) {
            this.voice.endVoiceHandler();
          } else {
            this.voice.writeVoiceData(data);
          }
        },
        (err) => {
          this.log(translate("logentry.mic_init_error"), err);
        }
      );
    } else {
      this.audio.activateAudioLock("sample-rate", { sampleRate });
      this.voice.endVoiceHandler();
    }

    this.resetClient();
    
    if (connectionParams.isLoopback) {
      this.voice.isLoopbackMode(true);
    }

    try {
      await this.audio.resumeAudioContext();
      
      // Pre-warm AudioWorklet
      try {
        await this.audio.audioContext.audioWorklet.addModule('playback-buffer-processor.js');
      } catch (err) {
        if (err.name !== 'InvalidStateError') {
          console.warn('[AUDIO-INIT] Playback AudioWorklet pre-warm failed:', err);
        }
      }
    } catch (error) {
      console.warn("AudioContext resume failed, continuing anyway:", error);
    }

    try {
      const client = await this.connection.connect(host, port, username, password, tokens);
      
      var user_roles = (this.auth.currentUser()?.app_metadata?.roles) || [];
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
      
      if (guac_login && !this.voice.isLoopbackMode()) {
        this.guacamoleFrame.start(guac_login, this.connectDialog.password());
        this.guacamoleFrame.show();
      } else if (!guac_login && !this.voice.isLoopbackMode()) {
        alert("For visual access please ask your administrator.");
      }
      
      if (this.voice.isLoopbackMode()) {
        this.log(translate("logentry.connected_loopback"));
      } else {
        this.log(translate("logentry.connected"));
      }

      if (channelName.indexOf("/") != 0) {
        channelName = "/" + channelName;
      }
      
      const registerChannel = (channel, channelPath) => {
        this.channel.registerChannel(
          channel,
          (event, menu, ui) => this._openContextMenu(event, menu, ui),
          () => this.channelContextMenu,
          () => this.channel.updateLinks()
        );
        if (channelPath === channelName) {
          client.self.setChannel(channel);
        }
        channel.children.forEach((ch) =>
          registerChannel(ch, channelPath + "/" + ch.name)
        );
      };
      registerChannel(client.root, "");

      client.users.forEach((user) => {
        this.user.registerUser(
          user,
          (event, menu, ui) => this._openContextMenu(event, menu, ui),
          () => this.userContextMenu
        );
      });

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
      }
    );
    
    if (this.audio.audioLockActive() || this.user.selfMute()) {
      this.voice.setMute(true);
    }

    this.connection.setAudioQuality(
      this.settings.audioBitrate,
      this.settings.samplesPerPacket
    );
    
    // Initialize beeper if in test mode
    if (this.connectDialog && this.connectDialog.isTestActive && this.connectDialog.isTestActive()) {
      setTimeout(async () => {
        await this.audio.initializePersistentBeeper();
      }, 100);
    }
  }

  /**
   * Reset client and all state
   */
  resetClient = () => {
    this.audio.stopBeep();
    this.connection.resetClient();
    this.ui.selected(null);
    this.channel.root(null);
    this.user.thisUser(null);
    this.voice.isLoopbackMode(false);
    this.audio.beeperReady(false);
    this.voice.voiceHandlerReady(false);
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

  /**
   * Open context menu (implementation needed based on UI framework)
   * @private
   */
  _openContextMenu(event, menu, ui) {
    // Context menu implementation will be set up externally
    // This is called by user/channel UI objects
    if (typeof openContextMenu === 'function') {
      openContextMenu(event, menu, ui);
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
    const sr = details.sampleRate !== undefined
      ? details.sampleRate
      : this.audio.audioContext && this.audio.audioContext.sampleRate;
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
    var target = this.ui.selected();
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
    window.location.hostname +
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
