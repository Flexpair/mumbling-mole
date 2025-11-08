<template>
  <div v-if="visible" class="mic-permission-retry">
    <div class="mic-permission-content">
      <span class="mic-icon">🎤</span>
      <span>Microphone access denied</span>
      <p v-if="errorMessage" class="mic-permission-message">{{ errorMessage }}</p>
      <button @click="handleRetry" class="mic-permission-button">
        Allow Microphone
      </button>
    </div>
  </div>
</template>

<script setup>
import { ref, inject, watch, onMounted, onUnmounted } from 'vue';

const appState = inject('appState');

// Local reactive state
const visible = ref(false);
const errorMessage = ref('');

// Subscriptions for cleanup
const subscriptions = [];

// Methods
const handleRetry = () => {
  if (appState.retryMicrophonePermission) {
    appState.retryMicrophonePermission();
  }
};

// Bidirectional sync with Knockout AppState
onMounted(() => {
  // Initialize from AppState (use root-level Knockout observables)
  if (appState.micPermissionDenied) {
    visible.value = appState.micPermissionDenied() || false;
  }
  if (appState.micPermissionErrorMessage) {
    errorMessage.value = appState.micPermissionErrorMessage() || '';
  }

  // Knockout → Vue sync (use root-level observables)
  if (appState.micPermissionDenied) {
    subscriptions.push(
      appState.micPermissionDenied.subscribe((val) => {
        visible.value = val || false;
      })
    );
  }
  if (appState.micPermissionErrorMessage) {
    subscriptions.push(
      appState.micPermissionErrorMessage.subscribe((val) => {
        errorMessage.value = val || '';
      })
    );
  }
});

// Vue → Knockout sync (read-only component, no user input to sync back)

// Cleanup subscriptions
onUnmounted(() => {
  subscriptions.forEach(sub => sub.dispose());
});
</script>

<style scoped>
/* Component-specific styles can go here if needed */
</style>
