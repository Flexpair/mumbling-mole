// Removed legacy 'subworkers' import: nested worker polyfill caused constructor hijack issues.
// Removed redundant manual Buffer/process attachment (handled by ProvidePlugin + DefinePlugin)
import url from "url";
import MumbleClient from "mumble-client";
import ko from "knockout";
import keyboardjs from "keyboardjs";
import BufferQueueNode from "./audio/buffer-queue-node";
import AuthFactory from "./auth/AuthFactory";

import {
  ContinuousVoiceHandler,
  PushToTalkVoiceHandler,
  initVoice,
  enumMicrophones,
} from "./audio/voice";
import {
  initialize as localizationInitialize,
  translateEverything,
  translate,
} from "./localize";

// Import managers
import { AudioManager } from "./managers/AudioManager";
import { ConnectionManager } from "./managers/ConnectionManager";
import { UIStateManager } from "./managers/UIStateManager";
import { ChannelManager } from "./managers/ChannelManager";

/**
 * Utility function to wait for audio mixer to become available
 * @param {number} timeoutMs - Maximum time to wait in milliseconds (default: 5000)
 * @param {number} checkIntervalMs - How often to check in milliseconds (default: 50)
 * @returns {Promise<boolean>} - True if mixer becomes available, false if timeout
 */
async function waitForAudioMixer(timeoutMs = 5000, checkIntervalMs = 50) {
  const maxRetries = Math.floor(timeoutMs / checkIntervalMs);
  let retries = maxRetries;
  
  while (retries > 0 && !window._audioMixer) {
    await new Promise(resolve => setTimeout(resolve, checkIntervalMs));
    retries--;
  }
  
  return !!window._audioMixer;
}

// Debug flag for controlling verbose logging in voice handlers
const DEBUG_VOICE_LOGGING = false; // Set to true for development debugging

/**
 * Debug logging function that respects the DEBUG_VOICE_LOGGING flag
 * @param {string} tag - Log tag like '[VOICE]' 
 * @param {...any} args - Arguments to log
 */
function debugLog(tag, ...args) {
  if (DEBUG_VOICE_LOGGING) {
    console.log(tag, ...args);
  }
}

/**
 * Safely extracts and sanitizes username from user metadata
 * @param {Object} user - User object from auth provider
 * @returns {string|null} - Sanitized username or null if not available
 */
function getUsernameFromMetadata(user) {
  if (!user || !user.user_metadata || !user.user_metadata.full_name) {
    return null;
  }
  // Consistent sanitization: replace non-alphanumeric characters with underscore
  return user.user_metadata.full_name.replace(/[^A-Za-z0-9_]+/g, "_");
}

function GuacamoleFrame() {
  var self = this;
  // Start with null source to avoid the browser immediately requesting /guacamole/.
  // The iframe src is only assigned after a successful Mumble connect + role gating.
  // (HTML binding uses fallback about:blank when null/empty.)
  self.guacSource = ko.observable(null);
  self.visible = ko.observable(false);
  self.show = self.visible.bind(self.visible, true);
  self.hide = self.visible.bind(self.visible, false);
  self.loading = ko.observable(false);
  self.error = ko.observable(null);

  self.start = function (guacUser, password) {
    self.loading(true);
    self.error(null);
    // Sanitize previously bad localStorage entries that break Guacamole's JSON.parse
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (!k) continue;
        if (/guac|token|auth/i.test(k)) {
          const val = localStorage.getItem(k);
          if (val === "undefined" || val === "null") {
            localStorage.removeItem(k);
          }
        }
      }
    } catch (e) {
      console.warn("[Guac] localStorage sanitization failed", e);
    }
    const src =
      "/guacamole/#/?username=" +
      guacUser +
      "&password=" +
      encodeURIComponent(password || "");
    self.guacSource(src);
  };

  self.onLoad = function () {
    self.loading(false);
    try {
      const frame = document.getElementById("guacframe");
      const doc = frame && frame.contentDocument;
    } catch (e) {
      console.warn("[Guac] cannot inspect iframe content", e);
    }
  };
}

function ConnectDialog() {
  var self = this;
  self.address = ko.observable("");
  self.port = ko.observable("");
  self.username = ko.observable("");
  self.password = ko.observable("");
  // Start hidden - will be shown after authentication
  self.visible = ko.observable(false);
  // LOOPBACK-FEATURE: Track whether loopback test mode is active (prevents deactivation once started)
  self.isTestActive = ko.observable(false);
  self.show = self.visible.bind(self.visible, true);
  self.hide = self.visible.bind(self.visible, false);
  
  self.connect = function () {
    self.hide();
    
    // LOOPBACK-FEATURE: When already connected, this transitions from test mode back to normal mode
    if (ui.connected()) {
      // Switch from loopback test mode back to normal voice routing
      self.isTestActive(false);
      ui.isLoopbackMode(false);
      
      // Recreate voice handler with normal target (not loopback target 31)
      ui._updateVoiceHandler();
      
      // GUACAMOLE-INTEGRATION: Show Guacamole desktop frame after exiting test mode
      // Uses stored credentials from initial connection
      if (ui._guacLogin) {
        ui.guacamoleFrame.loading(false);
        ui.guacamoleFrame.start(ui._guacLogin, ui._guacPassword);
        ui.guacamoleFrame.show();
      } else {
        ui.guacamoleFrame.loading(false);
      }
    } else {
      // Normal connection flow - not yet connected to server
      self.isTestActive(false);
      ui.connect(self.address(), self.port(), self.username(), self.password());
    }
  };
  
  // LOOPBACK-FEATURE: Toggle button handler - activates loopback test mode
  self.toggleLoopback = function () {
      // One-way activation: prevent deactivation via this button (use Connect button instead)
      if (self.isTestActive()) {
        return;
      }
      
      // Mark test as active and connect in loopback mode
      self.isTestActive(true);
      
      // BEEPER-PREPARATION: Start beeper initialization immediately when test is activated
      // This ensures the beeper is ready by the time the user wants to click the button
      setTimeout(async () => {
        await ui._initializePersistentBeeper();
      }, 100); // Small delay to let loopback connection start
      
      // MODAL-BEHAVIOR: Keep dialog open during loopback test (don't call self.hide())
      // This allows user to see connection status and switch back to normal mode
      ui.connectLoopback(self.address(), self.port(), self.username(), self.password());
    };  
  
  // LEGACY-COMPAT: Legacy function for backward compatibility (closes dialog like old behavior)
  self.connectLoopback = function () {
    self.hide();
    ui.connectLoopback(self.address(), self.port(), self.username(), self.password());
  };
}

