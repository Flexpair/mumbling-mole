<template>
  <div 
    class="message-confirmation" 
    :class="{ confirmed: isConfirmed }"
    @click="handleClick"
    title="Nachricht senden"
  >
    <span class="checkmark">✓</span>
  </div>
</template>

<script setup>
import { ref, watch } from 'vue';

const props = defineProps({
  appState: {
    type: Object,
    required: true
  }
});

const isConfirmed = ref(false);
let resetTimer = null;

// Handle click on checkmark to send message
function handleClick() {
  // Trigger message send via submitMessageBox
  if (props.appState.ui?.submitMessageBox) {
    const sendMessageFn = props.appState.sendMessage.bind(props.appState);
    const target = null; // null = send to current channel
    props.appState.ui.submitMessageBox(sendMessageFn, target);
  }
}

// Watch for message confirmation from AppState
watch(
  () => props.appState.messageConfirmed?.value,
  (confirmed) => {
    console.log('[MESSAGE-CONFIRM] messageConfirmed changed:', confirmed);
    if (confirmed) {
      // Show green confirmation
      isConfirmed.value = true;
      console.log('[MESSAGE-CONFIRM] Set isConfirmed to true');
      
      // Clear existing timer
      if (resetTimer) {
        clearTimeout(resetTimer);
      }
      
      // Reset to gray after 2 seconds
      resetTimer = setTimeout(() => {
        isConfirmed.value = false;
        console.log('[MESSAGE-CONFIRM] Reset isConfirmed to false');
      }, 2000);
      
      // Reset the flag
      if (props.appState.messageConfirmed) {
        props.appState.messageConfirmed.value = false;
      }
    }
  }
);
</script>

<style scoped>
.message-confirmation {
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
