import { defineStore } from 'pinia';
import { ref, computed, watch } from 'vue';
import MumbleClient from '../mumble-client/index.js';

/**
 * Settings Store
 * 
 * Centralized store for all user-configurable settings.
 * All settings are automatically persisted to localStorage with 'mumble.' prefix.
 * 
 * Replaces the useSettings composable for consistency with other Pinia stores.
 */
export const useSettingsStore = defineStore('settings', () => {
  // Helper to create a localStorage-synced ref
  const createPersistedRef = (key, defaultValue) => {
    const storageKey = `mumble.${key}`;
    
    // Read initial value from localStorage
    let initialValue = defaultValue;
    try {
      const stored = globalThis.localStorage?.getItem(storageKey);
      if (stored !== null) {
        if (typeof defaultValue === 'number') {
          initialValue = Number(stored);
        } else if (typeof defaultValue === 'boolean') {
          initialValue = stored === 'true';
        } else {
          initialValue = stored;
        }
      } else {
        // Write default to localStorage
        globalThis.localStorage?.setItem(storageKey, String(defaultValue));
      }
    } catch (e) {
      // localStorage not available (SSR, privacy mode, etc.)
    }
    
    const state = ref(initialValue);
    
    // Auto-persist on change
    watch(state, (newValue) => {
      try {
        globalThis.localStorage?.setItem(storageKey, String(newValue));
      } catch (e) {
        // Ignore localStorage errors
      }
    });
    
    return state;
  };

  // ===== Core Settings (persisted to localStorage) =====
  
  const voiceMode = createPersistedRef('voiceMode', 'cont');
  
  // FORCE-CONT: PTT is currently disabled/untested (Nov 2025)
  if (voiceMode.value === 'ptt') {
    voiceMode.value = 'cont';
    console.warn('[Settings] PTT mode is disabled. Voice mode forcibly switched to Continuous transmission.');
  }

  const pttKey = createPersistedRef('pttKey', 'ctrl + shift');
  const userCountInChannelName = createPersistedRef('userCountInChannelName', false);
  const audioBitrate = createPersistedRef('audioBitrate', 40000);
  const samplesPerPacket = createPersistedRef('samplesPerPacket', 960);
  // Default jitter buffer: 3 packets (60ms) - safe for typical 30-50ms latency
  const jitterBufferSize = createPersistedRef('jitterBufferSize', 3);
  // Jitter buffer mode: 'low-latency', 'balanced', 'high-quality'
  const jitterBufferMode = createPersistedRef('jitterBufferMode', 'balanced');

  // ===== Dialog-specific state (not persisted) =====
  
  const pttKeyDisplay = ref(pttKey.value);

  // ===== Computed Properties =====
  
  // ms per packet (derived from samplesPerPacket)
  const msPerPacket = computed({
    get: () => samplesPerPacket.value / 48,
    set: (value) => { samplesPerPacket.value = value * 48; }
  });

  // Total bandwidth calculation
  const totalBandwidth = computed(() => {
    return MumbleClient.calcEnforcableBandwidth(
      audioBitrate.value,
      samplesPerPacket.value,
      false  // Position data not sent in current implementation
    );
  });

  // Overhead bandwidth (protocol overhead only)
  const overheadBandwidth = computed(() => {
    return MumbleClient.calcEnforcableBandwidth(
      0,
      samplesPerPacket.value,
      false
    );
  });

  // ===== Actions =====
  
  /**
   * Record PTT key combination
   * Used by settings UI to capture key combo
   */
  function recordPttKey(keyboardjs) {
    let combo = [];
    const keydown = (e) => {
      combo = e.pressedKeys;
      let comboStr = combo.join(" + ");
      pttKeyDisplay.value = "> " + comboStr + " <";
    };
    const keyup = () => {
      keyboardjs.unbind("", keydown, keyup);
      let comboStr = combo.join(" + ");
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

  /**
   * Initialize with config defaults
   * Called once at app startup with values from config.js
   */
  function initWithDefaults(defaults = {}) {
    // Only set if localStorage doesn't have a value yet
    // (createPersistedRef already handles this, but this allows runtime config override)
    if (defaults.voiceMode && !globalThis.localStorage?.getItem('mumble.voiceMode')) {
      voiceMode.value = defaults.voiceMode;
    }
    if (defaults.pttKey && !globalThis.localStorage?.getItem('mumble.pttKey')) {
      pttKey.value = defaults.pttKey;
    }
    if (defaults.audioBitrate && !globalThis.localStorage?.getItem('mumble.audioBitrate')) {
      audioBitrate.value = defaults.audioBitrate;
    }
    if (defaults.samplesPerPacket && !globalThis.localStorage?.getItem('mumble.samplesPerPacket')) {
      samplesPerPacket.value = defaults.samplesPerPacket;
    }
    if (defaults.jitterBufferSize && !globalThis.localStorage?.getItem('mumble.jitterBufferSize')) {
      jitterBufferSize.value = defaults.jitterBufferSize;
    }
    if (defaults.jitterBufferMode && !globalThis.localStorage?.getItem('mumble.jitterBufferMode')) {
      jitterBufferMode.value = defaults.jitterBufferMode;
    }
    if (defaults.userCountInChannelName !== undefined && !globalThis.localStorage?.getItem('mumble.userCountInChannelName')) {
      userCountInChannelName.value = defaults.userCountInChannelName;
    }
  }

  /**
   * Reset all settings to defaults
   */
  function resetToDefaults() {
    voiceMode.value = 'cont';
    pttKey.value = 'ctrl + shift';
    pttKeyDisplay.value = 'ctrl + shift';
    userCountInChannelName.value = false;
    audioBitrate.value = 40000;
    samplesPerPacket.value = 960;
    jitterBufferSize.value = 3;
    jitterBufferMode.value = 'balanced';
  }

  return {
    // Core settings
    voiceMode,
    pttKey,
    userCountInChannelName,
    audioBitrate,
    samplesPerPacket,
    jitterBufferSize,
    jitterBufferMode,
    
    // Dialog state
    pttKeyDisplay,
    
    // Computed
    msPerPacket,
    totalBandwidth,
    overheadBandwidth,
    
    // Actions
    recordPttKey,
    initWithDefaults,
    resetToDefaults
  };
});
