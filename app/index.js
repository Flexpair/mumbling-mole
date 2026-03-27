/* global document, console, URL, URLSearchParams */
import AuthFactory from "./auth/AuthFactory";
import { createApp } from 'vue';
import { createPinia, setActivePinia } from 'pinia';
import { createPiniaDebugPlugin } from './plugins/pinia-debug';
import AppVue from "./components/App.vue";
import { useUserStore } from "./stores/userStore";
import { useAudioStore } from "./stores/audioStore";
import { useVoiceStore } from "./stores/voiceStore";
import { useUIStore } from "./stores/uiStore";
import { useDialogStore } from "./stores/dialogStore";
import { useSettingsStore } from "./stores/settingsStore";

import {
  enumMicrophones,
} from "./audio/voice";
import {
  translate,
} from "./localize";

// Check URL parameters for debug-audio flag (used in automated tests)
const urlParams = new URLSearchParams(globalThis.location.search);
const isDebugAudio = urlParams.has('debug-audio');

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

import { vTooltip, announceToScreenReader } from "./composables/index.js";

// Initialize Pinia with debug plugin (only active when ?debug-audio is in URL)
const pinia = createPinia();
pinia.use(createPiniaDebugPlugin());
setActivePinia(pinia);

// Initialize stores
const userStore = useUserStore();
const audioStore = useAudioStore();
const voiceStore = useVoiceStore();
const uiStore = useUIStore();
const dialogStore = useDialogStore();
const settingsStore = useSettingsStore();

// Initialize settings with config defaults
settingsStore.initWithDefaults(globalThis.mumbleWebConfig.settings);

// Initialize auth - always use Netlify Identity in production
const authConfig = globalThis.mumbleWebConfig?.auth || { provider: 'netlify' };
let auth;
try {
  auth = AuthFactory.create(authConfig);
} catch (error) {
  console.error('[Auth] Failed to initialize authentication:', error);
  uiStore.showMessageBox('Authentication system failed to initialize. Please refresh the page.', 'error');
  throw error;
}

// Legacy global exports for Playwright tests (will be removed)
const connected = () => userStore.thisUser !== null;

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
  settings: settingsStore, 
  user: userStore,
  audio: audioStore,
  voice: voiceStore,
  ui: uiStore,
  connectDialog: dialogStore.connectDialog, 
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
 * SECURITY: Password is no longer accepted from URL parameters.
 * It is fetched securely from the auth server after JWT validation.
 */
function applyQueryParamsToConnectDialog() {
  const urlObj = new URL(document.location.href);
  let queryParams = Object.fromEntries(urlObj.searchParams.entries());
  queryParams = { ...globalThis.mumbleWebConfig.defaults, ...queryParams };
  
  if (queryParams.address) {
    dialogStore.connectDialog.address = queryParams.address;
  }
  if (queryParams.port) {
    dialogStore.connectDialog.port = queryParams.port;
  }
  // Password is no longer accepted from URL for security reasons
  // It is fetched from the auth server after successful authentication
}

/**
 * Handle successful login event
 */
function handleAuthLogin(user) {
  const username = getUsernameFromMetadata(user);
  if (username) {
    dialogStore.connectDialog.username = username;
  }
  auth.close();
  // Show connect dialog after successful authentication
  dialogStore.connectDialog.visible = true;
}

/**
 * Handle auth modal close event
 */
