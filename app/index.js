import AuthFactory from "./auth/AuthFactory";
import { createApp } from 'vue';
import { createPinia, setActivePinia } from 'pinia';
import AppVue from "./components/App.vue";
import { useUserStore } from "./stores/userStore";
import { useAudioStore } from "./stores/audioStore";
import { useVoiceStore } from "./stores/voiceStore";
import { useUIStore } from "./stores/uiStore";
import { useConnectionDialog } from "./composables/useConnectionDialog";

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

// Initialize Pinia
const pinia = createPinia();
setActivePinia(pinia);

// Initialize stores and composables
const userStore = useUserStore();
const audioStore = useAudioStore();
const voiceStore = useVoiceStore();
const uiStore = useUIStore();
const connectDialog = useConnectionDialog();
const settings = useSettings(globalThis.mumbleWebConfig.settings);

// Inject settings into userStore
userStore.setSettings(settings);

// Initialize auth
let authConfig = globalThis.mumbleWebConfig?.auth || { provider: 'netlify' };

// Override with mock auth if requested via URL (used for automated tests)
if (isMockAuth) {
  console.log('[Auth] Using MockAuthAdapter via ?mock-auth parameter');
  authConfig = { 
    provider: 'mock',
    mock: { autoLogin: true }
  };
}

const auth = AuthFactory.create(authConfig);

// Legacy global exports for Playwright tests (will be removed)
const connected = () => userStore.thisUser != null;

// Helper to deeply unwrap Vue refs (handles nested refs from Pinia)
const unwrapRef = (val) => {
  // Keep unwrapping until we get a non-ref value
  while (val && typeof val === 'object' && '__v_isRef' in val) {
    val = val.value;
  }
  return val;
};

globalThis.mumbleUi = { 
  auth, 
  settings, 
  user: userStore,
  audio: audioStore,
  voice: voiceStore,
  ui: uiStore,
  connectDialog, 
  connected,
  // Legacy mutation helpers used by automation and remaining AppState clients
  requestMute: (...args) => userStore.requestMute(...args),
  requestUnmute: (...args) => userStore.requestUnmute(...args),
  requestDeaf: (...args) => userStore.requestDeaf(...args),
  requestUndeaf: (...args) => userStore.requestUndeaf(...args),
  // Getters unwrap ref.value for test compatibility (using deep unwrap for Pinia)
  get thisUser() { return unwrapRef(userStore.thisUser); },
  get selfMute() { return unwrapRef(userStore.selfMute); },
  get selfDeaf() { return unwrapRef(userStore.selfDeaf); },
  get isLoopbackMode() { return unwrapRef(voiceStore.isLoopbackMode); },
  get loopbackDominantFrequency() { return unwrapRef(voiceStore.loopbackDominantFrequency); },
  get beeperReady() { return unwrapRef(audioStore.beeperReady); },
  get voiceHandlerReady() { return unwrapRef(voiceStore.voiceHandlerReady); },
  _initializePersistentBeeper: () => audioStore.initializePersistentBeeper()
};


/**
 * Apply URL query parameters to connect dialog
 */
function applyQueryParamsToConnectDialog() {
  const urlObj = new URL(document.location.href);
  let queryParams = Object.fromEntries(urlObj.searchParams.entries());
  queryParams = { ...globalThis.mumbleWebConfig.defaults, ...queryParams };
  
  if (queryParams.address) {
    connectDialog.address.value = queryParams.address;
  }
  if (queryParams.port) {
    connectDialog.port.value = queryParams.port;
  }
  if (queryParams.password) {
    connectDialog.password.value = queryParams.password;
  }
}

/**
 * Handle successful login event
 */
function handleAuthLogin(user) {
  const username = getUsernameFromMetadata(user);
  if (username) {
    connectDialog.username.value = username;
  }
  auth.close();
  // Show connect dialog after successful authentication
  connectDialog.visible.value = true;
}

/**
 * Handle auth modal close event
 */
function handleAuthClose() {
  if (connectDialog.username.value) {
    // Show connect dialog when auth modal is closed and user is authenticated
    connectDialog.visible.value = true;
  } else {
    auth.open("login"); // open the modal to the login tab
  }
}

/**
 * Handle authentication error event
 */
function handleAuthError(err) {
  console.warn("[Auth] Authentication error:", err);
  // Show connect dialog even if auth fails to allow retry
  connectDialog.visible.value = true;
}

/**
 * Initialize authentication and handle initial user state
 */
async function initializeAuth() {
  let user = null;
  
  try {
    await auth.init(globalThis.mumbleWebConfig.auth?.netlify || {
      APIUrl: "https://welcome.flexpair.com/identity-proxy",
      locale: "en",
      logo: false,
    });
    user = auth.currentUser();
  } catch (e) {
    console.warn('[Auth] Initialization failed; continuing without authentication', e);
  }

  if (user == null) {
    // Hide connect dialog when showing authentication modal
    connectDialog.visible.value = false;
    auth.open("signup"); // open the modal to the signup tab
  } else {
    const username = getUsernameFromMetadata(user);
    if (username) {
      connectDialog.username.value = username;
    }
    // User is already authenticated, show connect dialog
    connectDialog.visible.value = true;
  }
}

function initializeUI() {
  applyQueryParamsToConnectDialog();

  // Register event handlers BEFORE init() so they catch auto-login events
  auth.on("login", handleAuthLogin);
  auth.on("close", handleAuthClose);
  auth.on("error", handleAuthError);

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
    vueApp.provide('config', globalThis.mumbleWebConfig);
    vueApp.provide('translate', translate);
    vueApp.provide('auth', auth);
    vueApp.provide('settings', settings);
    
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