function ConnectErrorDialog(connectDialog) {
  var self = this;
  self.type = ko.observable(0);
  self.reason = ko.observable("");
  self.username = connectDialog.username;
  self.password = connectDialog.password;
  self.visible = ko.observable(false);
  self.show = self.visible.bind(self.visible, true);
  self.hide = self.visible.bind(self.visible, false);
  self.connect = () => {
    self.hide();
    connectDialog.connect();
  };
}

function SampleRateWarningDialog(ui) {
  var self = this;
  self.visible = ko.observable(false);
  self.mode = ko.observable("confirm");
  self.sampleRate = ko.observable(null);
  self.pendingConnection = null;

  const formatSampleRate = (value) => {
    if (typeof value === "number" && !Number.isNaN(value) && value > 0) {
      return Math.round(value);
    }
    return translate("audio.sample_rate.warning.unknown_rate");
  };

  self.title = ko.pureComputed(() => translate("audio.sample_rate.warning.title"));
  self.isConfirm = ko.pureComputed(() => self.mode() === "confirm");
  self.description = ko.pureComputed(() => {
    const key = self.isConfirm()
      ? "audio.sample_rate.warning.body"
      : "audio.sample_rate.warning.info";
    const template = translate(key);
    return template.replace("%1", formatSampleRate(self.sampleRate()));
  });
  self.primaryLabel = ko.pureComputed(() => translate("audio.sample_rate.warning.accept"));
  self.secondaryLabel = ko.pureComputed(() => {
    const key = self.isConfirm()
      ? "audio.sample_rate.warning.cancel"
      : "audio.sample_rate.warning.close";
    return translate(key);
  });
  self.hintsTitle = ko.pureComputed(() => translate("audio.sample_rate.warning.hints_title"));
  self.hints = ko.pureComputed(() => {
    const hintKeys = [
      "audio.sample_rate.warning.hints.item1",
      "audio.sample_rate.warning.hints.item2",
      "audio.sample_rate.warning.hints.item3"
    ];
    return hintKeys
      .map((key) => translate(key))
      .filter((text) => text && !/^\{\{.*\}\}$/.test(text));
  });

  self.show = (sampleRate, params) => {
    if (ui.currentOpenModal() !== null) {
      return;
    }
    self.mode("confirm");
    self.sampleRate(sampleRate || null);
    self.pendingConnection = params || null;
    self.visible(true);
    ui.currentOpenModal('sampleRateWarning');
  };

  self.showInfo = (sampleRate) => {
    if (ui.currentOpenModal() !== null) {
      return;
    }
    self.mode("info");
    self.sampleRate(sampleRate || null);
    self.pendingConnection = null;
    self.visible(true);
    ui.currentOpenModal('sampleRateWarning');
  };

  self.hide = () => {
    self.visible(false);
    if (ui.currentOpenModal() === 'sampleRateWarning') {
      ui.currentOpenModal(null);
    }
    self.pendingConnection = null;
  };

  self.joinWithoutAudio = () => {
    const params = self.pendingConnection;
    const sampleRate = self.sampleRate();
    self.hide();
    if (params) {
      ui._performConnect(params, {
        audioEnabled: false,
        sampleRate,
      });
    }
  };

  self.cancel = () => {
    self.hide();
  };
}

class ConnectionInfo {
  constructor(ui) {
    this._ui = ui;
    this.visible = ko.observable(false);
    this.serverVersion = ko.observable();
    this.latencyMs = ko.observable(NaN);
    this.latencyDeviation = ko.observable(NaN);
    this.remoteHost = ko.observable();
    this.remotePort = ko.observable();
    this.maxBitrate = ko.observable(NaN);
    this.currentBitrate = ko.observable(NaN);
    this.maxBandwidth = ko.observable(NaN);
    this.currentBandwidth = ko.observable(NaN);
    this.codec = ko.observable();

    this.show = () => {
      // Prevent opening connection info if another modal is already open
      if (this._ui.currentOpenModal() !== null) {
        return;
      }
      this.update();
      this.visible(true);
      this._ui.currentOpenModal('connectionInfo');
    };
    this.hide = () => {
      this.visible(false);
      // Clear the modal state when connection info dialog is closed
      if (this._ui.currentOpenModal() === 'connectionInfo') {
        this._ui.currentOpenModal(null);
      }
    };
  }

