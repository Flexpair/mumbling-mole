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
import { storeToRefs } from 'pinia';
import { useAudioStore } from '../stores/audioStore';

const audioStore = useAudioStore();

// Use storeToRefs for reactive destructuring of store state
const { micPermissionDenied: visible, micPermissionErrorMessage: errorMessage } = storeToRefs(audioStore);

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
