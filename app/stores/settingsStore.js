import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { useLocalStorage } from '../composables/useLocalStorage.js';
import MumbleClient from '../mumble-client/index.js';
import { debugLog } from '../utils/debug-utils.js';

/**
 * Settings Store - User-configurable settings with localStorage persistence
 */
export const useSettingsStore = defineStore('settings', () => {
  // ===== Core Settings (persisted to localStorage) =====
  
  const voiceMode = useLocalStorage('voiceMode', 'cont', { prefix: 'mumble.' });
  
  // FORCE-CONT: PTT is currently disabled/untested (Nov 2025)
  if (voiceMode.value === 'ptt') {
    voiceMode.value = 'cont';
    debugLog('[Settings]', 'PTT mode disabled, switched to Continuous.');
  }

  const pttKey = useLocalStorage('pttKey', 'ctrl + shift', { prefix: 'mumble.' });
  const userCountInChannelName = useLocalStorage('userCountInChannelName', false, { prefix: 'mumble.' });
  const audioBitrate = useLocalStorage('audioBitrate', 40000, { prefix: 'mumble.' });
  const samplesPerPacket = useLocalStorage('samplesPerPacket', 960, { prefix: 'mumble.' });
  const jitterBufferSize = useLocalStorage('jitterBufferSize', 3, { prefix: 'mumble.' });
  const jitterBufferMode = useLocalStorage('jitterBufferMode', 'balanced', { prefix: 'mumble.' });

  // Dialog-specific state (not persisted)
  const pttKeyDisplay = ref(pttKey.value);

  // ===== Computed Properties =====
  
  const msPerPacket = computed({
    get: () => samplesPerPacket.value / 48,
    set: (value) => { samplesPerPacket.value = value * 48; }
  });

  const totalBandwidth = computed(() => {
    return MumbleClient.calcEnforcableBandwidth(audioBitrate.value, samplesPerPacket.value, false);
  });

  const overheadBandwidth = computed(() => {
    return MumbleClient.calcEnforcableBandwidth(0, samplesPerPacket.value, false);
  });

  // ===== Actions =====
  
  function recordPttKey(keyboardjs) {
    let combo = [];
    const keydown = (e) => {
      combo = e.pressedKeys;
      pttKeyDisplay.value = "> " + combo.join(" + ") + " <";
    };
    const keyup = () => {
      keyboardjs.unbind("", keydown, keyup);
      const comboStr = combo.join(" + ");
      if (comboStr) {
        pttKey.value = comboStr;
        pttKeyDisplay.value = comboStr;
      } else {
        pttKeyDisplay.value = pttKey.value;
      }
    };
    keyboardjs.bind("", keydown, keyup);
    pttKeyDisplay.value = "> ? <";
  }

  function initWithDefaults(defaults = {}) {
    // Only override if localStorage is empty (useLocalStorage handles this via writeDefaults)
    // This function exists for runtime config override capability
    if (defaults.voiceMode && voiceMode.value === 'cont') voiceMode.value = defaults.voiceMode;
    if (defaults.pttKey) pttKey.value = defaults.pttKey;
    if (defaults.audioBitrate) audioBitrate.value = defaults.audioBitrate;
    if (defaults.samplesPerPacket) samplesPerPacket.value = defaults.samplesPerPacket;
    if (defaults.jitterBufferSize) jitterBufferSize.value = defaults.jitterBufferSize;
    if (defaults.jitterBufferMode) jitterBufferMode.value = defaults.jitterBufferMode;
    if (defaults.userCountInChannelName !== undefined) userCountInChannelName.value = defaults.userCountInChannelName;
  }

  return {
    voiceMode, pttKey, userCountInChannelName, audioBitrate,
    samplesPerPacket, jitterBufferSize, jitterBufferMode,
    pttKeyDisplay, msPerPacket, totalBandwidth, overheadBandwidth,
    recordPttKey, initWithDefaults
  };
});