  update() {
    let client = this._ui.client;

    if (client) {
      this.serverVersion(client.serverVersion);

      let dataStats = client.dataStats;
      if (dataStats) {
        this.latencyMs(dataStats.mean);
        this.latencyDeviation(Math.sqrt(dataStats.variance));
      }
    } else {
      // Handle case when not connected to server
      this.serverVersion(null);
      this.latencyMs(NaN);
      this.latencyDeviation(NaN);
    }
    this.remoteHost(this._ui.remoteHost());
    this.remotePort(this._ui.remotePort());

    let spp = this._ui.settings.samplesPerPacket;
    if (client) {
      let maxBandwidth = client.maxBandwidth;
      let maxBitrate = client.maxBandwidth !== undefined ? client.getMaxBitrate(spp, false) : NaN;
      let actualBitrate = client.getActualBitrate(spp, false);
      let actualBandwidth = MumbleClient.calcEnforcableBandwidth(
        actualBitrate,
        spp,
        false
      );
      this.maxBitrate(maxBitrate);
      this.currentBitrate(actualBitrate);
      this.maxBandwidth(maxBandwidth);
      this.currentBandwidth(actualBandwidth);
      this.codec("Opus"); // only one supported for sending
    } else {
      // Handle case when not connected to server
      this.maxBitrate(NaN);
      this.currentBitrate(NaN);
      this.maxBandwidth(NaN);
      this.currentBandwidth(NaN);
      this.codec("Unknown");
    }
  }
}

class SettingsDialog {
  constructor(settings) {
    this.voiceMode = ko.observable(settings.voiceMode);
    this.pttKey = ko.observable(settings.pttKey);
    this.pttKeyDisplay = ko.observable(settings.pttKey);
    this.userCountInChannelName = ko.observable(
      settings.userCountInChannelName()
    );
    // Need to wrap this in a pureComputed to make sure it's always numeric
    let audioBitrate = ko.observable(settings.audioBitrate);
    this.audioBitrate = ko.pureComputed({
      read: audioBitrate,
      write: (value) => audioBitrate(Number(value)),
    });
    this.samplesPerPacket = ko.observable(settings.samplesPerPacket);
    this.msPerPacket = ko.pureComputed({
      read: () => this.samplesPerPacket() / 48,
      write: (value) => this.samplesPerPacket(value * 48),
    });
  }

  applyTo(settings) {
    settings.voiceMode = this.voiceMode();
    settings.pttKey = this.pttKey();
    settings.userCountInChannelName(this.userCountInChannelName());
    settings.audioBitrate = this.audioBitrate();
    settings.samplesPerPacket = this.samplesPerPacket();
  }

  end() {
  }

  recordPttKey() {
    var combo = [];
    const keydown = (e) => {
      combo = e.pressedKeys;
      let comboStr = combo.join(" + ");
      this.pttKeyDisplay("> " + comboStr + " <");
    };
    const keyup = () => {
      keyboardjs.unbind("", keydown, keyup);
      let comboStr = combo.join(" + ");
      if (comboStr) {
        this.pttKey(comboStr).pttKeyDisplay(comboStr);
      } else {
        this.pttKeyDisplay(this.pttKey());
      }
    };
    keyboardjs.bind("", keydown, keyup);
    this.pttKeyDisplay("> ? <");
  }

  totalBandwidth() {
    return MumbleClient.calcEnforcableBandwidth(
      this.audioBitrate(),
      this.samplesPerPacket(),
      true
    );
  }

  positionBandwidth() {
    return (
      this.totalBandwidth() -
      MumbleClient.calcEnforcableBandwidth(
        this.audioBitrate(),
        this.samplesPerPacket(),
        false
      )
    );
  }

  overheadBandwidth() {
    return MumbleClient.calcEnforcableBandwidth(
      0,
      this.samplesPerPacket(),
      false
    );
  }
}

class Settings {
  constructor(defaults) {
    const load = (key) => window.localStorage.getItem("mumble." + key);
    this.voiceMode = load("voiceMode") || defaults.voiceMode;
    this.pttKey = load("pttKey") || defaults.pttKey;
    this.userCountInChannelName = ko.observable(
      load("userCountInChannelName") || defaults.userCountInChannelName
    );
    this.audioBitrate = Number(load("audioBitrate")) || defaults.audioBitrate;
    this.samplesPerPacket =
      Number(load("samplesPerPacket")) || defaults.samplesPerPacket;
  }

  save() {
    const save = (key, val) =>
      window.localStorage.setItem("mumble." + key, val);
    save("voiceMode", this.voiceMode);
    save("pttKey", this.pttKey);
    save("userCountInChannelName", this.userCountInChannelName());
    save("audioBitrate", this.audioBitrate);
    save("samplesPerPacket", this.samplesPerPacket);
  }
}

