<template>
  <Teleport to="body">
    <Transition name="dialog-fade">
      <div 
        v-if="visible" 
        class="connection-info-dialog dialog-container"
        role="dialog"
        aria-labelledby="dialog-title"
      >
        <!-- Sidebar Navigation -->
        <div class="dialog-sidebar">
          <div class="sidebar-header" id="dialog-title">
            Settings
          </div>
          <nav class="sidebar-nav" role="tablist">
            <button 
              :class="['nav-item', { active: activeTab === 'latency' }]"
              @click="activeTab = 'latency'"
              type="button"
            >
              <span>Audio Delay</span>
            </button>
            <button 
              :class="['nav-item', { active: activeTab === 'bandwidth' }]"
              @click="activeTab = 'bandwidth'"
              type="button"
            >
              <span>Bandwidth</span>
            </button>
            <button 
              :class="['nav-item', { active: activeTab === 'client' }]"
              @click="activeTab = 'client'"
              type="button"
            >
              <span>Client</span>
            </button>
            <button 
              :class="['nav-item', { active: activeTab === 'server' }]"
              @click="activeTab = 'server'"
              type="button"
            >
              <span>Server</span>
            </button>
          </nav>
          <div class="sidebar-footer">
            <button class="close-button" @click="handleHide">
              {{ t('settingsdialog.close') }}
            </button>
          </div>
        </div>

        <!-- Main Content Area -->
        <div class="dialog-main">
          <Transition name="fade-slide" mode="out-in">
            
            <!-- Client Tab -->
            <div v-if="activeTab === 'client'" key="client" class="content-panel" role="tabpanel" id="client-panel">
              <h2 class="panel-title">Client Settings</h2>
              
              <div class="setting-group">
                <label class="setting-label">{{ t('settingsdialog.transmission') }}</label>
                <div class="control-wrapper">
                  <select v-model="voiceMode" class="modern-select">
                    <option value="cont">{{ t('settingsdialog.cont') }}</option>
                    <option value="ptt" disabled>{{ t('settingsdialog.ptt') }} (Temporarily Disabled)</option>
                  </select>
                </div>
              </div>

              <div v-if="voiceMode === 'ptt'" class="setting-group">
                <label class="setting-label">{{ t('settingsdialog.ptt_key') }}</label>
                <div class="control-wrapper">
                  <button class="ptt-record-btn" @click="recordPttKey">
                    {{ pttKeyDisplay }}
                  </button>
                </div>
              </div>

              <div class="setting-group" style="margin-top: 30px;">
                <label class="setting-label">Client Version</label>
                <button @click="copyCommitHash" class="action-button" :title="copyButtonTitle">
                  {{ copyButtonText }}
                </button>
              </div>
            </div>

            <!-- Audio Delay Tab -->
            <div v-else-if="activeTab === 'latency'" key="latency" class="content-panel" role="tabpanel" id="latency-panel">
              <h2 class="panel-title">Audio Delay</h2>

              <div class="stat-card">
                <div class="stat-label">Network Latency (Ping)</div>
                <div class="stat-value-large">
                  <template v-if="latencyMs && !Number.isNaN(latencyMs)">
                    {{ latencyMs.toFixed(1) }} <span class="unit">ms</span>
                  </template>
                  <template v-else>--</template>
                </div>
                <div class="stat-sub" v-if="latencyMs">
                  Deviation: ±{{ latencyDeviation.toFixed(1) }} ms
                </div>
              </div>

              <div class="setting-group">
                <label class="setting-label">Jitter Buffer Strategy</label>
                <div class="control-wrapper">
                  <select v-model="jitterBufferMode" class="modern-select">
                    <option value="low-latency">Low Latency</option>
                    <option value="balanced">Balanced</option>
                    <option value="high-quality">High Quality</option>
                  </select>
                </div>
                <div class="info-note">
                  Current buffer: {{ jitterBufferMs }} ms = {{ jitterBufferSize }} Audio Packets
                </div>
              </div>
            </div>

            <!-- Bandwidth Tab -->
            <div v-else-if="activeTab === 'bandwidth'" key="bandwidth" class="content-panel" role="tabpanel" id="bandwidth-panel">
              <h2 class="panel-title">Outgoing Audio Bandwidth</h2>

              <div class="setting-group">
                <div class="label-row">
                  <p class="setting-label" style="font-weight: normal; opacity: 0.8; margin-bottom: 15px;">
                    <span v-if="isServerLimited">
                      Gross bandwidth is limited by server to {{ (maxAllowedBandwidth / 1000).toFixed(0) }} kbps.
                    </span>
                    <span v-else>
                      Gross bandwidth includes audio data and protocol overhead.
                    </span>
                  </p>
                </div>
                <div class="slider-container" style="position: relative; margin: 50px 0 50px 0;">
                  <!-- Floating Badges -->
                  <div class="floating-badge top" :style="grossBadgeStyle">
                    {{ (grossBandwidth / 1000).toFixed(1) }} kbps
                  </div>
                  <div class="floating-badge bottom" :style="netBadgeStyle">
                    {{ (audioBitrate / 1000).toFixed(1) }} kbps
                  </div>

                  <div 
                    class="custom-slider" 
                    ref="sliderTrack"
                    @mousedown="onDragStart"
                    @touchstart.prevent="onDragStart"
                    @keydown="onKeyDown"
                    tabindex="0"
                    role="slider"
                    :aria-valuemin="minGrossBandwidth"
                    :aria-valuemax="maxAllowedBandwidth"
                    :aria-valuenow="grossBandwidth"
                    aria-label="Gross bandwidth slider"
                  >
                    <!-- Net Bandwidth Fill -->
                    <div class="slider-track-fill" :style="trackFillStyle"></div>
                    
                    <!-- Overhead Thumb -->
                    <div class="slider-thumb" :style="thumbStyle">
                      <span class="slider-label-inner">
                        Overhead
                      </span>
                    </div>
                  </div>
                  
                  <div class="slider-labels">
                    <span>Low</span>
                    <span>High</span>
                  </div>
                </div>

                <div class="label-row" style="margin-top: 15px;">
                   <p class="setting-label" style="font-weight: normal; opacity: 0.8;">
                     Net bandwidth minimum is 8 kbps for audio transmission.
                   </p>
                </div>
              </div>
            </div>

            <!-- Server Tab -->
            <div v-else-if="activeTab === 'server'" key="server" class="content-panel" role="tabpanel" id="server-panel">
              <h2 class="panel-title">Server Version Info</h2>

              <div class="info-section">
                <div class="info-row">
                  <span class="label">Version:</span>
                  <span class="value" v-if="serverVersion">{{ serverVersion.release }}</span>
                  <span class="value" v-else>Unknown</span>
                </div>
                <div class="info-row">
                  <span class="label">OS:</span>
                  <span class="value" v-if="serverVersion">{{ serverVersion.os }} {{ serverVersion.osVersion }}</span>
                  <span class="value" v-else>Unknown</span>
                </div>
              </div>
            </div>

          </Transition>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup>
