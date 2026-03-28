<template>
  <!-- Root wrapper with full height to maintain height: 100% chain -->
  <div style="height: 100%;">
    <!-- Preloader (shown during initial load) with fade transition -->
    <Transition name="preloader-fade">
      <output 
        v-if="showPreloader" 
        class="preloader" 
        :class="{ loaded: preloaderLoaded }"
        aria-label="Loading application"
      >
        <div class="lds-ripple" :class="{ loaded: preloaderLoaded }" aria-hidden="true">
          <div></div>
          <div></div>
        </div>
        <span class="sr-only">Loading Mumble Web Client...</span>
      </output>
    </Transition>

    <!-- Main container (shown after preloader) with fade-in transition -->
    <Transition name="container-fade">
      <div v-if="containerVisible" id="container">
        <!-- Header with application branding -->
        <header class="sr-only">
          <h1>Mumble Web Client - Voice Communication</h1>
        </header>

        <!-- Microphone select (shared between components) -->
        <select 
          id="audioSource" 
          style="display: none; width: 100%; box-sizing: border-box;"
          aria-label="Select microphone input device"
        ></select>
        
        <!-- Main content area (target for skip link) -->
        <main id="main-content">
          <!-- Container components (GuacamoleFrame first, Toolbar at bottom) -->
          <GuacamoleFrame ref="guacamoleFrameRef" />
        </main>
        
        <!-- Footer toolbar with controls -->
        <footer>
          <Toolbar />
        </footer>
        
        <MicPermissionRetryOverlay />
      </div>
    </Transition>

    <!-- Dialogs (outside container - absolute positioned overlays that float above everything) -->
    <ConnectDialog />
    <ConnectErrorDialog />
    <SampleRateWarningDialog />
    <ConnectionInfoDialog />
  </div>
</template>

<script setup>
import { Transition, ref, onMounted, useTemplateRef } from 'vue';
import { useUIStore } from '../stores/uiStore';

// All components loaded synchronously (IIFE format doesn't support code-splitting)
// defineAsyncComponent requires format:'esm' which is a larger architectural change
import ConnectDialog from './ConnectDialog.vue';
import ConnectErrorDialog from './ConnectErrorDialog.vue';
import SampleRateWarningDialog from './SampleRateWarningDialog.vue';
import Toolbar from './Toolbar.vue';
import MicPermissionRetryOverlay from './MicPermissionRetryOverlay.vue';
import GuacamoleFrame from './GuacamoleFrame.vue';
import ConnectionInfoDialog from './ConnectionInfoDialog.vue';

// Get injected dependencies from parent (index.js)
// Note: config and translate are provided by index.js and automatically
// inherited by child components via provide/inject chain

// Preloader state
const showPreloader = ref(true);
const preloaderLoaded = ref(false);
const containerVisible = ref(true);

// Ref to GuacamoleFrame component instance
const guacamoleFrameRef = useTemplateRef('guacamoleFrameRef');

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
    globalThis.addEventListener('load', finalize, { once: true });
  }
  
  // Wire up GuacamoleFrame reference to uiStore
  if (guacamoleFrameRef.value) {
    const uiStore = useUIStore();
    uiStore.guacamoleFrame = guacamoleFrameRef.value;
  }
});
</script>

<style scoped>
/* Preloader fade transition */
.preloader-fade-enter-active,
.preloader-fade-leave-active {
  transition: opacity 0.4s ease;
}

.preloader-fade-enter-from,
.preloader-fade-leave-to {
  opacity: 0;
}

/* Container fade-in transition */
.container-fade-enter-active {
  transition: opacity 0.3s ease 0.2s; /* Delay slightly for smoother handoff */
}

.container-fade-enter-from {
  opacity: 0;
}
</style>