class GlobalBindings {
  constructor(config) {
    this.config = config;
    this.settings = new Settings(config.settings);
    
    // Initialize managers (delegation pattern)
    this.audioManager = new AudioManager();
    this.connectionManager = new ConnectionManager();
    this.uiStateManager = new UIStateManager();
    this.channelManager = new ChannelManager();
    
    // Expose manager properties for backward compatibility
    // These delegate to the appropriate manager
    this.connector = this.connectionManager.connector;
    this.client = null; // Will be synced with connectionManager.client
    this.thisUser = this.connectionManager.thisUser;
    this.root = this.connectionManager.root;
    this.remoteHost = this.connectionManager.remoteHost;
    this.remotePort = this.connectionManager.remotePort;
    
    // Audio properties from AudioManager
    this.micPermissionDenied = this.audioManager.micPermissionDenied;
    this.micPermissionErrorMessage = this.audioManager.micPermissionErrorMessage;
    this.audioLockActive = this.audioManager.audioLockActive;
    this.audioLockReason = this.audioManager.audioLockReason;
    this.audioLockDetails = this.audioManager.audioLockDetails;
    this.isLoopbackMode = this.audioManager.isLoopbackMode;
    this.isBeeping = this.audioManager.isBeeping;
    this.beeperReady = this.audioManager.beeperReady;
    this.voiceHandlerReady = this.audioManager.voiceHandlerReady;
    this.audioContext = null; // Will be synced with audioManager.audioContext
    
    // UI properties from UIStateManager
    this.currentOpenModal = this.uiStateManager.currentOpenModal;
    this.selected = this.uiStateManager.selected;
    this.messageBox = this.uiStateManager.messageBox;
    this.messageBoxHint = this.uiStateManager.messageBoxHint;
    this.settingsDialog = this.uiStateManager.settingsDialog;
    
    // Channel/User management from ChannelManager
    this.channelContextMenu = this.channelManager.channelContextMenu;
    this.userContextMenu = this.channelManager.userContextMenu;
    
    // Initialize auth abstraction layer
    const authConfig = window.mumbleWebConfig?.auth || { provider: 'netlify' };
    this.auth = AuthFactory.create(authConfig);
    this.netlifyIdentity = this.auth; // Backward compatibility
    
    // Initialize dialogs
    this.connectDialog = new ConnectDialog();
    this.connectErrorDialog = new ConnectErrorDialog(this.connectDialog);
    this.sampleRateWarningDialog = new SampleRateWarningDialog(this);
    this.guacamoleFrame = new GuacamoleFrame();
    this.connectionInfo = new ConnectionInfo(this);
    
    // GUACAMOLE-INTEGRATION: Store credentials for later use
    this._guacLogin = null; 
    this._guacPassword = null;

    // Mute/Deaf state (will be used with voice handler)
    this.selfMute = ko.observable();
    this.selfDeaf = ko.observable();

    this._activateAudioLock = (reason, details = {}) => {
      this.audioManager.activateAudioLock(reason, details);
      this.selfMute(true);
      this.selfDeaf(true);
      if (voiceHandler) {
        voiceHandler.setMute(true);
      }
    };

    this._clearAudioLock = ({ resetStates = false } = {}) => {
      if (resetStates && this.audioLockActive()) {
        this.selfMute(false);
        this.selfDeaf(false);
      }
      this.audioManager.clearAudioLock();
    };

    this.notifyAudioLock = () => {
      const info = this.audioManager.getAudioLockInfo();
      this.sampleRateWarningDialog.showInfo(info.sampleRate);
    };

    this.handleUnmuteClick = () => {
      if (this.thisUser()) {
        this.requestUnmute(this.thisUser());
      }
    };

    this.handleUndeafClick = () => {
      if (this.thisUser()) {
        this.requestUndeaf(this.thisUser());
      }
    };
    
    // Beeper methods delegate to AudioManager
    this._initializePersistentBeeper = () => this.audioManager.initializePersistentBeeper();
    this._checkFullBeepReadiness = () => this.audioManager.checkFullBeepReadiness();
    
    this.startBeep = () => {
      this.audioManager.startBeep(this.connected());
    };

    this.stopBeep = () => {
      this.audioManager.stopBeep();
    };
    
    // Microphone permission methods delegate to AudioManager
    this._attemptMicrophonePermission = () => {
      this.audioManager.attemptMicrophonePermission(() => {
        // Reinitialize voice if needed
        if (this.client && !voiceHandler) {
          this._updateVoiceHandler();
        }
      });
    };

    this.retryMicrophonePermission = () => {
      this.audioManager.retryMicrophonePermission(() => {
        if (this.client && !voiceHandler) {
          this._updateVoiceHandler();
        }
      });
    };
    
    // AUDIO-CONTEXT: Initialize managed AudioContext
    this.initializeAudioContext = async () => {
      await this.audioManager.initializeAudioContext();
      this.audioContext = this.audioManager.audioContext;
    };
    
    // Initialize AudioContext
    this.initializeAudioContext();

    this.selfMute.subscribe((mute) => {
      if (voiceHandler) {
        voiceHandler.setMute(mute);
      }
    });

    this.select = (element) => {
      this.uiStateManager.select(element);
    };

    this.openSettings = () => {
      // Prevent opening settings if another modal is already open
      if (this.currentOpenModal() !== null) {
        return;
      }
      this.settingsDialog(new SettingsDialog(this.settings));
      this.currentOpenModal('settings');
    };

    this.logoutUser = () => {
      this.netlifyIdentity.logout();
      location.reload()
    };

    this.applySettings = () => {
      const settingsDialog = this.settingsDialog();

      settingsDialog.applyTo(this.settings);

      this._updateVoiceHandler();

      this.settings.save();
      this.closeSettings();
    };

    this.closeSettings = () => {
      if (this.settingsDialog()) {
        this.settingsDialog().end();
      }
      this.settingsDialog(null);
      // Clear the modal state when settings dialog is closed
      if (this.currentOpenModal() === 'settings') {
        this.currentOpenModal(null);
      }
    };

    this.connect = async (
      host,
      port,
      username,
      password,
      tokens = [],
      channelName = ""
    ) => {
      const identity = this.netlifyIdentity.currentUser();
      if (!identity || !identity.app_metadata) {
        alert(
          "You do not have permission to connect to the server. Please contact the administrator."
        );
        return;
      }

      var user_roles = identity.app_metadata.roles || [];
      if (!Array.isArray(user_roles)) {
        user_roles = [];
      }

      // Ensure roles contain defaults
      if (!user_roles.includes("watch")) user_roles.push("watch");
      if (!user_roles.includes("listen")) user_roles.push("listen");
      identity.app_metadata.roles = user_roles;

      // Prepare AudioContext information before prompting for permissions
      if (!this.audioContext) {
        await this.initializeAudioContext();
      }
      const currentSampleRate = this.audioContext
        ? this.audioContext.sampleRate
        : null;
      const audioCompatible = currentSampleRate === 48000;
      const connectionParams = {
        host,
        port,
        username,
        password,
        tokens,
        channelName,
      };

      if (!audioCompatible) {
        this.sampleRateWarningDialog.show(currentSampleRate, connectionParams);
        return;
      }

      // Request microphone permission and show overlay only if denied
      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        navigator.mediaDevices
          .getUserMedia({ audio: true })
          .then((stream) => {
            this.micPermissionDenied(false);
            stream.getTracks().forEach((track) => track.stop());
          })
          .catch((err) => {
            console.warn(
              "Microphone permission denied, showing retry option:",
              err
            );
            this.micPermissionDenied(true);
          });
      }

      this._clearAudioLock({ resetStates: true });
      await this._performConnect(connectionParams, { audioEnabled: true });
    };