import { Teleport, Transition, computed, inject, watch, ref, onMounted, onUnmounted } from 'vue';
import MumbleClient from '../mumble-client/index.js';
import buildInfo from '../build-info.json';
import { useClipboard } from '../composables';
import keyboardjs from 'keyboardjs';

const t = inject('translate');

// Active tab state - default to first tab (latency)
const activeTab = ref('latency');

// Clipboard composable
const { copy: copyToClipboard, copied } = useClipboard({ timeout: 2000 });
const commitHash = buildInfo.commit;

const copyButtonText = computed(() => 
  copied.value ? '✓ Copied' : `Commit: ${commitHash.substring(0, 7)}`
);

const copyButtonTitle = computed(() =>
  copied.value ? 'Copied!' : `Copy full hash: ${commitHash}`
);

const copyCommitHash = () => copyToClipboard(commitHash);

// AppState Injection
const appState = inject('appState');

const visible = computed({
  get: () => appState.connectionInfo.visible.value,
  set: (val) => { appState.connectionInfo.visible.value = val; }
});

// Connection Stats
const serverVersion = computed(() => appState.connectionInfo.serverVersion.value);
const latencyMs = computed(() => appState.connectionInfo.latencyMs.value);
const latencyDeviation = computed(() => appState.connectionInfo.latencyDeviation.value);
const maxBandwidth = computed(() => appState.connectionInfo.maxBandwidth.value);

