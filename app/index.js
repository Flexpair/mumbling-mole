import AuthFactory from "./auth/AuthFactory";
import AppState from "./stores/AppState";
import { createApp } from 'vue';
import { createPinia, setActivePinia } from 'pinia';
import AppVue from "./components/App.vue";

import {
  enumMicrophones,
} from "./audio/voice";
import {
  translate,
} from "./localize";

// Check URL parameters for debug-audio flag (used in automated tests)
const urlParams = new URLSearchParams(globalThis.location.search);
const isDebugAudio = urlParams.has('debug-audio');
const isMockAuth = urlParams.has('mock-auth');

// Global debug flag for general logging; enable by ?debug in URL
const isDebug = urlParams.has('debug') || !!globalThis.mumbleWebConfig?.debug;

if (isDebugAudio) {
  globalThis.MUMBLE_DEBUG_AUDIO = true;
}

function log() {
  if (!isDebug) return;
  console.log(...arguments);
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

import { useSettings, vTooltip } from "./composables/index.js";

// Initialize Pinia before AppState to allow stores to be used
const pinia = createPinia();
setActivePinia(pinia);

const ui = new AppState(globalThis.mumbleWebConfig, log);
globalThis.ui = ui;

ui.guacamoleFrame = {};
ui.settings = useSettings(globalThis.mumbleWebConfig.settings);
ui.user.setSettings(ui.settings);

let authConfig = globalThis.mumbleWebConfig?.auth || { provider: 'netlify' };

// Override with mock auth if requested via URL (used for automated tests)
if (isMockAuth) {
  console.log('[Auth] Using MockAuthAdapter via ?mock-auth parameter');
  authConfig = { 
    provider: 'mock',
    mock: { autoLogin: true }
  };
}

ui.auth = AuthFactory.create(authConfig);

globalThis.mumbleUi = ui;


/**
 * Apply URL query parameters to connect dialog
 */
function applyQueryParamsToConnectDialog() {
  const urlObj = new URL(document.location.href);
  let queryParams = Object.fromEntries(urlObj.searchParams.entries());
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
}

/**
 * Handle successful login event
 */
function handleAuthLogin(user) {
  const username = getUsernameFromMetadata(user);
  if (username) {
    ui.connectDialog.username.value = username;
  }
  ui.auth.close();
  // Show connect dialog after successful authentication
  ui.connectDialog.visible.value = true;
}

/**
 * Handle auth modal close event
 */
function handleAuthClose() {
  if (ui.connectDialog.username.value) {
    // Show connect dialog when auth modal is closed and user is authenticated
    ui.connectDialog.visible.value = true;
  } else {
    ui.auth.open("login"); // open the modal to the login tab
  }
}

/**
 * Handle authentication error event
 */
function handleAuthError(err) {
  console.warn("[Auth] Authentication error:", err);
  // Show connect dialog even if auth fails to allow retry
  ui.connectDialog.visible.value = true;
}

/**
 * Initialize authentication and handle initial user state
 */
async function initializeAuth() {
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
}

function initializeUI() {
  applyQueryParamsToConnectDialog();

  // Register event handlers BEFORE init() so they catch auto-login events
  ui.auth.on("login", handleAuthLogin);
  ui.auth.on("close", handleAuthClose);
  ui.auth.on("error", handleAuthError);

  // Initialize auth asynchronously (don't block UI)
  initializeAuth();
}

// Backwards-compatible log export used by some modules
globalThis.mumbleLog = log;

async function main() {
  document.title = globalThis.location.hostname;
  
  initializeUI();
  
  // Mount Vue.js App component (single root that contains all UI)
  try {
    const vueApp = createApp(AppVue);
    vueApp.use(pinia);
    
    // Register global custom directives
    vueApp.directive('tooltip', vTooltip);
    
    // Provide dependencies to all Vue components
    vueApp.provide('appState', ui); // TODO: Remove - transitional compatibility layer
    vueApp.provide('config', globalThis.mumbleWebConfig);
    vueApp.provide('translate', translate);
    vueApp.provide('auth', ui.auth); // Provide auth directly for Pinia-native components
    vueApp.provide('settings', ui.settings); // Provide settings directly for Pinia-native components
    
    const mountedApp = vueApp.mount('#app');
    
    globalThis.__VUE_APP__ = mountedApp;
  } catch (error) {
    console.error('[VUE] Failed to mount App:', error);
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

globalThis.onload = main;