    // LOOPBACK-FEATURE: Connect to server in loopback test mode
    // Routes voice through server echo (target=31) for testing audio encode/decode pipeline
    this.connectLoopback = async (
      host,
      port,
      username,
      password,
      tokens = [],
      channelName = ""
    ) => {
      // AUTH-CHECK: Verify Netlify Identity authentication before connecting
      const identity = this.netlifyIdentity.currentUser();
      if (!identity || !identity.app_metadata) {
        alert(
          "You do not have permission to connect to the server. Please contact the administrator."
        );
        return;
      }

      // ROLE-MANAGEMENT: Ensure user has minimum required roles for voice testing
      var user_roles = identity.app_metadata.roles || [];
      if (!Array.isArray(user_roles)) {
        user_roles = [];
      }

      // Add default roles if missing (watch for UI, listen for audio)
      if (!user_roles.includes("watch")) user_roles.push("watch");
      if (!user_roles.includes("listen")) user_roles.push("listen");
      identity.app_metadata.roles = user_roles;

      // AUDIO-INIT: Prepare AudioContext before requesting microphone permissions
      // This ensures audio subsystem is ready for loopback testing
      if (!this.audioContext) {
        await this.initializeAudioContext();
      }

      const connectionParams = {
        host,
        port,
        username,
        password,
        tokens,
        channelName,
        isLoopback: true, // ROUTING-FLAG: Mark connection for loopback voice routing (target=31)
      };

      // MIC-PERMISSION: Request microphone access and track permission state
      // Shows retry overlay if user denies permission
      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        navigator.mediaDevices
          .getUserMedia({ audio: true })
          .then((stream) => {
            this.micPermissionDenied(false);
            // CLEANUP: Stop temporary permission check stream immediately
            stream.getTracks().forEach((track) => track.stop());
          })
          .catch((err) => {
            console.warn(
              "Microphone permission denied, showing retry option:",
              err
            );
            this.micPermissionDenied(true);
          });
      }

      this._clearAudioLock({ resetStates: true });
      
