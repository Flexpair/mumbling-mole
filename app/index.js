// Removed legacy 'subworkers' import: nested worker polyfill caused constructor hijack issues.
// Removed redundant manual Buffer/process attachment (handled by ProvidePlugin + DefinePlugin)
import url from "url";
import MumbleClient from "mumble-client";
import ko from "knockout";
import keyboardjs from "keyboardjs";
import AuthFactory from "./auth/AuthFactory";
import AppState from "./state/AppState";


import {
  enumMicrophones,
} from "./audio/voice";
import {
  initialize as localizationInitialize,
  translateEverything,
  translate,
} from "./localize";


// Debug flag for controlling verbose logging in voice handlers
const DEBUG_VOICE_LOGGING = false; // Set to true for development debugging

// Check URL parameters for debug-audio flag (used in automated tests)
const urlParams = new URLSearchParams(window.location.search);
const isDebugAudio = urlParams.has('debug-audio');

// Set global debug flag for audio pipeline logging
// This is checked by decoder-stream.js and vendored mumble-streams
if (isDebugAudio) {
  window.MUMBLE_DEBUG_AUDIO = true;
  console.log('[DEBUG] Audio pipeline debug logging enabled via ?debug-audio parameter');
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
  // Start with null source to avoid the browser immediately requesting /guacamole/.
  // The iframe src is only assigned after a successful Mumble connect + role gating.
  // (HTML binding uses fallback about:blank when null/empty.)
  this.guacSource = ko.observable(null);
  this.visible = ko.observable(false);
  this.show = this.visible.bind(this.visible, true);
  this.hide = this.visible.bind(this.visible, false);
  this.loading = ko.observable(false);
  this.error = ko.observable(null);

  this.start = function (guacUser, password) {
    this.loading(true);
    this.error(null);
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
    this.guacSource(src);
  };

  this.onLoad = function () {
    this.loading(false);
    try {
      const frame = document.getElementById("guacframe");
    } catch (e) {
      console.warn("[Guac] cannot inspect iframe content", e);
    }
  };
}

function ConnectDialog() {
  this.address = ko.observable("");
  this.port = ko.observable("");
  this.username = ko.observable("");
  this.password = ko.observable("");
  // Start hidden - will be shown after authentication
  this.visible = ko.observable(false);
  // LOOPBACK-FEATURE: Track whether loopback test mode is active (prevents deactivation once started)
  this.isTestActive = ko.observable(false);
  this.show = this.visible.bind(this.visible, true);
  this.hide = this.visible.bind(this.visible, false);
  
  this.connect = () => {
    this.hide();
    
    // LOOPBACK-FEATURE: When already connected, this transitions from test mode back to normal mode
    if (ui.connected()) {
      // Switch from loopback test mode back to normal voice routing
      this.isTestActive(false);
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
      this.isTestActive(false);
      ui.connect(this.address(), this.port(), this.username(), this.password());
    }
  };
  
  // LOOPBACK-FEATURE: Toggle button handler - activates loopback test mode
  this.toggleLoopback = async () => {
      // One-way activation: prevent deactivation via this button (use Connect button instead)
      if (this.isTestActive()) {
        return;
      }
      
      // USER-GESTURE: Ensure AudioContext is created and running SYNCHRONOUSLY in click handler
      // This must happen before any async operations that might lose the user gesture context
      try {
        // Mark user interaction for audio-context-manager
        if (ui.audio && ui.audio.audioContextManager) {
          ui.audio.audioContextManager.userInteractionDetected = true;
        }
        
        // Create AudioContext if not exists
        if (!ui.audio.audioContext) {
          console.log('[LOOPBACK] Creating AudioContext on user click');
          await ui.audio.initializeAudioContext();
        }
        
        // Resume if suspended
        if (ui.audio.audioContext && ui.audio.audioContext.state === 'suspended') {
          console.log('[LOOPBACK] Resuming AudioContext on user click');
          await ui.audio.audioContext.resume();
        }
        
        console.log('[LOOPBACK] AudioContext ready:', ui.audio.audioContext.state);
      } catch (err) {
        console.error('[LOOPBACK] Failed to prepare AudioContext on click:', err);
      }
      
      // Mark test as active and connect in loopback mode
      this.isTestActive(true);
      
      // MODAL-BEHAVIOR: Keep dialog open during loopback test (don't call self.hide())
      // This allows user to see connection status and switch back to normal mode
      ui.connectLoopback(this.address(), this.port(), this.username(), this.password());
    };  
  
  // LEGACY-COMPAT: Legacy function for backward compatibility (closes dialog like old behavior)
  this.connectLoopback = () => {
    this.hide();
    ui.connectLoopback(this.address(), this.port(), this.username(), this.password());
  };
}

function ConnectErrorDialog(connectDialog) {
  this.type = ko.observable(0);
  this.reason = ko.observable("");
  this.username = connectDialog.username;
  this.password = connectDialog.password;
  this.visible = ko.observable(false);
  this.show = this.visible.bind(this.visible, true);
  this.hide = this.visible.bind(this.visible, false);
  this.connect = () => {
    this.hide();
    connectDialog.connect();
  };
}

