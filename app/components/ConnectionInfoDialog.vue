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
                    <option value="ptt" disabled>{{ t('settingsdialog.ptt') }} {{ t('settingsdialog.ptt_disabled') }}</option>
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

              <div class="setting-group version-group">
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
                  <p class="setting-label info top-info">
                    <span v-if="isServerLimited">
                      Gross bandwidth is limited by server to {{ (maxAllowedBandwidth / 1000).toFixed(0) }} kbps.
                    </span>
                    <span v-else>
                      Gross bandwidth includes audio data and protocol overhead.
                    </span>
                  </p>
                </div>
                <div class="slider-container bandwidth-slider">
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

                <div class="label-row bottom-spacing">
                   <p class="setting-label info">
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
import { Teleport, Transition, computed, inject, watch, ref, onMounted, onUnmounted, useTemplateRef, toRefs } from 'vue';
import { storeToRefs } from 'pinia';
import MumbleClient from '../mumble-client/index.js';
import buildInfo from '../build-info.json';
import { useClipboard } from '../composables';
import keyboardjs from 'keyboardjs';
import { useUIStore } from '../stores/uiStore';
import { useConnectionStore } from '../stores/connectionStore';
import { useUserStore } from '../stores/userStore';
import { useDialogStore } from '../stores/dialogStore';
import { useSettingsStore } from '../stores/settingsStore';

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

// Pinia stores
const settingsStore = useSettingsStore();
const uiStore = useUIStore();
const connectionStore = useConnectionStore();
const userStore = useUserStore();
const dialogStore = useDialogStore();

// Use toRefs to get reactive refs from nested dialog store object
const infoDialog = toRefs(dialogStore.infoDialog);

const visible = computed({
  get: () => uiStore.currentOpenModal === 'connectionInfo' || uiStore.currentOpenModal === 'settings',
  set: (val) => { 
    if (!val) uiStore.currentOpenModal = null; 
  }
});

// Connection Stats (Local refs)
const serverVersion = ref(null);
const latencyMs = ref(Number.NaN);
const latencyDeviation = ref(Number.NaN);

// Settings: use storeToRefs for direct two-way binding
const { 
  voiceMode, 
  pttKeyDisplay, 
  audioBitrate, 
  samplesPerPacket, 
  jitterBufferSize, 
  jitterBufferMode,
  totalBandwidth,
  overheadBandwidth
} = storeToRefs(settingsStore);

const MS_PER_PACKET = 20;
const MIN_AUDIO_BITRATE = 8000;
const jitterBufferMs = computed(() => jitterBufferSize.value * MS_PER_PACKET);

const grossBandwidth = computed({
  get: () => totalBandwidth.value,
  set: (val) => {
    // Clamp to max allowed
    if (val > maxAllowedBandwidth.value) val = maxAllowedBandwidth.value;
    
    const overhead = overheadBandwidth.value;
    let newNet = val - overhead;
    if (newNet < MIN_AUDIO_BITRATE) newNet = MIN_AUDIO_BITRATE;
    audioBitrate.value = newNet;
  }
});

// Custom Slider Logic
const sliderTrack = useTemplateRef('sliderTrack');
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
  let newValue;
  
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
  window.removeEventListener('mousemove', onDragMove);
  window.removeEventListener('mouseup', onDragEnd);
  window.removeEventListener('touchmove', onDragMove);
  window.removeEventListener('touchend', onDragEnd);

  if (statsInterval) {
    clearInterval(statsInterval);
    statsInterval = null;
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
  return MIN_AUDIO_BITRATE + overheadBandwidth.value;
});

const maxAllowedBandwidth = computed(() => {
  const isConnected = userStore.thisUser != null;
  const client = isConnected ? connectionStore.client : null;
  if (!client || client.maxBandwidth === undefined || client.maxBandwidth === null) {
    return 130000; // Default max gross (~128k net + overhead)
  }
  return client.maxBandwidth;
});

const isServerLimited = computed(() => {
  const client = connectionStore.client;
  return client?.maxBandwidth != null;
});

watch(maxAllowedBandwidth, (newMax) => {
  if (grossBandwidth.value > newMax) {
    grossBandwidth.value = newMax;
  }
});