      // MODE-FLAG: Set loopback mode before connection to affect voice handler creation
      this.isLoopbackMode(true);
      await this._performConnect(connectionParams, { audioEnabled: true });
    };

    // TEST-BUTTON: Wrapper function for the Test button - enables loopback on existing connection
    // This allows testing audio without reconnecting if already connected to server
    this.startLoopbackTest = async () => {
      if (this.connected()) {
        // ALREADY-CONNECTED: Switch existing connection to loopback mode
        // More efficient than disconnecting and reconnecting
        this.isLoopbackMode(true);
        
        // VOICE-HANDLER-RESET: Force recreation of voice handler with new loopback target
        // Old handler uses normal routing, new one will use target=31 for loopback
        if (this.voiceHandler) {
          this.voiceHandler.setMute(true);
          this.voiceHandler.end();
          this.voiceHandler = null;
        }
        
        // HANDLER-RECREATION: Create new voice handler with loopback target (31)
        this._updateVoiceHandler();
        
        // BEEPER-PREPARATION: Initialize beeper for test mode
        debugLog('[LOOPBACK]', 'Initializing beeper for test mode...');
        await this._initializePersistentBeeper();
        debugLog('[LOOPBACK]', 'Beeper initialization complete');
        
      } else {
        // NOT-CONNECTED: Use default connection parameters for initial loopback connection
        const host = this.config.defaults.host || "localhost";
        const port = this.config.defaults.port || 64738;
        const username = this.config.defaults.username || "WebClient";
        const password = this.config.defaults.password || "";
        this.connectLoopback(host, port, username, password);
      }
    };

    this._performConnect = async (
      connectionParams,
      { audioEnabled = true, sampleRate = null } = {}
    ) => {
      const {
        host,
        port,
        username,
        password,
        tokens = [],
        channelName: targetChannel = "",
      } = connectionParams;

      let channelName = targetChannel;

      if (audioEnabled) {
        initVoice(
          (data) => {
            if (!ui.client) {
              if (voiceHandler) {
                voiceHandler.end();
              }
              voiceHandler = null;
            } else if (voiceHandler) {
              voiceHandler.write(data);
            }
          },
          (err) => {
            log(translate("logentry.mic_init_error"), err);
          }
        );
      } else {
        this._activateAudioLock("sample-rate", { sampleRate });
        if (voiceHandler) {
          voiceHandler.end();
          voiceHandler = null;
        }
      }

      this.resetClient();
      
      // Set loopback mode after resetClient (which resets it to false)
      if (connectionParams.isLoopback) {
        this.isLoopbackMode(true);
      }

      this.remoteHost(host);
      this.remotePort(port);

      log(translate("logentry.connecting"), host);

      try {
        if (this.audioContext && this.audioContext.state === "suspended") {
          await this.audioContext.resume();
        } else if (!this.audioContext) {
          await this.initializeAudioContext();
        }
        
        // WARM-UP: Pre-load AudioWorklet module to reduce first-playback latency
        // BufferQueueNode loads this on-demand, but pre-loading eliminates ~50-100ms delay
        try {
          await this.audioContext.audioWorklet.addModule('playback-buffer-processor.js');
          debugLog('[AUDIO-INIT]', 'Playback AudioWorklet pre-warmed successfully');
        } catch (err) {
          // Ignore if already loaded (will happen on reconnect)
          if (err.name !== 'InvalidStateError') {
            console.warn('[AUDIO-INIT] Playback AudioWorklet pre-warm failed:', err);
          }
        }
      } catch (error) {
        console.warn("AudioContext resume failed, continuing anyway:", error);
      }

      try {
        const client = await this.connector.connect(`wss://${host}:${port}`, {
          username: username,
          password: password,
          tokens: tokens,
        });
        var user_roles =
          (this.netlifyIdentity.currentUser()?.app_metadata?.roles) || [];
        let guac_login = false;
        if (user_roles.includes("admin")) {
          guac_login = "admin";
        } else if (user_roles.includes("edit")) {
          guac_login = "editor";
        } else if (user_roles.includes("watch")) {
          guac_login = "watcher";
        }
        
        // Store Guacamole credentials for later use (e.g., when switching from loopback to normal)
        this._guacLogin = guac_login;
        this._guacPassword = this.connectDialog.password();
        
        // Only show Guacamole frame if NOT in loopback mode
        if (guac_login && !this.isLoopbackMode()) {
          this.guacamoleFrame.start(
            guac_login,
            this.connectDialog.password()
          );
          this.guacamoleFrame.show();
        } else if (!guac_login && !this.isLoopbackMode()) {
          alert("For visual access please ask your administrator.");
        }
        
        if (this.isLoopbackMode()) {
          log(translate("logentry.connected_loopback"));
        } else {
          log(translate("logentry.connected"));
        }

        this.client = client;
        client.on("error", (err) => {
          log(translate("logentry.connection_error"), err);
          this.resetClient();
        });

        if (channelName.indexOf("/") != 0) {
          channelName = "/" + channelName;
        }
        const registerChannel = (channel, channelPath) => {
          this._newChannel(channel);
          if (channelPath === channelName) {
            client.self.setChannel(channel);
          }
          channel.children.forEach((ch) =>
            registerChannel(ch, channelPath + "/" + ch.name)
          );
        };
        registerChannel(client.root, "");

        client.users.forEach((user) => this._newUser(user));

        client.on("newChannel", (channel) => this._newChannel(channel));
        client.on("newUser", (user) => this._newUser(user));

        // Ensure client.self has __ui before setting thisUser
        if (client.self && !client.self.__ui) {
          this._newUser(client.self);
        }
        
        this.thisUser(client.self.__ui);
        this.root(client.root.__ui);
        this._updateLinks();

        this._updateVoiceHandler();

        if (this.audioLockActive()) {
          this.client.setSelfMute(true);
          this.client.setSelfDeaf(true);
        } else if (this.selfDeaf()) {
          this.client.setSelfDeaf(true);
        } else if (this.selfMute()) {
          this.client.setSelfMute(true);
        }
      } catch (err) {
        if (err.$type && err.$type.name === "Reject") {
          this.connectErrorDialog.type(err.type);
          this.connectErrorDialog.reason(err.reason);
          this.connectErrorDialog.show();
        } else {
          log(translate("logentry.connection_error"), err);
        }
      }
    };

    this._newUser = (user) => {
      // Skip if UI already initialized (prevents duplicate event handlers)
      if (user.__ui) {
        return;
      }
      
      const simpleProperties = {
        uniqueId: "uid",
        username: "name",
        mute: "mute",
        deaf: "deaf",
        suppress: "suppress",
        selfMute: "selfMute",
        selfDeaf: "selfDeaf",
      };
      var ui = (user.__ui = {
        model: user,
        talking: ko.observable("off"),
        channel: ko.observable(),
      });
      ui.openContextMenu = (_, event) =>
        openContextMenu(event, this.userContextMenu, ui);

      ui.toggleMute = () => {
        if (ui.selfMute()) {
          this.requestUnmute(ui);
        } else {
          this.requestMute(ui);
        }
      };
      ui.toggleDeaf = () => {
        if (ui.selfDeaf()) {
          this.requestUndeaf(ui);
        } else {
          this.requestDeaf(ui);
        }
      };
      Object.entries(simpleProperties).forEach((key) => {
        ui[key[1]] = ko.observable(user[key[0]]);
      });
      ui.state = ko.pureComputed(userToState, ui);
      if (user.channel) {
        ui.channel(user.channel.__ui);
        ui.channel().users.push(ui);
        ui.channel().users.sort(compareUsers);
      }

      user
        .on("update", (actor, properties) => {
          Object.entries(simpleProperties).forEach((key) => {
            if (properties[key[0]] !== undefined) {
              ui[key[1]](properties[key[0]]);
            }
          });
          if (properties.channel !== undefined) {
            if (ui.channel()) {
              ui.channel().users.remove(ui);
            }
            ui.channel(properties.channel.__ui);
            ui.channel().users.push(ui);
            ui.channel().users.sort(compareUsers);
            this._updateLinks();
          }
        })
        .on("remove", () => {
          if (ui.channel()) {
            ui.channel().users.remove(ui);
          }
        })
        .on("voice", (stream) => {
          debugLog('[VOICE]', 'Voice stream received for user:', user.username);
          
          // Create audio node for playing back received voice
          var userNode = new BufferQueueNode({
            audioContext: this.audioContext,
          });
          
          // Create a GainNode to control volume (for deafen functionality)
          var gainNode = this.audioContext.createGain();
          
          // Set initial gain based on current deafen state
          gainNode.gain.value = this.selfDeaf() ? 0 : 1;
          debugLog('[VOICE]', 'Initial gain set to:', gainNode.gain.value, '(selfDeaf:', this.selfDeaf(), ')');
          
          // Connect: userNode -> gainNode -> destination
          userNode.connect(gainNode);
          gainNode.connect(this.audioContext.destination);
          
          // Subscribe to selfDeaf changes to update gain
          var deafSubscription = this.selfDeaf.subscribe((isDeaf) => {
            gainNode.gain.value = isDeaf ? 0 : 1;
            debugLog('[VOICE]', 'Gain updated to:', gainNode.gain.value, '(deaf:', isDeaf, ')');
          });

          stream
            .on("data", (data) => {
              debugLog('[VOICE]', 'Audio data received, target:', data.target, 'buffer size:', data.buffer?.length);
              
              if (data.target === "normal") {
                ui.talking("on");
              } else if (data.target === "shout") {
                ui.talking("shout");
              } else if (data.target === "whisper") {
                ui.talking("whisper");
              } else if (data.target === "loopback") {
                // Server loopback - show talking status
                ui.talking("on");
                debugLog('[VOICE]', 'Loopback audio received!');
              }
              
              userNode.write(data.buffer);
            })
            .on("end", () => {
              debugLog('[VOICE]', 'Voice stream ended for user:', user.username);
              ui.talking("off");
              userNode.end();
              // Clean up subscription when stream ends
              deafSubscription.dispose();
            });
        });
    };

    this._newChannel = (channel) => {
      // Skip if UI already initialized (prevents duplicate event handlers)
      if (channel.__ui) {
        return;
      }
      
      const simpleProperties = {
        position: "position",
        name: "name",
        description: "description",
      };
      var ui = (channel.__ui = {
        model: channel,
        expanded: ko.observable(true),
        parent: ko.observable(),
        channels: ko.observableArray(),
        users: ko.observableArray(),
        linked: ko.observable(false),
      });
      ui.userCount = () => {
        return ui
          .channels()
          .reduce((acc, c) => acc + c.userCount(), ui.users().length);
      };
      ui.openContextMenu = (_, event) =>
        openContextMenu(event, this.channelContextMenu, ui);
      Object.entries(simpleProperties).forEach((key) => {
        ui[key[1]] = ko.observable(channel[key[0]]);
      });
      if (channel.parent) {
        ui.parent(channel.parent.__ui);
        ui.parent().channels.push(ui);
        ui.parent().channels.sort(compareChannels);
      }
      this._updateLinks();

      channel
        .on("update", (properties) => {
          Object.entries(simpleProperties).forEach((key) => {
            if (properties[key[0]] !== undefined) {
              ui[key[1]](properties[key[0]]);
            }
          });
          if (properties.parent !== undefined) {
            if (ui.parent()) {
              ui.parent().channel.remove(ui);
            }
            ui.parent(properties.parent.__ui);
            ui.parent().channels.push(ui);
            ui.parent().channels.sort(compareChannels);
          }
          if (properties.links !== undefined) {
            this._updateLinks();
          }
        })
        .on("remove", () => {
          if (ui.parent()) {
            ui.parent().channels.remove(ui);
          }
          this._updateLinks();
        });
    };

    this.resetClient = () => {
      this.stopBeep(); // Stop beep if active
      this.connectionManager.resetClient();
      this.client = this.connectionManager.client;
      this.selected(null);
      this.audioManager.resetLoopbackMode();
      this.audioManager.resetBeeper();
    };

    this.connected = () => this.connectionManager.connected();

    // VOICE-HANDLER-UPDATE: Recreate voice handler when mode or target changes
    // Called when switching between normal/loopback mode or changing PTT/continuous settings
    this._updateVoiceHandler = () => {
      if (!this.client) {
        return;
      }
      
      // CLEANUP: Destroy existing handler before creating new one
      if (voiceHandler) {
        voiceHandler.end();
        voiceHandler = null;
      }
      
      // RESET-READY: Mark voice handler as not ready during recreation
      this.voiceHandlerReady(false);
      debugLog('[VOICE-HANDLER]', 'Recreating voice handler...');
      
      let mode = this.settings.voiceMode;
      
      // TARGET-ROUTING: Determine voice routing target based on mode
      // target=31 routes to server loopback for echo testing (loopback mode)
      // target=0 routes normally to channel/user (normal mode)
      let target = this.isLoopbackMode() ? 31 : 0;
      
      // HANDLER-CREATION: Create appropriate handler based on voice activation mode
      if (mode === "cont") {
        // Continuous transmission - always sending audio
        voiceHandler = new ContinuousVoiceHandler(this.client, this.settings, target);
      } else if (mode === "ptt") {
        // Push-to-talk - only sending when key is pressed
        voiceHandler = new PushToTalkVoiceHandler(this.client, this.settings, target);
      } else {
        log(translate("logentry.unknown_voice_mode"), mode);
        return;
      }
      
      // UI-BINDING: Connect voice handler events to UI talking indicators
      voiceHandler.on("started_talking", () => {
        if (this.thisUser()) {
          this.thisUser().talking("on");
        }
      });
      voiceHandler.on("stopped_talking", () => {
        if (this.thisUser()) {
          this.thisUser().talking("off");
        }
      });
      
      // MUTE-STATE: Apply current mute state to new handler
      if (this.audioLockActive() || this.selfMute()) {
        voiceHandler.setMute(true);
      }

      this.client.setAudioQuality(
        this.settings.audioBitrate,
        this.settings.samplesPerPacket
      );
      
      // VOICE-HANDLER-READY: Mark voice handler as initialized
      // This signals that the voice path to server is established
      this.voiceHandlerReady(true);
      debugLog('[VOICE-HANDLER]', 'Voice handler fully initialized and ready');
      
      // Check if both beeper and voice handler are now ready
      this._checkFullBeepReadiness();
      
      // BEEPER-AUTO-INIT: Initialize beeper when voice handler is ready and test is active
      // This ensures the button appears automatically once everything is set up
      if (this.connectDialog.isTestActive()) {
        setTimeout(async () => {
          await this._initializePersistentBeeper();
        }, 100); // Small delay to ensure mixer is fully ready
      }
    };

    this.messageBoxHint = ko.pureComputed(() => {
      if (!this.thisUser()) {
        return ""; // Not yet connected
      }
      var target = this.selected();
      if (!target) {
        target = this.thisUser();
      }
      if (target === this.thisUser()) {
        target = target.channel();
      }
      if (target.users) {
        // Channel
        return translate("chat.channel_message_placeholder").replace(
          "%1",
          target.name()
        );
      } else {
        // User
        return translate("chat.user_message_placeholder").replace(
          "%1",
          target.name()
        );
      }
    });

    this.submitMessageBox = () => {
      this.sendMessage(this.selected(), this.messageBox());
      this.messageBox("");
    };

    this.mailToDesktop = ko.observable(
      "mailto:mail@" +
      window.location.hostname +
      "?subject=Send%20attachment%20to%20desktop"
    );

    this.sendMessage = (target, message) => {
      if (this.connected()) {
        // If no target is selected, choose our own user
        if (!target) {
          target = this.thisUser();
        }
        // If target is our own user, send to our channel
        if (target === this.thisUser()) {
          target = target.channel();
        }
        // Send message
        target.model.sendMessage(message);
      }
    };

    this.requestMute = (user) => {
      if (user !== this.thisUser()) return;
      this.selfMute(true);
      if (this.connected()) {
        this.client.setSelfMute(true);
      }
    };

    this.requestDeaf = (user) => {
      if (user !== this.thisUser()) return;
      
      // LOOPBACK-FEATURE: Allow deaf without mute in loopback test mode
      // In normal mode, deaf automatically enables mute (standard Mumble behavior)
      // In loopback mode, allow deaf without mute for testing purposes
      if (!this.isLoopbackMode()) {
        this.selfMute(true);
      }
      
      this.selfDeaf(true);
      if (this.connected()) {
        this.client.setSelfDeaf(true);
      }
    };

    this.requestUnmute = (user) => {
      if (this.audioLockActive()) {
        this.notifyAudioLock();
        return;
      }
      if (user !== this.thisUser()) {
        return;
      }
      
      this.selfMute(false);
      this.selfDeaf(false);
      
      if (this.connected()) {
        this.client.setSelfMute(false);
        this.client.setSelfDeaf(false);
      }
    };

    this.requestUndeaf = (user) => {
      if (this.audioLockActive()) {
        this.notifyAudioLock();
        return;
      }
      if (user !== this.thisUser()) return;
      this.selfDeaf(false);
      if (this.connected()) {
        this.client.setSelfDeaf(false);
      }
    };

    this._updateLinks = () => {
      this.channelManager.updateLinks(this.root, this.thisUser);
    };

    this.openSourceCode = () => {
      var homepage = require("../package.json").homepage;
      window.open(homepage, "_blank").focus();
    };
  }
}
var ui = new GlobalBindings(window.mumbleWebConfig);

