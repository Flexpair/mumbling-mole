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

/**
 * Focus the iframe when it becomes visible
 */
function focusIframe() {
  if (iframeRef.value && visible.value) {
    try {
      iframeRef.value.focus();
      console.log('[GuacamoleFrame] Focus set to iframe');
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
 * Credentials to send via postMessage after iframe loads
 * @type {{ username: string, password: string } | null}
 */
let pendingCredentials = null;

/**
 * Start the Guacamole session with credentials
 * Called from AppState._setupGuacamoleFrame()
 * 
 * Security: Credentials are passed via postMessage, NOT URL parameters.
 * This prevents passwords from appearing in browser history, server logs,
 * and referrer headers.
 * 
 * @param {string} guacUser - Guacamole username
 * @param {string} password - Guacamole password
 */
function start(guacUser, password) {
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
          console.log(`[Guac] Sanitizing localStorage key: ${key}`);
          localStorage.removeItem(key);
        }
      }
    }
  } catch (e) {
    console.warn("[Guac] localStorage sanitization failed", e);
  }

  // Store credentials to send via postMessage after iframe loads
  pendingCredentials = {
    username: guacUser,
    password: password || ""
  };

  // Load Guacamole without credentials in URL (security improvement)
  guacSource.value = "/guacamole/";
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
 * Handle iframe load event
 * 
 * Security: Sends credentials via postMessage after iframe loads.
 * This keeps passwords out of URLs, browser history, and server logs.
 */
function handleLoad() {
  loading.value = false;
  
  // Send credentials via postMessage if pending
  if (pendingCredentials && iframeRef.value?.contentWindow) {
    try {
      // Get the origin for secure postMessage
      const targetOrigin = new URL(guacSource.value, window.location.origin).origin;
      
      iframeRef.value.contentWindow.postMessage({
        type: 'guacamole-auth',
        username: pendingCredentials.username,
        password: pendingCredentials.password
      }, targetOrigin);
      
      console.log('[GuacamoleFrame] Credentials sent via postMessage');
    } catch (e) {
      console.warn('[GuacamoleFrame] Failed to send credentials via postMessage:', e);
    }
    
    // Clear pending credentials after sending
    pendingCredentials = null;
  }
  
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
 * @property {(guacUser: string, password: string) => void} start - Start Guacamole session
 * @property {() => void} show - Show the frame
 * @property {() => void} hide - Hide the frame
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
