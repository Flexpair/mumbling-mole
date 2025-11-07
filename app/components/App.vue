<template>
  <!-- Root wrapper with full height to maintain height: 100% chain -->
  <div style="height: 100%;">
    <!-- Preloader (shown during initial load) -->
    <div v-if="showPreloader" class="preloader" :class="{ loaded: preloaderLoaded }">
      <div class="lds-ripple" :class="{ loaded: preloaderLoaded }">
        <div></div>
        <div></div>
      </div>
    </div>

    <!-- Main container (shown after preloader) -->
    <div v-if="containerVisible" id="container">
      <!-- Microphone select (shared between components) -->
      <select id="audioSource" style="display: none; width: 100%; box-sizing: border-box;"></select>
      
      <!-- Container components (GuacamoleFrame first, Toolbar at bottom) -->
      <GuacamoleFrame ref="guacamoleFrameRef" />
      <Toolbar />
      <MicPermissionRetryOverlay />
    </div>

    <!-- Dialogs (outside container - absolute positioned overlays that float above everything) -->
    <ConnectDialog />
    <ConnectErrorDialog />
    <SampleRateWarningDialog />
    <ConnectionInfoDialog />
    <SettingsDialog />
  </div>
</template>

<script setup>
import { ref, onMounted, inject, provide } from 'vue';
import ConnectDialog from './ConnectDialog.vue';
import ConnectErrorDialog from './ConnectErrorDialog.vue';
import SampleRateWarningDialog from './SampleRateWarningDialog.vue';
import Toolbar from './Toolbar.vue';
import MicPermissionRetryOverlay from './MicPermissionRetryOverlay.vue';
import GuacamoleFrame from './GuacamoleFrame.vue';
import ConnectionInfoDialog from './ConnectionInfoDialog.vue';
import SettingsDialog from './SettingsDialog.vue';

// Get injected dependencies from parent (index.js)
const appState = inject('appState');
const config = inject('config');
const translate = inject('translate');

// Re-provide to child components
provide('appState', appState);
provide('config', config);
provide('translate', translate);

// Preloader state
const showPreloader = ref(true);
const preloaderLoaded = ref(false);
const containerVisible = ref(true);

// Ref to GuacamoleFrame component instance
const guacamoleFrameRef = ref(null);

// Handle preloader removal on window load
onMounted(() => {
  const finalize = () => {
    preloaderLoaded.value = true;
    setTimeout(() => {
      showPreloader.value = false;
    }, 400); // Match the fade-out animation duration
  };

  if (document.readyState === 'complete') {
    finalize();
  } else {
    window.addEventListener('load', finalize, { once: true });
  }
  
  // Wire up GuacamoleFrame reference to appState
  if (guacamoleFrameRef.value && appState) {
    appState.guacamoleFrame = guacamoleFrameRef.value;
    console.log('[App.vue] GuacamoleFrame reference assigned to appState.guacamoleFrame');
  }
});
</script>

<style scoped>
/* Component-specific styles can go here if needed */
</style>
