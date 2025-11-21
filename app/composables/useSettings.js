/**
 * useSettings - Vue Composable for Application Settings
 * 
 * Manages persistent application settings with localStorage sync.
 * Combines functionality of Settings and SettingsDialog classes.
 * 
 * Replaced Knockout Settings + SettingsDialog classes (index.js) in Phase 5 Step 5.
 * 
 * Now uses useLocalStorage composable for automatic persistence (eliminates manual save() boilerplate).
 */

import { ref, computed } from 'vue';
import { useLocalStorage } from './useLocalStorage.js';

// Cache MumbleClient import to avoid repeated require() calls in computed properties
let _mumbleClient = null;
function getMumbleClient() {
  if (!_mumbleClient) {
    _mumbleClient = require('../mumble-client/index.js').default;
  }
  return _mumbleClient;
}

export function useSettings(defaults = {}) {
  // Core settings (auto-persisted to localStorage via useLocalStorage)
  const voiceMode = useLocalStorage('voiceMode', defaults.voiceMode || 'cont', { prefix: 'mumble.' });
  const pttKey = useLocalStorage('pttKey', defaults.pttKey || 'ctrl + shift', { prefix: 'mumble.' });
  const userCountInChannelName = useLocalStorage('userCountInChannelName', defaults.userCountInChannelName || false, { prefix: 'mumble.' });
  const audioBitrate = useLocalStorage('audioBitrate', defaults.audioBitrate || 40000, { prefix: 'mumble.' });
  const samplesPerPacket = useLocalStorage('samplesPerPacket', defaults.samplesPerPacket || 960, { prefix: 'mumble.' });
  // Default jitter buffer: 3 packets (60ms) - safe for typical 30-50ms latency
  const jitterBufferSize = useLocalStorage('jitterBufferSize', defaults.jitterBufferSize || 3, { prefix: 'mumble.' });
  // Jitter buffer mode: 'low-latency', 'balanced', 'high-quality'
  const jitterBufferMode = useLocalStorage('jitterBufferMode', defaults.jitterBufferMode || 'balanced', { prefix: 'mumble.' });

  // Dialog-specific state (not persisted)
  const pttKeyDisplay = ref(pttKey.value);

  // Computed property for ms per packet
  const msPerPacket = computed({
    get: () => samplesPerPacket.value / 48,
    set: (value) => { samplesPerPacket.value = value * 48; }
  });

  /**
   * Apply settings from dialog to main settings
   * Note: With useLocalStorage, changes are auto-saved.
   * This method just copies values (no explicit save() needed).
   */
  const applyFrom = (dialogSettings) => {
    voiceMode.value = dialogSettings.voiceMode.value;
    pttKey.value = dialogSettings.pttKey.value;
    userCountInChannelName.value = dialogSettings.userCountInChannelName.value;
    audioBitrate.value = dialogSettings.audioBitrate.value;
    samplesPerPacket.value = dialogSettings.samplesPerPacket.value;
    jitterBufferSize.value = dialogSettings.jitterBufferSize.value;
    jitterBufferMode.value = dialogSettings.jitterBufferMode.value;
    // No explicit save() needed - useLocalStorage auto-saves
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
   * Calculate total bandwidth (without position data for consistency with actual usage)
   */
  const totalBandwidth = computed(() => {
    const MumbleClient = getMumbleClient();
    return MumbleClient.calcEnforcableBandwidth(
      audioBitrate.value,
      samplesPerPacket.value,
      false  // Changed from true - position data not sent in current implementation
    );
  });

  /**
   * Calculate position bandwidth (overhead for position data)
   * Note: Currently always 0 since position data is not sent (sendPosition=false)
   */
  const positionBandwidth = computed(() => {
    const MumbleClient = getMumbleClient();
    return (
      MumbleClient.calcEnforcableBandwidth(
        audioBitrate.value,
        samplesPerPacket.value,
        true  // with position
      ) -
      MumbleClient.calcEnforcableBandwidth(
        audioBitrate.value,
        samplesPerPacket.value,
        false  // without position
      )
    );
  });

  /**
   * Calculate overhead bandwidth (protocol overhead)
   */
  const overheadBandwidth = computed(() => {
    const MumbleClient = getMumbleClient();
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
    jitterBufferSize,
    jitterBufferMode,
    
    // Dialog state
    pttKeyDisplay,
    
    // Computed
    msPerPacket,
    totalBandwidth,
    positionBandwidth,
    overheadBandwidth,
    
    // Methods
    applyFrom,
    recordPttKey
  };
}
