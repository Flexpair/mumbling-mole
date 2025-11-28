<template>
  <button 
    class="message-confirmation" 
    :class="{ confirmed: isConfirmed }"
    @click="handleClick"
    :aria-label="isConfirmed ? 'Message sent successfully' : translate('chat.send_message')"
    :title="isConfirmed ? 'Message sent!' : translate('chat.send_message')"
    type="button"
    :aria-pressed="isConfirmed"
  >
    <span class="checkmark" aria-hidden="true">✓</span>
    <span class="sr-only">{{ isConfirmed ? 'Message sent' : 'Send message' }}</span>
  </button>
</template>

<script setup>
import { ref, watch, onUnmounted } from 'vue';
import { useUIStore } from '../stores/uiStore';
import { useConnectionStore } from '../stores/connectionStore';
import { translate } from '../localize';

const isConfirmed = ref(false);
let resetTimer = null;

const uiStore = useUIStore();
const connectionStore = useConnectionStore();

// Handle click on checkmark to send message
function handleClick() {
  const client = connectionStore.getClient?.();
  if (!client) {
    return;
  }

  const rootChannel = client.root;
  if (!rootChannel || typeof rootChannel.sendMessage !== 'function') {
    return;
  }

  uiStore.submitMessageBox?.((target, message) => {
    if (target && typeof target.sendMessage === 'function') {
      target.sendMessage(message);
    }
  }, rootChannel);
}

// Watch for message confirmation from AppState
watch(
  () => uiStore.messageConfirmed,
  (confirmed) => {
    if (confirmed) {
      // Show confirmation
      isConfirmed.value = true;
      
      // Clear existing timer
      if (resetTimer) {
        clearTimeout(resetTimer);
      }
      
      // Reset visual state after 2 seconds
      // Note: AppState handles resetting messageConfirmed.value
      resetTimer = setTimeout(() => {
        isConfirmed.value = false;
      }, 2000);
    }
  }
);

// Cleanup timer on component unmount
onUnmounted(() => {
  if (resetTimer) {
    clearTimeout(resetTimer);
    resetTimer = null;
  }
});
</script>

<style scoped>
button.message-confirmation {
  position: absolute;
  right: 5px;
  top: 50%;
  transform: translateY(-50%);
  background: rgba(128, 128, 128, 0.3);
  color: #666;
  width: 20px;
  height: 20px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
  z-index: 1000;
  pointer-events: auto;
  cursor: pointer;
  transition: all 0.3s ease;
  border: none;
  padding: 0;
}

.message-confirmation:hover {
  background: rgba(21, 120, 120, 0.4); /* Corporate teal with opacity */
  transform: translateY(-50%) scale(1.1);
  box-shadow: 0 2px 6px rgba(21, 120, 120, 0.4);
}

.message-confirmation.confirmed {
  background: rgba(0, 255, 255, 0.9); /* Corporate cyan */
  color: #000;
  box-shadow: 0 2px 8px rgba(0, 255, 255, 0.6);
  transform: translateY(-50%) scale(1.15);
}

.checkmark {
  font-size: 14px;
  font-weight: bold;
  line-height: 1;
}
</style>