function SampleRateWarningDialog(ui) {
  this.visible = ko.observable(false);
  this.mode = ko.observable("confirm");
  this.sampleRate = ko.observable(null);
  this.pendingConnection = null;

  const formatSampleRate = (value) => {
    if (typeof value === "number" && !Number.isNaN(value) && value > 0) {
      return Math.round(value);
    }
    return translate("audio.sample_rate.warning.unknown_rate");
  };

  this.title = ko.pureComputed(() => translate("audio.sample_rate.warning.title"));
  this.isConfirm = ko.pureComputed(() => this.mode() === "confirm");
  this.description = ko.pureComputed(() => {
    const key = this.isConfirm()
      ? "audio.sample_rate.warning.body"
      : "audio.sample_rate.warning.info";
    const template = translate(key);
    return template.replace("%1", formatSampleRate(this.sampleRate()));
  });
  this.primaryLabel = ko.pureComputed(() => translate("audio.sample_rate.warning.accept"));
  this.secondaryLabel = ko.pureComputed(() => {
    const key = this.isConfirm()
      ? "audio.sample_rate.warning.cancel"
      : "audio.sample_rate.warning.close";
    return translate(key);
  });
  this.hintsTitle = ko.pureComputed(() => translate("audio.sample_rate.warning.hints_title"));
  this.hints = ko.pureComputed(() => {
    const hintKeys = [
      "audio.sample_rate.warning.hints.item1",
      "audio.sample_rate.warning.hints.item2",
      "audio.sample_rate.warning.hints.item3"
    ];
    return hintKeys
      .map((key) => translate(key))
      .filter((text) => text && !/^\{\{.*\}\}$/.test(text));
  });

  this.show = (sampleRate, params) => {
    if (ui.currentOpenModal() !== null) {
      return;
    }
    this.mode("confirm");
    this.sampleRate(sampleRate || null);
    this.pendingConnection = params || null;
    this.visible(true);
    ui.currentOpenModal('sampleRateWarning');
  };

  this.showInfo = (sampleRate) => {
    if (ui.currentOpenModal() !== null) {
      return;
    }
    this.mode("info");
    this.sampleRate(sampleRate || null);
    this.pendingConnection = null;
    this.visible(true);
    ui.currentOpenModal('sampleRateWarning');
  };

  this.hide = () => {
    this.visible(false);
    if (ui.currentOpenModal() === 'sampleRateWarning') {
      ui.currentOpenModal(null);
    }
    this.pendingConnection = null;
  };

  this.joinWithoutAudio = () => {
    const params = this.pendingConnection;
    const sampleRate = this.sampleRate();
    this.hide();
    if (params) {
      ui._performConnect(params, {
        audioEnabled: false,
        sampleRate,
      });
    }
  };

  this.cancel = () => {
    this.hide();
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

  recordPttKey() {
    let combo = [];
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

// Initialize UI with modular AppState architecture
const ui = new AppState(window.mumbleWebConfig, log);

// Wire up dependencies that AppState expects
ui.connectDialog = new ConnectDialog();
ui.connectErrorDialog = new ConnectErrorDialog(ui.connectDialog);
ui.sampleRateWarningDialog = new SampleRateWarningDialog(ui);
ui.guacamoleFrame = new GuacamoleFrame();
ui.connectionInfo = new ConnectionInfo(ui);
ui.settings = new Settings(window.mumbleWebConfig.settings);
ui.settingsDialogInstance = new SettingsDialog(ui.settings);

// Initialize auth
const authConfig = window.mumbleWebConfig?.auth || { provider: 'netlify' };
ui.auth = AuthFactory.create(authConfig);
ui.netlifyIdentity = ui.auth; // Backward compatibility

// Override openSettings to ensure the local SettingsDialog class is used
// Knockout click bindings pass the event as first parameter, so we ignore it
// and always use the local SettingsDialog constructor
ui.openSettings = function() {
  // Ignore any parameters (e.g., click events from Knockout bindings)
  // Always use the local SettingsDialog class defined in this file
  return ui.ui.openSettings(ui.settings, SettingsDialog);
};

// Used only for debugging
window.mumbleUi = ui;

// Make auth available globally (backward compatibility)
if (ui.auth) {
  window.netlifyIdentity = ui.auth;
}

async function initializeUI() {
  // Initialize auth provider
  let user = null;
  
  // Register event handlers BEFORE init() so they catch auto-login events
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

  // Now initialize auth (event handlers are already registered)
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

  let queryParams = url.parse(document.location.href, true).query;
  queryParams = { ...window.mumbleWebConfig.defaults, ...queryParams};
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
  console.log(...arguments);
}





async function main() {
  document.title = window.location.hostname;
  await localizationInitialize('en'); // Always use English
  translateEverything();
  initializeUI();
  enumMicrophones();
}

window.onload = main;
