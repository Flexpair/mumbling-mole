/**
 * useSettings - Vue Composable for Application Settings
 * 
 * Manages persistent application settings with localStorage sync.
 * Combines functionality of Settings and SettingsDialog classes.
 * 
 * Replaced Knockout Settings + SettingsDialog classes (index.js) in Phase 5 Step 5.
 */

import { ref, computed } from 'vue';

export function useSettings(defaults = {}) {
  const load = (key) => globalThis.localStorage.getItem("mumble." + key);
  
  // Core settings (persisted to localStorage)
  const voiceMode = ref(load("voiceMode") || defaults.voiceMode || 'cont');
  const pttKey = ref(load("pttKey") || defaults.pttKey || 'ctrl + shift');
  const userCountInChannelName = ref(
    load("userCountInChannelName") || defaults.userCountInChannelName || false
  );
  const audioBitrate = ref(
    Number(load("audioBitrate")) || defaults.audioBitrate || 40000
  );
  const samplesPerPacket = ref(
    Number(load("samplesPerPacket")) || defaults.samplesPerPacket || 960
  );

  // Dialog-specific state (not persisted)
  const pttKeyDisplay = ref(pttKey.value);

  // Computed property for ms per packet
  const msPerPacket = computed({
    get: () => samplesPerPacket.value / 48,
    set: (value) => { samplesPerPacket.value = value * 48; }
  });

  /**
   * Save settings to localStorage
   */
  const save = () => {
    const saveItem = (key, val) => 
      globalThis.localStorage.setItem("mumble." + key, val);
    
    saveItem("voiceMode", voiceMode.value);
    saveItem("pttKey", pttKey.value);
    saveItem("userCountInChannelName", userCountInChannelName.value);
    saveItem("audioBitrate", audioBitrate.value);
    saveItem("samplesPerPacket", samplesPerPacket.value);
  };

  /**
   * Apply settings from dialog to main settings
   * (Used when dialog is submitted)
   */
  const applyFrom = (dialogSettings) => {
    voiceMode.value = dialogSettings.voiceMode.value;
    pttKey.value = dialogSettings.pttKey.value;
    userCountInChannelName.value = dialogSettings.userCountInChannelName.value;
    audioBitrate.value = dialogSettings.audioBitrate.value;
    samplesPerPacket.value = dialogSettings.samplesPerPacket.value;
    save();
  };

  /**
   * Record PTT key combination
   * (Used by settings dialog)
   */
  const recordPttKey = (keyboardjs) => {
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
  };

  /**
   * Calculate total bandwidth (with position data)
   */
  const totalBandwidth = computed(() => {
    // Import MumbleClient here to avoid circular dependency
    const MumbleClient = require('../mumble-client/index.js').default;
    return MumbleClient.calcEnforcableBandwidth(
      audioBitrate.value,
      samplesPerPacket.value,
      true
    );
  });

  /**
   * Calculate position bandwidth (overhead for position data)
   */
  const positionBandwidth = computed(() => {
    const MumbleClient = require('../mumble-client/index.js').default;
    return (
      totalBandwidth.value -
      MumbleClient.calcEnforcableBandwidth(
        audioBitrate.value,
        samplesPerPacket.value,
        false
      )
    );
  });

  /**
   * Calculate overhead bandwidth (protocol overhead)
   */
  const overheadBandwidth = computed(() => {
    const MumbleClient = require('../mumble-client/index.js').default;
    return MumbleClient.calcEnforcableBandwidth(
      0,
      samplesPerPacket.value,
      false
    );
  });

  return {
    // Core settings
    voiceMode,
    pttKey,
    userCountInChannelName,
    audioBitrate,
    samplesPerPacket,
    
    // Dialog state
    pttKeyDisplay,
    
    // Computed
    msPerPacket,
    totalBandwidth,
    positionBandwidth,
    overheadBandwidth,
    
    // Methods
    save,
    applyFrom,
    recordPttKey
  };
}