// Used only for debugging
window.mumbleUi = ui;

// Make auth available globally (backward compatibility)
if (ui.auth) {
  window.netlifyIdentity = ui.auth;
}

async function initializeUI() {
  // Initialize auth provider
  let user = null;
  try {
    await ui.auth.init(window.mumbleWebConfig.auth?.netlify || {
      APIUrl: "https://welcome.flexpair.com/identity-proxy",
      locale: "en",
      logo: false,
    });
    user = ui.auth.currentUser();
  } catch (e) {
    console.warn('[Auth] Initialization failed; continuing without authentication', e);
  }

  ui.auth.on("login", (user) => {
    const username = getUsernameFromMetadata(user);
    if (username) {
      ui.connectDialog.username(username);
    }
    ui.auth.close();
    // Show connect dialog after successful authentication
    ui.connectDialog.show();
  });

  ui.auth.on("close", () => {
    if (!ui.connectDialog.username()) {
      ui.auth.open("login"); // open the modal to the login tab
    } else {
      // Show connect dialog when auth modal is closed and user is authenticated
      ui.connectDialog.show();
    }
  });

  ui.auth.on("error", (err) => {
    console.warn("[Auth] Authentication error:", err);
    // Show connect dialog even if auth fails to allow retry
    ui.connectDialog.show();
  });

  if (user == null) {
    // Hide connect dialog when showing authentication modal
    ui.connectDialog.hide();
    ui.auth.open("signup"); // open the modal to the signup tab
  } else {
    const username = getUsernameFromMetadata(user);
    if (username) {
      ui.connectDialog.username(username);
    }
    // User is already authenticated, show connect dialog
    ui.connectDialog.show();
  }

  var queryParams = url.parse(document.location.href, true).query;
  queryParams = Object.assign({}, window.mumbleWebConfig.defaults, queryParams);
  if (queryParams.address) {
    ui.connectDialog.address(queryParams.address);
  }
  if (queryParams.port) {
    ui.connectDialog.port(queryParams.port);
  }
  if (queryParams.password) {
    ui.connectDialog.password(queryParams.password);
  }
  ko.applyBindings(ui);
}

function log() {
  console.log.apply(console, arguments);
}

function compareChannels(c1, c2) {
  if (c1.position() === c2.position()) {
    return c1.name() === c2.name() ? 0 : c1.name() < c2.name() ? -1 : 1;
  }
  return c1.position() - c2.position();
}

function compareUsers(u1, u2) {
  return u1.name() === u2.name() ? 0 : u1.name() < u2.name() ? -1 : 1;
}

function userToState() {
  var flags = [];
  if (this.uid()) {
    flags.push("Authenticated");
  }
  if (this.mute()) {
    flags.push("Muted (server)");
  }
  if (this.deaf()) {
    flags.push("Deafened (server)");
  }
  if (this.selfMute()) {
    flags.push("Muted (self)");
  }
  if (this.selfDeaf()) {
    flags.push("Deafened (self)");
  }
  return flags.join(", ");
}

var voiceHandler;

async function main() {
  document.title = window.location.hostname;
  await localizationInitialize('en'); // Always use English
  translateEverything();
  initializeUI();
  enumMicrophones();
}

window.onload = main;