// Settings
const voiceMode = computed({
  get: () => appState.settings.voiceMode.value,
  set: (val) => { appState.settings.voiceMode.value = val; }
});

const pttKeyDisplay = computed({
  get: () => appState.settings.pttKeyDisplay.value,
  set: (val) => { appState.settings.pttKeyDisplay.value = val; }
});

const audioBitrate = computed({
  get: () => appState.settings.audioBitrate.value,
  set: (val) => { appState.settings.audioBitrate.value = val; }
});

const samplesPerPacket = computed({
  get: () => appState.settings.samplesPerPacket.value,
  set: (val) => { appState.settings.samplesPerPacket.value = val; }
});

const msPerPacket = computed({
  get: () => samplesPerPacket.value / 48,
  set: (val) => { samplesPerPacket.value = val * 48; }
});

const jitterBufferSize = computed({
  get: () => appState.settings.jitterBufferSize.value,
  set: (val) => { appState.settings.jitterBufferSize.value = val; }
});

const jitterBufferMode = computed({
  get: () => appState.settings.jitterBufferMode.value,
  set: (val) => { appState.settings.jitterBufferMode.value = val; }
});

const MS_PER_PACKET = 20;
const jitterBufferMs = computed(() => jitterBufferSize.value * MS_PER_PACKET);

const totalBandwidth = computed(() => appState.settings.totalBandwidth.value);
const overheadBandwidth = computed(() => appState.settings.overheadBandwidth.value);

const grossBandwidth = computed({
  get: () => appState.settings.totalBandwidth.value,
  set: (val) => {
    // Clamp to max allowed
    if (val > maxAllowedBandwidth.value) val = maxAllowedBandwidth.value;
    
    const overhead = appState.settings.overheadBandwidth.value;
    let newNet = val - overhead;
    if (newNet < 8000) newNet = 8000;
    appState.settings.audioBitrate.value = newNet;
  }
});

// Custom Slider Logic
const sliderTrack = ref(null);
const isDragging = ref(false);

const onDragStart = (event) => {
  isDragging.value = true;
  updateSliderFromEvent(event);
  window.addEventListener('mousemove', onDragMove);
  window.addEventListener('mouseup', onDragEnd);
  window.addEventListener('touchmove', onDragMove);
  window.addEventListener('touchend', onDragEnd);
};

const onDragMove = (event) => {
  if (!isDragging.value) return;
  updateSliderFromEvent(event);
};

const onDragEnd = () => {
  isDragging.value = false;
  window.removeEventListener('mousemove', onDragMove);
  window.removeEventListener('mouseup', onDragEnd);
  window.removeEventListener('touchmove', onDragMove);
  window.removeEventListener('touchend', onDragEnd);
};

// Keyboard navigation for slider
const onKeyDown = (event) => {
  const step = 1000; // 1 kbps step
  let newValue = grossBandwidth.value;
  
  switch(event.key) {
    case 'ArrowRight':
    case 'ArrowUp':
      event.preventDefault();
      newValue = Math.min(maxAllowedBandwidth.value, grossBandwidth.value + step);
      break;
    case 'ArrowLeft':
    case 'ArrowDown':
      event.preventDefault();
      newValue = Math.max(minGrossBandwidth.value, grossBandwidth.value - step);
      break;
    case 'Home':
      event.preventDefault();
      newValue = minGrossBandwidth.value;
      break;
    case 'End':
      event.preventDefault();
      newValue = maxAllowedBandwidth.value;
      break;
    default:
      return;
  }
  
  grossBandwidth.value = newValue;
};

