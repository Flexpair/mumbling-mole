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
import { computed } from 'vue';
import { useAudioStore } from '../stores/audioStore';

const audioStore = useAudioStore();

// Computed properties that directly track audio store state
// NOTE: Pinia setup stores expose plain values on the store instance,
// so we intentionally DO NOT access `.value` here.
const visible = computed(() => audioStore.micPermissionDenied || false);
const errorMessage = computed(() => audioStore.micPermissionErrorMessage || '');

// Methods
const handleRetry = () => {
  if (audioStore.retryMicrophonePermission) {
    audioStore.retryMicrophonePermission();
  }
};
</script>

<style scoped>
/* Component-specific styles can go here if needed */
</style>
