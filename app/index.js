// Removed legacy 'subworkers' import: nested worker polyfill caused constructor hijack issues.
// Removed redundant manual Buffer/process attachment (handled by ProvidePlugin + DefinePlugin)
import url from "node:url";
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
// Import Vue composables for settings
import { useSettings } from "./composables/index.js";

// Initialize UI with modular AppState architecture
const ui = new AppState(globalThis.mumbleWebConfig, log);

// [MIGRATION STATUS] Vue.js UI migration is COMPLETE (all 9 components migrated Nov 2025).
// However, core state modules (AppState, AudioState, VoiceState, UIState, UserState, ConnectionState)
// still use Knockout observables for backward compatibility.
//
// This global exposure is currently required for:
// 1. Browser console debugging (via globalThis.mumbleUi)
// 2. Worker thread communication (worker-client.js references state)
// 3. Potential remaining Knockout subscriptions in state modules
//
// REMOVAL PLAN: Can be safely removed only after:
// 1. State modules migrated from Knockout observables to Vue composables (estimated 2-3 weeks)
// 2. All cross-module subscriptions converted to Vue watch/watchEffect
// 3. Worker communication updated to use Vue-compatible state references
// 4. Full regression test suite passes without globalThis.ui
//
// See app/state/README.md "Next Phase: State Module Migration to Vue.js" for migration roadmap.
globalThis.ui = ui;

// Wire up dependencies that AppState expects
// Note: connectDialog, connectErrorDialog, sampleRateWarningDialog, connectionInfo are now Vue composables in AppState
// Settings is now a Vue composable too
ui.guacamoleFrame = {}; // Placeholder - Vue component will populate this in main()
ui.settings = useSettings(globalThis.mumbleWebConfig.settings);
// settingsDialogInstance is now deprecated - SettingsDialog.vue uses ui.settings directly

// Initialize auth
const authConfig = globalThis.mumbleWebConfig?.auth || { provider: 'netlify' };
ui.auth = AuthFactory.create(authConfig);
ui.netlifyIdentity = ui.auth; // Backward compatibility

// Delegate UI methods to UIState composable
ui.openSettings = function() {
  return ui.ui.openSettings(); // No more SettingsDialog class needed
};

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