// Cleanup on unmount
onUnmounted(() => {
  if (isDragging.value) {
    window.removeEventListener('mousemove', onDragMove);
    window.removeEventListener('mouseup', onDragEnd);
    window.removeEventListener('touchmove', onDragMove);
    window.removeEventListener('touchend', onDragEnd);
  }
});

const updateSliderFromEvent = (event) => {
  if (!sliderTrack.value) return;
  const rect = sliderTrack.value.getBoundingClientRect();
  const clientX = event.touches ? event.touches[0].clientX : event.clientX;
  
  let x = clientX - rect.left;
  // Clamp to track
  if (x < 0) x = 0;
  if (x > rect.width) x = rect.width;
  
  const percentage = x / rect.width;
  const max = maxAllowedBandwidth.value;
  
  // The user is dragging the RIGHT edge of the overhead block (Total Bandwidth)
  let newGross = percentage * max;
  
  grossBandwidth.value = Math.round(newGross);
};

const thumbStyle = computed(() => {
  const max = maxAllowedBandwidth.value;
  if (!max) return { width: '0%', left: '0%' };
  
  const overhead = overheadBandwidth.value;
  const gross = grossBandwidth.value;
  
  // Width is proportional to overhead
  const widthPct = (overhead / max) * 100;
  
  // Right edge is at gross/max
  // Left edge is at (gross - overhead)/max
  const net = gross - overhead;
  const leftPct = (net / max) * 100;
  
  return {
    width: `${widthPct}%`,
    left: `${leftPct}%`
  };
});

const trackFillStyle = computed(() => {
   const max = maxAllowedBandwidth.value;
   if (!max) return { width: '0%' };
   
   const overhead = overheadBandwidth.value;
   const gross = grossBandwidth.value;
   const net = gross - overhead;
   
   // Fill up to the start of the thumb (Net Bandwidth)
   const widthPct = (net / max) * 100;
   return { width: `${widthPct}%` };
});

const grossBadgeStyle = computed(() => {
  const max = maxAllowedBandwidth.value;
  if (!max) return { left: '0%' };
  const gross = grossBandwidth.value;
  const pct = (gross / max) * 100;
  return { left: `${pct}%` };
});

const netBadgeStyle = computed(() => {
  const max = maxAllowedBandwidth.value;
  if (!max) return { left: '0%' };
  const overhead = overheadBandwidth.value;
  const gross = grossBandwidth.value;
  const net = gross - overhead;
  const pct = (net / max) * 100;
  return { left: `${pct}%` };
});

const minGrossBandwidth = computed(() => {
  // Opus minimum useful bitrate is ~8 kbps
  // We allow the slider to go exactly down to this limit + overhead
  return 8000 + appState.settings.overheadBandwidth.value;
});

const maxAllowedBandwidth = computed(() => {
  const isConnected = appState.user?.thisUser.value != null;
  const client = isConnected ? appState.client : null;
  if (!client || client.maxBandwidth === undefined || client.maxBandwidth === null) {
    return 130000; // Default max gross (~128k net + overhead)
  }
  return client.maxBandwidth;
});

const isServerLimited = computed(() => {
  const client = appState?.client;
  return client?.maxBandwidth != null;
});

watch(maxAllowedBandwidth, (newMax) => {
  if (grossBandwidth.value > newMax) {
    grossBandwidth.value = newMax;
  }
});

