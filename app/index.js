// Removed legacy 'subworkers' import: nested worker polyfill caused constructor hijack issues.
// Removed redundant manual Buffer/process attachment (handled by ProvidePlugin + DefinePlugin)
import url from "node:url";
import MumbleClient from "./mumble-client/index.js";
import ko from "knockout";
import keyboardjs from "keyboardjs";
import AuthFactory from "./auth/AuthFactory";
import AppState from "./state/AppState";

// Vue.js imports
import { createApp } from 'vue';
import ConnectDialogVue from "./components/ConnectDialog.vue";


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
const urlParams = new URLSearchParams(globalThis.location.search);
const isDebugAudio = urlParams.has('debug-audio');

// Set global debug flag for audio pipeline logging
// This is checked by decoder-stream.js and vendored mumble-streams
if (isDebugAudio) {
  globalThis.MUMBLE_DEBUG_AUDIO = true;
  console.log('[DEBUG] Audio pipeline debug logging enabled via ?debug-audio parameter');
}


/**
 * Safely extracts and sanitizes username from user metadata
 * @param {Object} user - User object from auth provider
 * @returns {string|null} - Sanitized username or null if not available
 */
function getUsernameFromMetadata(user) {
  if (!user?.user_metadata?.full_name) {
    return null;
  }
  // Replace sequences of non-alphanumeric characters with single underscore
  return user.user_metadata.full_name.replaceAll(/\W+/g, "_");
}

