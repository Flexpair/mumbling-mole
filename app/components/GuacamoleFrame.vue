<template>
  <!-- Placeholder shown when frame is hidden -->
  <!-- v-show handles display property, removed from inline styles to avoid conflict -->
  <div 
    v-show="!visible" 
    class="guacamole-placeholder"
    style="float: left; margin-top: 2px; margin-bottom: 2px; width: 100%; height: calc(99% - 38px);"
  >
    <img src="https://welcome.flexpair.com/images/corporate-design/logo.svg" alt="Flexpair logo" />
  </div>

  <!-- Guacamole iframe container -->
  <!-- v-show handles display property, removed from inline styles to avoid conflict -->
  <section
    v-show="visible"
    class="guacamole"
    style="float: left; margin-top: 2px; margin-bottom: 2px; width: 100%; height: calc(99% - 38px);"
    aria-label="Guacamole Remote Desktop Container"
    @mouseenter="focusIframe"
  >
      <!-- Loading state -->
      <div v-if="loading" class="guac-loading">Loading remote desktop…</div>

      <!-- Error state -->
      <div v-if="error" class="guac-error">{{ error }}</div>

      <!-- iframe with lazy loading and clipboard permissions -->
      <iframe
        ref="guacamoleIframe"
        id="guacframe"
        :src="guacSource || 'about:blank'"
        @load="handleLoad"
        title="Guacamole Remote Desktop"
        loading="lazy"
        allow="clipboard-read; clipboard-write"
      ></iframe>
  </section>
</template>

<script setup>
import { ref, watch, onMounted, useTemplateRef } from 'vue';

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
    setTimeout(() => focusIframe(), 100);
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

  // Build Guacamole URL with credentials
  const src =
    "/guacamole/#/?username=" +
    guacUser +
    "&password=" +
    encodeURIComponent(password || "");

  guacSource.value = src;
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
 */
function handleLoad() {
  loading.value = false;
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
