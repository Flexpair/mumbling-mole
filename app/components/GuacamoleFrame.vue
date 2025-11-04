<template>
  <div>
    <!-- Placeholder shown when frame is hidden -->
    <div v-show="!visible" class="guacamole-placeholder">
      <img src="https://welcome.flexpair.com/images/corporate-design/logo.svg" alt="Flexpair logo" />
    </div>

    <!-- Guacamole iframe container -->
    <section
      v-show="visible"
      class="guacamole"
      aria-label="Guacamole Remote Desktop Container"
    >
      <!-- Loading state -->
      <div v-if="loading" class="guac-loading">Loading remote desktop…</div>

      <!-- Error state -->
      <div v-if="error" class="guac-error">{{ error }}</div>

      <!-- iframe with lazy loading and clipboard permissions -->
      <iframe
        id="guacframe"
        :src="guacSource || 'about:blank'"
        @load="handleLoad"
        title="Guacamole Remote Desktop"
        loading="lazy"
        allow="clipboard-read; clipboard-write"
      ></iframe>
    </section>
  </div>
</template>

<script setup>
import { ref } from 'vue';

// Reactive state (no Knockout sync needed - pure Vue component)
const guacSource = ref(null);
const visible = ref(false);
const loading = ref(false);
const error = ref(null);

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
}

// Expose methods to parent (called from AppState)
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