function updateStats() {
  const client = connectionStore.getClient();
  if (client) {
    serverVersion.value = client.serverVersion || null;
    const dataStats = client.dataStats;
    if (dataStats) {
      latencyMs.value = dataStats.mean;
      latencyDeviation.value = Math.sqrt(dataStats.variance);
    } else {
      latencyMs.value = Number.NaN;
      latencyDeviation.value = Number.NaN;
    }
  } else {
    serverVersion.value = null;
    latencyMs.value = Number.NaN;
    latencyDeviation.value = Number.NaN;
  }
  
  const spp = samplesPerPacket.value;
  if (client && spp) {
    const maxBandwidthValue = client.maxBandwidth;
    const maxBitrateValue = maxBandwidthValue === null || maxBandwidthValue === undefined 
      ? Number.NaN 
      : client.getMaxBitrate(spp, false);
    const actualBitrate = client.getActualBitrate(spp, false);
    const actualBandwidth = MumbleClient.calcEnforcableBandwidth(actualBitrate, spp, false);
    
    infoDialog.maxBitrate.value = maxBitrateValue;
    infoDialog.currentBitrate.value = actualBitrate;
    infoDialog.maxBandwidth.value = maxBandwidthValue;
    infoDialog.currentBandwidth.value = actualBandwidth;
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
  settingsStore.recordPttKey(keyboardjs);
};

const handleHide = () => {
  visible.value = false;
  // Settings are auto-saved via settingsStore watch() - no manual save needed
};

// Watch for modal opening to reset tab
watch(() => uiStore.currentOpenModal, (newVal) => {
  if (newVal === 'connectionInfo' || newVal === 'settings') {
    updateStats();
    // If opening as 'settings', default to latency (or whatever default)
    // If opening as 'connectionInfo', default to latency
    // Logic from old appState.openSettings:
    activeTab.value = 'latency';
  }
});

onMounted(() => {
  // No longer need to register appState.connectionInfo.show or appState.openSettings
  // Visibility is driven by uiStore.currentOpenModal
});
</script>

<style scoped>
.dialog-container {
  position: fixed;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 100%;
  max-width: min(700px, calc(100vw - 40px));
  height: auto;
  max-height: calc(100vh - 40px);
  min-height: 300px;
  background: #1e1e1e;
  border-radius: 12px;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
  display: flex;
  flex-direction: row;
  overflow: hidden;
  z-index: 1000;
  color: #fff;
  font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
  box-sizing: border-box;
}

/* Sidebar */
.dialog-sidebar {
  width: 220px;
  min-width: 180px;
  flex-shrink: 0;
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

.setting-group.version-group {
  margin-top: 30px;
}

.setting-label {
  display: block;
  margin-bottom: 8px;
  color: #ccc;
  font-size: 14px;
  font-weight: 500;
}

.setting-label.info {
  font-weight: normal;
  opacity: 0.8;
}

.setting-label.info.top-info {
  margin-bottom: 15px;
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

.ptt-record-btn,
.action-button {
  padding: 10px 16px;
  background: #2d2d2d;
  border: 1px solid #444;
  border-radius: 6px;
  color: #fff;
  cursor: pointer;
  transition: all 0.2s;
}

.ptt-record-btn {
  width: 100%;
  color: #00ffff;
  font-weight: 600;
}

.ptt-record-btn:hover {
  background: #333;
  border-color: #00ffff;
}

.action-button {
  font-size: 13px;
}

/* Slider */
.slider-container {
  margin: 15px 0;
}

.slider-container.bandwidth-slider {
  position: relative;
  margin: 50px 0;
}

.slider-labels {
  display: flex;
  justify-content: space-between;
  font-size: 12px;
  color: #666;
  margin-top: 5px;
}

.label-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.label-row.bottom-spacing {
  margin-top: 15px;
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

/* Mobile responsive layout */
@media only screen and (max-width: 768px) {
  .dialog-container {
    flex-direction: column;
    max-height: calc(100vh - 20px);
    max-width: calc(100vw - 20px);
  }
  
  .dialog-sidebar {
    width: 100%;
    min-width: 100%;
    flex-shrink: 0;
    border-right: none;
    border-bottom: 1px solid #333;
  }
  
  .sidebar-header {
    padding: 12px 16px;
    font-size: 16px;
  }
  
  .sidebar-nav {
    flex-direction: row;
    overflow-x: auto;
    padding: 0;
    gap: 0;
    -webkit-overflow-scrolling: touch;
  }
  
  .nav-item {
    flex-shrink: 0;
    padding: 10px 16px;
    border-left: none;
    border-bottom: 3px solid transparent;
    white-space: nowrap;
  }
  
  .nav-item.active {
    border-left-color: transparent;
    border-bottom-color: #00ffff;
  }
  
  .sidebar-footer {
    display: none;
  }
  
  .dialog-main {
    flex: 1;
    overflow-y: auto;
    min-height: 0;
  }
  
  .content-panel {
    padding: 20px 16px;
  }
  
  .panel-title {
    font-size: 20px;
    margin-bottom: 20px;
  }
  
  .stat-card {
    padding: 16px;
  }
  
  .stat-value-large {
    font-size: 28px;
  }
  
  /* Hide complex slider badges on mobile for cleaner UI */
  .floating-badge {
    display: none;
  }
}

/* Small mobile adjustments */
@media only screen and (max-width: 480px) {
  .dialog-container {
    border-radius: 8px;
  }
  
  .sidebar-header {
    padding: 10px 12px;
    font-size: 14px;
  }
  
  .nav-item {
    padding: 8px 12px;
    font-size: 13px;
  }
  
  .content-panel {
    padding: 16px 12px;
  }
  
  .panel-title {
    font-size: 18px;
  }
  
  .setting-group {
    margin-bottom: 20px;
  }
}

/* Landscape mobile - reduce vertical spacing */
@media only screen and (max-height: 500px) and (orientation: landscape) {
  .dialog-container {
    flex-direction: row;
    max-height: calc(100vh - 20px);
  }
  
  .dialog-sidebar {
    width: 160px;
    min-width: 140px;
    border-right: 1px solid #333;
    border-bottom: none;
  }
  
  .sidebar-header {
    padding: 10px 12px;
    font-size: 14px;
  }
  
  .sidebar-nav {
    flex-direction: column;
    overflow-x: visible;
  }
  
  .nav-item {
    padding: 8px 12px;
    font-size: 13px;
    border-left: 3px solid transparent;
    border-bottom: none;
  }
  
  .nav-item.active {
    border-left-color: #00ffff;
    border-bottom-color: transparent;
  }
  
  .sidebar-footer {
    display: block;
    padding: 10px;
  }
  
  .content-panel {
    padding: 16px;
  }
  
  .panel-title {
    font-size: 18px;
    margin-bottom: 16px;
  }
}
</style>
