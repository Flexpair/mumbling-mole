<template>
  <!-- Placeholder shown when frame is hidden -->
  <!-- v-show handles display property, removed from inline styles to avoid conflict -->
  <div 
    v-show="!visible" 
    class="guacamole-placeholder"
    aria-hidden="true"
  >
    <img src="https://welcome.flexpair.com/images/corporate-design/logo.svg" alt="" />
  </div>

  <!-- Guacamole iframe container -->
  <!-- v-show handles display property, removed from inline styles to avoid conflict -->
  <section
    v-show="visible"
    class="guacamole"
    aria-label="Remote Desktop Session"
    @mouseenter="focusIframe"
  >
      <!-- Loading state -->
      <output v-if="loading" class="guac-loading" aria-live="polite">
        <span class="sr-only">Loading remote desktop connection...</span>
        Loading remote desktop…
      </output>

      <!-- Error state -->
      <div v-if="error" class="guac-error" role="alert">
        <span class="sr-only">Error:</span>
        {{ error }}
      </div>

      <!-- iframe with lazy loading and clipboard permissions -->
      <iframe
        ref="guacamoleIframe"
        id="guacframe"
        :src="guacSource || 'about:blank'"
        @load="handleLoad"
        title="Remote Desktop - Interactive session"
        loading="lazy"
        allow="clipboard-read; clipboard-write"
        :aria-hidden="loading || !!error"
      ></iframe>
  </section>
</template>

<script setup>
import { ref, watch, onMounted, useTemplateRef, onWatcherCleanup } from 'vue';
import {
  buildGuacamoleSource,
  clearGuacamoleSession,
  waitForGuacamoleReady,
} from '../composables/useGuacamole';

/**
 * GuacamoleFrame Component
 * 
 * Manages Guacamole remote desktop iframe with lazy loading and error handling.
 * Exposes public API via defineExpose() for AppState integration.
 */

/** @type {import('vue').Ref<HTMLIFrameElement | null>} */
const iframeRef = useTemplateRef('guacamoleIframe');

/** @type {import('vue').Ref<string | null>} */
const guacSource = ref(null);

/** @type {import('vue').Ref<boolean>} */
const visible = ref(false);

/** @type {import('vue').Ref<boolean>} */
const loading = ref(false);

/** @type {import('vue').Ref<string | null>} */
const error = ref(null);
let startupController = null;
let startupSequence = 0;

/**
 * Focus the iframe when it becomes visible
 */
function focusIframe() {
  if (iframeRef.value && visible.value) {
    try {
      iframeRef.value.focus();
    } catch (e) {
      console.warn('[GuacamoleFrame] Failed to focus iframe:', e);
    }
  }
}

// Watch visibility changes and focus iframe when shown
watch(visible, (isVisible) => {
  if (isVisible) {
    // Delay focus slightly to ensure iframe is rendered
    const timeoutId = setTimeout(() => focusIframe(), 100);
    
    // Cleanup timeout if watch re-runs before timeout fires (Vue 3.5+)
    onWatcherCleanup(() => clearTimeout(timeoutId));
  }
});

// Setup focus management on mount
onMounted(() => {
  // If already visible on mount, focus it
  if (visible.value) {
    focusIframe();
  }
});

/**
 * Start the Guacamole session with credentials
 * Called from AppState._setupGuacamoleFrame()
 * 
 * @param {string} guacUser - Guacamole username
 * @param {string} password - Guacamole password
 */
function start(guacUser, password) {
  startupController?.abort();
  clearGuacamoleSession();
  const controller = new AbortController();
  startupController = controller;
  loading.value = true;
  error.value = null;

  // Sanitize bad localStorage entries that break Guacamole's JSON.parse
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key) continue;

      if (/guac|token|auth/i.test(key)) {
        const val = localStorage.getItem(key);
        if (val === "undefined" || val === "null") {
          localStorage.removeItem(key);
        }
      }
    }
  } catch (e) {
    console.warn("[Guac] localStorage sanitization failed", e);
  }

  const session = String(++startupSequence);

  guacSource.value = buildGuacamoleSource(guacUser, password, session);
  return waitForGuacamoleReady(iframeRef.value, {
    expectedSession: session,
    signal: controller.signal,
  })
    .then(() => {
      if (startupController === controller) {
        startupController = null;
        loading.value = false;
      }
    })
    .catch(startupError => {
      if (startupController === controller) {
        startupController = null;
        loading.value = false;
        if (startupError.code !== 'GUACAMOLE_START_CANCELLED') {
          error.value = startupError.message;
        }
      }
      throw startupError;
    });
}

/**
 * Show the Guacamole frame
 */
function show() {
  visible.value = true;
  // Focus will be handled by the watch() on visible
}

/**
 * Hide the Guacamole frame
 */
function hide() {
  visible.value = false;
}

/**
 * Stop and unload the Guacamole session.
 */
function stop() {
  startupController?.abort();
  startupController = null;
  clearGuacamoleSession();
  visible.value = false;
  guacSource.value = null;
  loading.value = false;
  error.value = null;
}

/**
 * Handle iframe load event
 */
function handleLoad() {
  // Focus iframe after content loads
  focusIframe();
}

/**
 * Exposed Public API
 * 
 * These methods and properties are accessible from parent components
 * via template ref (e.g., guacamoleFrameRef.value.show())
 * 
 * @typedef {Object} GuacamoleFrameAPI
 * @property {(guacUser: string, password: string) => Promise<void>} start - Start Guacamole session
 * @property {() => void} show - Show the frame
 * @property {() => void} hide - Hide the frame
 * @property {() => void} stop - Stop and unload the session
 * @property {() => void} handleLoad - Handle iframe load
 * @property {import('vue').Ref<string | null>} guacSource - Current iframe src
 * @property {import('vue').Ref<boolean>} visible - Visibility state
 * @property {import('vue').Ref<boolean>} loading - Loading state
 * @property {import('vue').Ref<string | null>} error - Error message
 */
defineExpose({
  start,
  show,
  hide,
  stop,
  handleLoad,
  guacSource,
  visible,
  loading,
  error
});
</script>

<style scoped>
/* Styles are inherited from existing CSS in themes/MetroMumbleLight */
/* This scoped section is intentionally minimal to avoid conflicts */
</style>
