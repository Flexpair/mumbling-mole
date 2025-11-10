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
import { computed, inject } from 'vue';

const appState = inject('appState');

// Computed properties that directly track Vue refs
const visible = computed(() => appState.micPermissionDenied?.value || false);
const errorMessage = computed(() => appState.micPermissionErrorMessage?.value || '');

// Methods
const handleRetry = () => {
  if (appState.retryMicrophonePermission) {
    appState.retryMicrophonePermission();
  }
};
</script>
</script>

<style scoped>
/* Component-specific styles can go here if needed */
</style>