function updateStats() {
  const client = appState?.client;
  if (client) {
    appState.connectionInfo.serverVersion.value = client.serverVersion || null;
    const dataStats = client.dataStats;
    if (dataStats) {
      appState.connectionInfo.latencyMs.value = dataStats.mean;
      appState.connectionInfo.latencyDeviation.value = Math.sqrt(dataStats.variance);
    } else {
      appState.connectionInfo.latencyMs.value = Number.NaN;
      appState.connectionInfo.latencyDeviation.value = Number.NaN;
    }
  } else {
    appState.connectionInfo.serverVersion.value = null;
    appState.connectionInfo.latencyMs.value = Number.NaN;
    appState.connectionInfo.latencyDeviation.value = Number.NaN;
  }
  
  const spp = appState?.settings?.samplesPerPacket?.value;
  if (client && spp) {
    const maxBandwidthValue = client.maxBandwidth;
    const maxBitrateValue = maxBandwidthValue === null || maxBandwidthValue === undefined 
      ? Number.NaN 
      : client.getMaxBitrate(spp, false);
    const actualBitrate = client.getActualBitrate(spp, false);
    const actualBandwidth = MumbleClient.calcEnforcableBandwidth(actualBitrate, spp, false);
    
    appState.connectionInfo.maxBitrate.value = maxBitrateValue;
    appState.connectionInfo.currentBitrate.value = actualBitrate;
    appState.connectionInfo.maxBandwidth.value = maxBandwidthValue;
    appState.connectionInfo.currentBandwidth.value = actualBandwidth;
  }
}

let statsInterval = null;

watch(visible, (val) => {
  if (val) {
    // Reset to first tab when dialog opens
    activeTab.value = 'latency';
    updateStats();
    statsInterval = setInterval(updateStats, 1000);
  } else {
    if (statsInterval) {
      clearInterval(statsInterval);
      statsInterval = null;
    }
  }
});

const recordPttKey = () => {
  appState.settings.recordPttKey(keyboardjs);
};

const handleHide = () => {
  visible.value = false;
  appState.applySettings(); // Auto-save on close
  if (appState?.ui.currentOpenModal.value === 'connectionInfo') {
    appState.ui.currentOpenModal.value = null;
  }
};

onMounted(() => {
  appState.connectionInfo.show = (tab = 'audio') => {
    if (appState.ui.currentOpenModal.value !== null) return;
    updateStats();
    // Map old tab names to new ones if necessary
    if (tab === 'info' || tab === 'connection') activeTab.value = 'latency';
    else if (tab === 'advanced') activeTab.value = 'latency';
    else activeTab.value = tab;
    
    visible.value = true;
    appState.ui.currentOpenModal.value = 'connectionInfo';
  };

  appState.connectionInfo.hide = handleHide;

  if (appState.settings) {
    appState.openSettings = () => {
      if (appState.ui.currentOpenModal.value !== null) return;
      updateStats();
      activeTab.value = 'latency';
      visible.value = true;
      appState.ui.currentOpenModal.value = 'connectionInfo';
    };
    appState.closeSettings = handleHide;
  }
});
</script>

<style scoped>
.dialog-container {
  position: fixed;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 700px;
  height: 500px;
  background: #1e1e1e;
  border-radius: 12px;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
  display: flex;
  overflow: hidden;
  z-index: 1000;
  color: #fff;
  font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
}

/* Sidebar */
.dialog-sidebar {
  width: 220px;
  background: #252526;
  display: flex;
  flex-direction: column;
  border-right: 1px solid #333;
}

.sidebar-header {
  padding: 20px;
  font-size: 18px;
  font-weight: 600;
  color: #fff;
  border-bottom: 1px solid #333;
}

.sidebar-nav {
  flex: 1;
  padding: 10px 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.nav-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 20px;
  background: transparent;
  border: none;
  color: #aaa;
  cursor: pointer;
  text-align: left;
  font-size: 14px;
  transition: all 0.2s;
  border-left: 3px solid transparent;
}

.nav-item:hover {
  background: rgba(255, 255, 255, 0.05);
  color: #fff;
}

.nav-item.active {
  background: rgba(0, 255, 255, 0.1);
  color: #00ffff;
  border-left-color: #00ffff;
}

