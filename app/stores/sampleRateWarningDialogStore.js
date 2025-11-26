import { defineStore } from 'pinia';
import { ref } from 'vue';

/**
 * Sample Rate Warning Dialog Store
 * 
 * Manages state for the modal that warns users when browser sample rate
 * doesn't match Mumble server's expected 48kHz.
 * Replaces the composable useSampleRateWarningDialog.js
 */
export const useSampleRateWarningDialogStore = defineStore('sampleRateWarningDialog', () => {
  const visible = ref(false);
  const mode = ref('confirm'); // 'confirm' or other future modes
  const sampleRate = ref(null);

  // Actions
  function show() {
    visible.value = true;
  }

  function hide() {
    visible.value = false;
  }

  function reset() {
    visible.value = false;
    mode.value = 'confirm';
    sampleRate.value = null;
  }

  return {
    // State
    visible,
    mode,
    sampleRate,
    
    // Actions
    show,
    hide,
    reset
  };
});
