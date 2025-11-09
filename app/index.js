// Removed legacy 'subworkers' import: nested worker polyfill caused constructor hijack issues.
// Removed redundant manual Buffer/process attachment (handled by ProvidePlugin + DefinePlugin)
import url from "node:url";
import MumbleClient from "./mumble-client/index.js";
import AuthFactory from "./auth/AuthFactory";
import AppState from "./state/AppState";

// Vue.js imports
import { createApp } from 'vue';
import AppVue from "./components/App.vue";

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

// DEPRECATED Knockout classes - kept for backward compatibility during migration
// DEPRECATED Knockout classes - kept for backward compatibility during migration
// These will be removed once Vue migration is complete
import ko from "knockout";

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

// [MIGRATION WORKAROUND] Exposing AppState on window global is required for Knockout.js + Vue.js dual runtime.
// This creates tight coupling and bypasses Vue's dependency injection.
// TODO: Remove this in Phase 5 cleanup after migration is complete. See docs/VUE_MIGRATION_PLAN.md for details.
globalThis.ui = ui;

// Wire up dependencies that AppState expects
// Note: connectDialog, connectErrorDialog, sampleRateWarningDialog, and connectionInfo are now Vue composables in AppState
ui.guacamoleFrame = {}; // Placeholder - Vue component will populate this in main()
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
  // Parse URL query parameters
  let queryParams = url.parse(document.location.href, true).query;
  queryParams = { ...globalThis.mumbleWebConfig.defaults, ...queryParams };
  if (queryParams.address) {
    ui.connectDialog.address.value = queryParams.address;
  }
  if (queryParams.port) {
    ui.connectDialog.port.value = queryParams.port;
  }
  if (queryParams.password) {
    ui.connectDialog.password.value = queryParams.password;
  }

  // Register event handlers BEFORE init() so they catch auto-login events
  ui.auth.on("login", (user) => {
    const username = getUsernameFromMetadata(user);
    if (username) {
      ui.connectDialog.username.value = username;
    }
    ui.auth.close();
    // Show connect dialog after successful authentication
    ui.connectDialog.visible.value = true;
  });

  ui.auth.on("close", () => {
    if (ui.connectDialog.username.value) {
      // Show connect dialog when auth modal is closed and user is authenticated
      ui.connectDialog.visible.value = true;
    } else {
      ui.auth.open("login"); // open the modal to the login tab
    }
  });

  ui.auth.on("error", (err) => {
    console.warn("[Auth] Authentication error:", err);
    // Show connect dialog even if auth fails to allow retry
    ui.connectDialog.visible.value = true;
  });

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
      ui.connectDialog.visible.value = false;
      ui.auth.open("signup"); // open the modal to the signup tab
    } else {
      const username = getUsernameFromMetadata(user);
      if (username) {
        ui.connectDialog.username.value = username;
      }
      // User is already authenticated, show connect dialog
      ui.connectDialog.visible.value = true;
    }
  })();
}

function log() {
  console.log(...arguments);
}

async function main() {
  console.log('[DEBUG] main() called - starting initialization');
  document.title = globalThis.location.hostname;
  console.log('[DEBUG] About to initialize localization');
  await localizationInitialize('en'); // Always use English
  console.log('[DEBUG] Localization complete, translating everything');
  translateEverything();
  console.log('[DEBUG] Translation complete, initializing UI');
  
  // Initialize UI state and auth
  initializeUI();
  console.log('[DEBUG] UI initialized, mounting Vue app');
  
  // Mount Vue.js App component (single root that contains all UI)
  try {
    const vueApp = createApp(AppVue);
    
    // Provide AppState, config, and translate function to all Vue components
    vueApp.provide('appState', ui);
    vueApp.provide('config', globalThis.mumbleWebConfig);
    vueApp.provide('translate', translate);
    
    const mountedApp = vueApp.mount('#app');
    
    // Make Vue app inspectable in DevTools
    globalThis.__VUE_APP__ = mountedApp;
    
    console.log('[VUE] ✅ App mounted successfully');
  } catch (error) {
    console.error('[VUE] ❌ Failed to mount App:', error);
    // Fall back to showing an error message
    document.getElementById('app').innerHTML = `
      <div style="padding: 20px; color: red; font-family: sans-serif;">
        <h2>Failed to load application</h2>
        <p>Please refresh the page or contact support.</p>
        <pre>${error.message}</pre>
      </div>
    `;
  }
  
  enumMicrophones();
}

window.onload = main;
