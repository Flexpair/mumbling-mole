/**
 * useSampleRateWarningDialog - Vue Composable for Sample Rate Warning Dialog
 * 
 * Manages state for the modal that warns users when browser sample rate
 * doesn't match Mumble server's expected 48kHz.
 * 
 * Replaced Knockout observable adapter (index.js) in Phase 5 Step 3.
 */

import { ref } from 'vue';

export function useSampleRateWarningDialog() {
  const visible = ref(false);
  const mode = ref('confirm'); // 'confirm' or other future modes
  const sampleRate = ref(null);

  const show = () => {
    visible.value = true;
  };

  const hide = () => {
    visible.value = false;
  };

  const reset = () => {
    visible.value = false;
    mode.value = 'confirm';
    sampleRate.value = null;
  };

  return {
    visible,
    mode,
    sampleRate,
    show,
    hide,
    reset
  };
}