.sidebar-footer {
  padding: 20px;
  border-top: 1px solid #333;
}

.close-button {
  width: 100%;
  padding: 10px;
  background: #333;
  border: none;
  border-radius: 6px;
  color: #fff;
  cursor: pointer;
  transition: background 0.2s;
}

.close-button:hover {
  background: #444;
}

/* Main Content */
.dialog-main {
  flex: 1;
  background: #1e1e1e;
  position: relative;
  overflow-y: auto;
}

.content-panel {
  padding: 30px;
}

.panel-title {
  margin: 0 0 25px 0;
  font-size: 24px;
  font-weight: 300;
  color: #fff;
}

/* Settings Groups */
.setting-group {
  margin-bottom: 25px;
}

.setting-label {
  display: block;
  margin-bottom: 8px;
  color: #ccc;
  font-size: 14px;
  font-weight: 500;
}

.control-wrapper {
  position: relative;
}

.modern-select {
  width: 100%;
  padding: 10px;
  background: #2d2d2d;
  border: 1px solid #444;
  border-radius: 6px;
  color: #fff;
  font-size: 14px;
  outline: none;
  cursor: pointer;
}

.modern-select:focus {
  border-color: #00ffff;
}

.ptt-record-btn {
  width: 100%;
  padding: 10px;
  background: #2d2d2d;
  border: 1px solid #444;
  border-radius: 6px;
  color: #00ffff;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
}

.ptt-record-btn:hover {
  background: #333;
  border-color: #00ffff;
}

/* Slider */
.slider-container {
  margin: 15px 0;
}

.modern-slider {
  width: 100%;
  height: 6px;
  background: #444;
  border-radius: 3px;
  outline: none;
  -webkit-appearance: none;
  appearance: none;
}

.modern-slider::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  width: 18px;
  height: 18px;
  background: #00ffff;
  border-radius: 50%;
  cursor: pointer;
  transition: transform 0.1s;
}

.modern-slider::-webkit-slider-thumb:hover {
  transform: scale(1.2);
}

.slider-labels {
  display: flex;
  justify-content: space-between;
  font-size: 12px;
  color: #666;
  margin-top: 5px;
}

.value-badge {
  background: #00ffff;
  color: #000;
  padding: 2px 8px;
  border-radius: 10px;
  font-size: 12px;
  font-weight: 700;
  float: right;
}

.label-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

/* Stats */
.stat-card {
  background: #252526;
  padding: 20px;
  border-radius: 8px;
  margin-bottom: 20px;
  text-align: center;
  border: 1px solid #333;
}

.stat-value-large {
  font-size: 36px;
  font-weight: 300;
  color: #00ffff;
  margin: 10px 0;
}

.stat-sub {
  font-size: 12px;
  color: #888;
}

.stat-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 15px;
  margin-bottom: 25px;
}

.stat-item {
  background: #252526;
  padding: 15px;
  border-radius: 8px;
  border: 1px solid #333;
}

.stat-label {
  font-size: 12px;
  color: #888;
  margin-bottom: 5px;
}

.stat-value {
  font-size: 18px;
  font-weight: 600;
  color: #fff;
}

.unit {
  font-size: 12px;
  color: #666;
  font-weight: normal;
}

/* Info Section */
.info-section {
  background: #252526;
  padding: 20px;
  border-radius: 8px;
  border: 1px solid #333;
}

.info-section h3 {
  margin: 0 0 15px 0;
  font-size: 14px;
  color: #aaa;
  text-transform: uppercase;
  letter-spacing: 1px;
}

.info-row {
  display: flex;
  justify-content: space-between;
  padding: 8px 0;
  border-bottom: 1px solid #333;
}

.info-row:last-child {
  border-bottom: none;
}

.info-row .label {
  color: #888;
}

.info-row .value {
  color: #fff;
}

/* Notes & Helpers */
.info-note {
  margin-top: 8px;
  font-size: 12px;
  color: #888;
}