function handleAuthClose() {
  if (dialogStore.connectDialog.username) {
    // Show connect dialog when auth modal is closed and user is authenticated
    dialogStore.connectDialog.visible = true;
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
  dialogStore.connectDialog.visible = true;
}

/**
 * Check if a Netlify Identity token is present — either still in the URL hash
 * or already stashed by the inline script in index.html.
 * @returns {boolean}
 */
function hasIdentityTokenInHash() {
  const hash = globalThis.location?.hash || globalThis.__savedIdentityHash || "";
  const params = new URLSearchParams(hash.startsWith("#") ? hash.slice(1) : hash);
  return params.has("recovery_token") || params.has("confirmation_token") || params.has("invite_token");
}

/**
 * Initialize authentication and handle initial user state
 */
async function initializeAuth() {
  let user = null;
  let initSucceeded = false;

  try {
    await auth.init(globalThis.mumbleWebConfig.auth?.netlify || {
      APIUrl: "https://welcome.flexpair.com/identity-proxy",
      locale: "en",
      logo: false,
    });
    initSucceeded = true;
    user = auth.currentUser();
  } catch (e) {
    console.warn('[Auth] Initialization failed; continuing without authentication', e);
  }

  if (user === null) {
    // Hide connect dialog when showing authentication modal
    dialogStore.connectDialog.visible = false;
    // Skip signup modal only when init succeeded and the widget can handle the
    // token itself.  If init failed, always fall back to signup so the user
    // is never left with an empty screen.
    if (!initSucceeded || !hasIdentityTokenInHash()) {
      auth.open("signup");
    }
  } else {
    const username = getUsernameFromMetadata(user);
    if (username) {
      dialogStore.connectDialog.username = username;
    }
    // User is already authenticated, show connect dialog
    dialogStore.connectDialog.visible = true;
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

/**
 * Initialize keyboard shortcuts for accessibility
 * Provides keyboard access to common actions without mouse
 */
function initializeKeyboardShortcuts() {
  document.addEventListener('keydown', (event) => {
    // Ignore if user is typing in an input field or contenteditable region
    const target = event.target;
    if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable || target.closest('[contenteditable="true"]')) {
      return;
    }
    
    // Ctrl+M: Toggle mute
    if (event.ctrlKey && event.key === 'm') {
      event.preventDefault();
      if (userStore.selfMute) {
        userStore.requestUnmute(userStore.thisUser);
        announceToScreenReader('Microphone unmuted');
      } else {
        userStore.requestMute(userStore.thisUser);
        announceToScreenReader('Microphone muted');
      }
    }
    
    // Ctrl+D: Toggle deaf
    if (event.ctrlKey && event.key === 'd') {
      event.preventDefault();
      if (userStore.selfDeaf) {
        userStore.requestUndeaf(userStore.thisUser);
        announceToScreenReader('Audio enabled');
      } else {
        userStore.requestDeaf(userStore.thisUser, voiceStore.isLoopbackMode);
        announceToScreenReader('Audio disabled');
      }
    }
    
    // Escape: Close current modal/dialog (handled by individual components)
  });
}

// Backwards-compatible log export used by some modules
globalThis.mumbleLog = log;

async function main() {
  document.title = globalThis.location.hostname;
  
  initializeUI();
  initializeKeyboardShortcuts();
  
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
    // Note: settings is now a Pinia store (useSettingsStore), no need to provide
    // Components can import it directly via: import { useSettingsStore } from '../stores/settingsStore'
    
    const mountedApp = vueApp.mount('#app');
    
    globalThis.__VUE_APP__ = mountedApp;
  } catch (error) {
    console.error('[VUE] Failed to mount App:', error);
    // Fall back to showing an error message
    const appElement = document.getElementById('app');
    appElement.innerHTML = '';
    const errorContainer = document.createElement('div');
    errorContainer.style.padding = '20px';
    errorContainer.style.color = 'red';
    errorContainer.style.fontFamily = 'sans-serif';

    const heading = document.createElement('h2');
    heading.textContent = 'Failed to load application';
    errorContainer.appendChild(heading);

    const p = document.createElement('p');
    p.textContent = 'Please refresh the page or contact support.';
    errorContainer.appendChild(p);

    const pre = document.createElement('pre');
    pre.textContent = error.message;
    errorContainer.appendChild(pre);

    appElement.appendChild(errorContainer);
  }
  
  enumMicrophones();
}

globalThis.onload = main;
