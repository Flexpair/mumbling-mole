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
      <!-- iframe with clipboard permissions -->
      <iframe
        ref="guacamoleIframe"
        id="guacframe"
        :src="guacSource || 'about:blank'"
        title="Remote Desktop - Interactive session"
        loading="eager"
        allow="clipboard-read; clipboard-write"
      ></iframe>
  </section>
</template>

<script setup>
import { ref, watch, onMounted, useTemplateRef, onWatcherCleanup } from 'vue';
import {
  buildGuacamoleSource,
  clearGuacamoleSession,
} from '../composables/useGuacamole';

/**
 * GuacamoleFrame Component
 * 
 * Manages the independent Guacamole remote desktop iframe.
 * Exposes public API via defineExpose() for AppState integration.
 */

/** @type {import('vue').Ref<HTMLIFrameElement | null>} */
const iframeRef = useTemplateRef('guacamoleIframe');

/** @type {import('vue').Ref<string | null>} */
const guacSource = ref(null);

/** @type {import('vue').Ref<boolean>} */
const visible = ref(false);

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
  clearGuacamoleSession();

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

  guacSource.value = buildGuacamoleSource(guacUser, password);
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
  clearGuacamoleSession();
  visible.value = false;
  guacSource.value = null;
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
 * @property {() => void} stop - Stop and unload the session
 * @property {import('vue').Ref<string | null>} guacSource - Current iframe src
 * @property {import('vue').Ref<boolean>} visible - Visibility state
 */
defineExpose({
  start,
  show,
  hide,
  stop,
  guacSource,
  visible
});
</script>

<style scoped>
/* Styles are inherited from existing CSS in themes/MetroMumbleLight */
/* This scoped section is intentionally minimal to avoid conflicts */
</style>