.info-note.warning {
  color: #ffaa00;
}

.muted {
  color: #666;
}

.divider {
  height: 1px;
  background: #333;
  margin: 25px 0;
}

.action-button {
  background: #333;
  color: #fff;
  border: 1px solid #444;
  padding: 8px 16px;
  border-radius: 4px;
  cursor: pointer;
  font-size: 13px;
  transition: all 0.2s;
}

.action-button:hover {
  background: #444;
  border-color: #555;
}

/* Transitions */
.dialog-fade-enter-active,
.dialog-fade-leave-active {
  transition: opacity 0.2s ease, transform 0.2s ease;
}

.dialog-fade-enter-from,
.dialog-fade-leave-to {
  opacity: 0;
  transform: translate(-50%, -48%) scale(0.98);
}

.fade-slide-enter-active,
.fade-slide-leave-active {
  transition: all 0.2s ease;
}

.fade-slide-enter-from {
  opacity: 0;
  transform: translateY(10px);
}

.fade-slide-leave-to {
  opacity: 0;
  transform: translateY(-10px);
  position: absolute;
  width: 100%;
}

/* Custom Slider */
.custom-slider {
  position: relative;
  height: 24px;
  background: #1e1e1e;
  border-radius: 2px;
  cursor: pointer;
  margin: 10px 0;
  border: 1px solid #333;
  touch-action: none; /* Prevent scrolling while dragging */
}

.slider-track-fill {
  position: absolute;
  top: 0;
  left: 0;
  height: 100%;
  background: #157878; /* Corporate Teal */
  border-radius: 1px 0 0 1px;
  pointer-events: none;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
}

.slider-thumb {
  position: absolute;
  top: -2px; /* Slightly larger than track */
  height: 26px;
  box-sizing: border-box;
  background: #a84444; /* Muted Red for Overhead */
  border: 1px solid #ccc;
  border-radius: 2px;
  box-shadow: 0 2px 4px rgba(0,0,0,0.3);
  cursor: grab;
  z-index: 10;
  /* Add stripes to indicate it's a "block" */
  background-image: linear-gradient(45deg, rgba(255,255,255,.1) 25%, transparent 25%, transparent 50%, rgba(255,255,255,.1) 50%, rgba(255,255,255,.1) 75%, transparent 75%, transparent);
  background-size: 10px 10px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.slider-label-inner {
  font-size: 10px;
  color: rgba(255, 255, 255, 0.9);
  white-space: nowrap;
  padding: 0 4px;
  text-shadow: 0 1px 2px rgba(0,0,0,0.5);
  pointer-events: none;
  user-select: none;
  -webkit-user-select: none;
}

.slider-thumb:active {
  cursor: grabbing;
  transform: scale(1.02);
}

/* Floating Badges */
.floating-badge {
  position: absolute;
  color: #ccc;
  font-size: 12px;
  font-weight: normal;
  white-space: nowrap;
  pointer-events: none;
  z-index: 20;
  background: none;
  border: none;
  box-shadow: none;
  padding: 0;
  line-height: 14px;
}

/* Top Badge (Gross) - Text Left of Line */
.floating-badge.top {
  top: -52px;
  transform: translateX(-100%);
  padding-right: 8px;
}

.floating-badge.top::after {
  content: '';
  position: absolute;
  right: 0;
  top: 100%;
  width: 1px;
  height: 50px; /* Line from -38px to 12px, matching bottom spacing */
  background: #666;
  display: block;
  z-index: 25;
}

/* Bottom Badge (Net) - Text Right of Line */
.floating-badge.bottom {
  top: 62px;
  transform: translateX(0);
  padding-left: 8px;
}

.floating-badge.bottom::before {
  content: '';
  position: absolute;
  left: 0;
  bottom: 100%;
  width: 1px;
  height: 50px; /* Line from 62px to 12px, matching top line length */
  background: #666;
  display: block;
  z-index: 25;
}
</style>