function GuacamoleFrame() {
  // Start with null source to avoid the browser immediately requesting /guacamole/.
  // The iframe src is only assigned after a successful Mumble connect + role gating.
  // (HTML binding uses fallback about:blank when null/empty.)
  this.guacSource = ko.observable(null);
  this.visible = ko.observable(false);
  this.show = () => {
    console.log('[GuacamoleFrame] show() called, setting visible to true');
    this.visible(true);
    console.log('[GuacamoleFrame] visible is now:', this.visible());
  };
  this.hide = () => {
    console.log('[GuacamoleFrame] hide() called, setting visible to false');
    this.visible(false);
  };
  this.loading = ko.observable(false);
  this.error = ko.observable(null);

  this.start = function (guacUser, password) {
    console.log('[GuacamoleFrame] start() called with:', { guacUser, password: password ? '***' : null });
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
    console.log('[GuacamoleFrame] Setting guacSource to:', src);
    this.guacSource(src);
    console.log('[GuacamoleFrame] guacSource() is now:', this.guacSource());
  };

  this.onLoad = function () {
    this.loading(false);
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
      return String(Math.round(value));
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
    this.latencyMs = ko.observable(Number.NaN);
    this.latencyDeviation = ko.observable(Number.NaN);
    this.remoteHost = ko.observable();
    this.remotePort = ko.observable();
    this.maxBitrate = ko.observable(Number.NaN);
    this.currentBitrate = ko.observable(Number.NaN);
    this.maxBandwidth = ko.observable(Number.NaN);
    this.currentBandwidth = ko.observable(Number.NaN);
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
      this.latencyMs(Number.NaN);
      this.latencyDeviation(Number.NaN);
    }
    this.remoteHost(this._ui.remoteHost());
    this.remotePort(this._ui.remotePort());

    let spp = this._ui.settings.samplesPerPacket;
    if (client) {
      let maxBandwidth = client.maxBandwidth;
      let maxBitrate = maxBandwidth === null || maxBandwidth === undefined ? Number.NaN : client.getMaxBitrate(spp, false);
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
      this.maxBitrate(Number.NaN);
      this.currentBitrate(Number.NaN);
      this.maxBandwidth(Number.NaN);
      this.currentBandwidth(Number.NaN);
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

  end() {
    // Cleanup method called when dialog is closed
    // Currently no cleanup needed, but method must exist for UIState.closeSettings()
  }
}

class Settings {
  constructor(defaults) {
    const load = (key) => globalThis.localStorage.getItem("mumble." + key);
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
      globalThis.localStorage.setItem("mumble." + key, val);
    save("voiceMode", this.voiceMode);
    save("pttKey", this.pttKey);
    save("userCountInChannelName", this.userCountInChannelName());
    save("audioBitrate", this.audioBitrate);
    save("samplesPerPacket", this.samplesPerPacket);
  }
}

// Initialize UI with modular AppState architecture
const ui = new AppState(globalThis.mumbleWebConfig, log);

// === Vue.js Integration (Replacing Knockout ConnectDialog) ===
const vueApp = createApp({
  components: { ConnectDialogVue },
  template: '<ConnectDialogVue />'
});
vueApp.provide('appState', ui);
vueApp.provide('config', ui.config);
vueApp.config.globalProperties.$t = (key) => translate(key);

// Wire up dependencies that AppState expects
// Provide Knockout-compatible stub for connectDialog to satisfy legacy code
// The Vue component will sync with these observables bidirectionally
console.log('[Init] mumbleWebConfig.defaults:', globalThis.mumbleWebConfig.defaults);

// Ensure address is set (runtime evaluation)
if (!globalThis.mumbleWebConfig.defaults.address) {
  globalThis.mumbleWebConfig.defaults.address = globalThis.location.hostname;
}

ui.connectDialog = {
  address: ko.observable(globalThis.mumbleWebConfig.defaults.address),
  port: ko.observable(globalThis.mumbleWebConfig.defaults.port),
  username: ko.observable(''),
  password: ko.observable(''),
  visible: ko.observable(false),
  isTestActive: ko.observable(false), // Loopback test mode
  show: function() { this.visible(true); },
  hide: function() { this.visible(false); },
  toggleLoopback: async function() {
    const newState = !this.isTestActive();
    this.isTestActive(newState);
    
    if (newState) {
      await ui.voice.activateLoopback();
      
      // Start loopback test (connects to server if needed)
      await ui.startLoopbackTest();
    } else {
      ui.voice.deactivateLoopback();
      
      // Disconnect when exiting test mode
      if (ui.connected()) {
        ui.connection.resetClient();
      }
    }
  },
  connect: async function() {
    console.log('[ConnectDialog] connect() called', {
      isTestActive: this.isTestActive(),
      connected: ui.connected(),
      _guacLogin: ui._guacLogin,
      _guacPassword: ui._guacPassword ? '***' : null
    });
    
    // If in loopback test mode, exit it first and reconnect normally
    if (this.isTestActive()) {
      console.log('[ConnectDialog] Exiting test mode before normal connection');
      this.isTestActive(false);
      ui.voice.deactivateLoopback();
      
      // Recreate voice handler with normal target (not loopback target 31)
      ui._updateVoiceHandler();
      
      // GUACAMOLE-INTEGRATION: Show Guacamole desktop frame after exiting test mode
      // Uses stored credentials from initial connection
      if (ui._guacLogin) {
        console.log('[ConnectDialog] Showing Guacamole with stored credentials:', ui._guacLogin);
        ui.guacamoleFrame.loading(false);
        ui.guacamoleFrame.start(ui._guacLogin, ui._guacPassword);
        ui.guacamoleFrame.show();
        console.log('[ConnectDialog] guacamoleFrame.visible() =', ui.guacamoleFrame.visible());
      } else {
        console.log('[ConnectDialog] No guac login available - ui._guacLogin =', ui._guacLogin);
        ui.guacamoleFrame.loading(false);
      }
      
      this.hide();
      return;
    }
    // If already connected in normal mode, just hide dialog
    else if (ui.connected()) {
      console.log('[ConnectDialog] Already connected in normal mode, just hiding dialog');
      this.hide();
      return;
    }
    
    console.log('[ConnectDialog] Starting new connection');
    this.hide();
    
    // Debug: Log all observable values
    console.log('[ConnectDialog] this.address():', this.address());
    console.log('[ConnectDialog] this.port():', this.port());
    console.log('[ConnectDialog] this.username():', this.username());
    console.log('[ConnectDialog] globalThis.mumbleWebConfig:', globalThis.mumbleWebConfig);
    console.log('[ConnectDialog] globalThis.location.hostname:', globalThis.location.hostname);
    
    // Get current values or fallback to defaults
    const address = this.address() || globalThis.mumbleWebConfig.defaults.address || globalThis.location.hostname;
    const port = this.port() || globalThis.mumbleWebConfig.defaults.port;
    const username = this.username() || globalThis.mumbleWebConfig.defaults.username;
    const password = this.password() || globalThis.mumbleWebConfig.defaults.password;
    
    console.log('[ConnectDialog] this.address():', this.address());
    console.log('[ConnectDialog] this.port():', this.port());
    console.log('[ConnectDialog] globalThis.mumbleWebConfig.defaults:', globalThis.mumbleWebConfig.defaults);
    console.log('[ConnectDialog] Connection params:', { address, port, username, password: password ? '***' : null });
    
    if (!address) {
      console.error('[ConnectDialog] ERROR: address is still undefined!');
      alert('Cannot connect: server address is not configured');
      return;
    }
    
    const connectionParams = {
      host: address,  // Note: ConnectionState.connect() expects 'host', not 'address'
      port,
      username,
      password,
      tokens: []
    };
    
    console.log('[ConnectDialog] Calling _performConnect with:', connectionParams);
    await ui._performConnect(connectionParams, { audioEnabled: true });
  }
};
// Beeper state observables for Vue ConnectDialog (delegate to AppState)
Object.defineProperty(ui, 'beeperReady', {
  get() { return ui.audio.beeperReady; },
  enumerable: true
});

Object.defineProperty(ui, 'voiceHandlerReady', {
  get() { return ui.voice.voiceHandlerReady; },
  enumerable: true
});

Object.defineProperty(ui, 'isBeeping', {
  get() { return ui.audio.isBeeping; },
  enumerable: true
});

// Beeper methods for Vue ConnectDialog
ui.startBeep = function() {
  if (ui.audio?.startBeep) {
    ui.audio.startBeep();
  }
};

ui.stopBeep = function() {
  if (ui.audio?.stopBeep) {
    ui.audio.stopBeep();
  }
};

ui.connectErrorDialog = new ConnectErrorDialog(ui.connectDialog);
ui.sampleRateWarningDialog = new SampleRateWarningDialog(ui);
ui.guacamoleFrame = new GuacamoleFrame();
ui.connectionInfo = new ConnectionInfo(ui);
ui.settings = new Settings(globalThis.mumbleWebConfig.settings);
ui.settingsDialogInstance = new SettingsDialog(ui.settings);

// Initialize auth
const authConfig = globalThis.mumbleWebConfig?.auth || { provider: 'netlify' };
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

// Expose closeSettings at root level for Knockout bindings
ui.closeSettings = function() {
  return ui.ui.closeSettings();
};

// Used only for debugging
globalThis.mumbleUi = ui;

// Make auth available globally (backward compatibility)
if (ui.auth) {
  globalThis.netlifyIdentity = ui.auth;
}

function initializeUI() {
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
    if (ui.connectDialog.username()) {
      // Show connect dialog when auth modal is closed and user is authenticated
      ui.connectDialog.show();
    } else {
      ui.auth.open("login"); // open the modal to the login tab
    }
  });

  ui.auth.on("error", (err) => {
    console.warn("[Auth] Authentication error:", err);
    // Show connect dialog even if auth fails to allow retry
    ui.connectDialog.show();
  });

  // Apply Knockout bindings IMMEDIATELY to prevent white screen
  // This must happen before async auth initialization
  let queryParams = url.parse(document.location.href, true).query;
  queryParams = { ...globalThis.mumbleWebConfig.defaults, ...queryParams };
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

  // Initialize auth asynchronously (don't block UI)
  (async () => {
    let user = null;
    try {
      await ui.auth.init(globalThis.mumbleWebConfig.auth?.netlify || {
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
  })();
}

function log() {
  console.log(...arguments);
}

async function main() {
  document.title = globalThis.location.hostname;
  await localizationInitialize('en'); // Always use English
  translateEverything();
  initializeUI(); // Initialize UI (Knockout bindings applied immediately, auth loads async)
  
  // Mount Vue.js ConnectDialog (replaces Knockout version)
  console.log('[VUE] Mounting Vue.js ConnectDialog');
  try {
    vueApp.mount('#vue-connect-dialog-root');
    // Hide Knockout version (template kept for reference)
    const knockoutDialog = document.getElementById('knockout-connect-dialog');
    if (knockoutDialog) {
      knockoutDialog.style.display = 'none';
    }
    console.log('[VUE] Vue.js ConnectDialog mounted successfully (Knockout version hidden)');
  } catch (error) {
    console.error('[VUE] Failed to mount ConnectDialog:', error);
  }
  
  enumMicrophones();
}

window.onload = main;
