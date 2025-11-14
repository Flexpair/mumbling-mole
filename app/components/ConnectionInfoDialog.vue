<template>
  <Teleport to="body">
    <Transition name="dialog-fade">
      <div v-if="visible" class="connection-info-dialog dialog">
    <div id="connection-info_title" class="dialog-header">
      Network Connection Info
    </div>
    <div class="dialog-content">
      <h3 id="connection-info_server">Audio server details</h3>
      <template v-if="serverVersion">
        Murmur version {{ serverVersion.release }} <br />
        {{ serverVersion.os }}
        {{ serverVersion.osVersion }}
        <br />
      </template>
      <template v-else>
        Server version: Unknown<br />
      </template>
      <template v-if="maxBandwidth && !Number.isNaN(maxBandwidth)">
        Maximum bandwidth: {{ (maxBandwidth / 1000).toFixed(1) }} kbits/s
      </template>
      <template v-else>
        Maximum bandwidth: Unknown
      </template>
      <br />

      <h3 id="connection-info_webapp">Network statistics</h3>
      <template v-if="latencyMs && !Number.isNaN(latencyMs)">
        <strong>Network latency (TCP ping):</strong>
        {{ latencyMs.toFixed(2) }} ms average
        ({{ latencyDeviation.toFixed(2) }} ms deviation)
        <br />
        <small style="color: #666; font-style: italic;">
          Note: Voice latency is typically 35-80ms higher due to audio encoding/decoding and buffering.
        </small>
      </template>
      <template v-else>
        <strong>Network latency (TCP ping):</strong> Unknown
      </template>

      <h3 id="connection-info_version">Web Client Version</h3>
      <button @click="copyCommitHash" class="copy-commit-button" :title="copyButtonTitle">
        {{ copyButtonText }}
      </button>
    </div>
    <div class="dialog-footer">
      <input
        class="dialog-close"
        type="button"
        @click="handleHide"
        value="OK"
      />
    </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup>
import { Teleport, Transition, computed, inject, watch, ref } from 'vue';
import MumbleClient from '../mumble-client/index.js';
import buildInfo from '../build-info.json';

/**
 * Vue 3 ConnectionInfoDialog Component
 * 
 * Displays connection statistics and server information.
 * Uses Vue refs directly from AppState connectionInfo composable.
 */

// Full git commit hash from build-info.json (generated at build time)
const commitHash = buildInfo.commit;
const copyButtonText = ref(`Copy Commit: ${commitHash.substring(0, 7)}...`);
const copyButtonTitle = ref(`Click to copy full commit hash: ${commitHash}`);

/**
 * Copy commit hash to clipboard
 */
async function copyCommitHash() {
  try {
    await navigator.clipboard.writeText(commitHash);
    copyButtonText.value = '✓ Copied!';
    setTimeout(() => {
      copyButtonText.value = `Copy Commit: ${commitHash.substring(0, 7)}...`;
    }, 2000);
  } catch (err) {
    console.error('Failed to copy commit hash:', err);
    copyButtonText.value = '✗ Copy failed';
    setTimeout(() => {
      copyButtonText.value = `Copy Commit: ${commitHash.substring(0, 7)}...`;
    }, 2000);
  }
}

// Inject AppState (from main app)
const appState = inject('appState');

// Direct access to AppState Vue refs (no local state, no sync needed)
const visible = computed({
  get: () => appState.connectionInfo.visible.value,
  set: (val) => { appState.connectionInfo.visible.value = val; }
});

const serverVersion = computed(() => appState.connectionInfo.serverVersion.value);
const latencyMs = computed(() => appState.connectionInfo.latencyMs.value);
const latencyDeviation = computed(() => appState.connectionInfo.latencyDeviation.value);
const remoteHost = computed(() => appState.connectionInfo.remoteHost.value);
const remotePort = computed(() => appState.connectionInfo.remotePort.value);
const maxBitrate = computed(() => appState.connectionInfo.maxBitrate.value);
const currentBitrate = computed(() => appState.connectionInfo.currentBitrate.value);
const maxBandwidth = computed(() => appState.connectionInfo.maxBandwidth.value);
const currentBandwidth = computed(() => appState.connectionInfo.currentBandwidth.value);
const codec = computed(() => appState.connectionInfo.codec.value);

/**
 * Update connection statistics from client
 */
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
    // Not connected
    appState.connectionInfo.serverVersion.value = null;
    appState.connectionInfo.latencyMs.value = Number.NaN;
    appState.connectionInfo.latencyDeviation.value = Number.NaN;
  }
  
  appState.connectionInfo.remoteHost.value = appState?.connection.remoteHost.value || '';
  appState.connectionInfo.remotePort.value = appState?.connection.remotePort.value || '';
  
  const spp = appState?.settings?.samplesPerPacket?.value;
  if (client && spp) {
    const maxBandwidthValue = client.maxBandwidth;
    const maxBitrateValue = maxBandwidthValue === null || maxBandwidthValue === undefined 
      ? Number.NaN 
      : client.getMaxBitrate(spp, false);
    const actualBitrate = client.getActualBitrate(spp, false);
    const actualBandwidth = MumbleClient.calcEnforcableBandwidth(
      actualBitrate,
      spp,
      false
    );
    
    appState.connectionInfo.maxBitrate.value = maxBitrateValue;
    appState.connectionInfo.currentBitrate.value = actualBitrate;
    appState.connectionInfo.maxBandwidth.value = maxBandwidthValue;
    appState.connectionInfo.currentBandwidth.value = actualBandwidth;
    appState.connectionInfo.codec.value = "Opus"; // only one supported for sending
  } else {
    // Not connected or no settings
    appState.connectionInfo.maxBitrate.value = Number.NaN;
    appState.connectionInfo.currentBitrate.value = Number.NaN;
    appState.connectionInfo.maxBandwidth.value = Number.NaN;
    appState.connectionInfo.currentBandwidth.value = Number.NaN;
    appState.connectionInfo.codec.value = "Unknown";
  }
}

// Watch for visibility changes and update stats when dialog opens
watch(visible, (val) => {
  if (val) {
    updateStats();
  }
});

/**
 * Handle hide button click
 */
function handleHide() {
  visible.value = false;
  
  // Clear modal state in UIState (Vue ref)
  if (appState?.ui.currentOpenModal.value === 'connectionInfo') {
    appState.ui.currentOpenModal.value = null;
  }
}

</script>

<style scoped>
.copy-commit-button {
  padding: 6px 12px;
  margin-top: 4px;
  background-color: #157878;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-family: monospace;
  font-size: 12px;
  transition: background-color 0.2s;
}

.copy-commit-button:hover {
  background-color: #1a9191;
}

.copy-commit-button:active {
  background-color: #0f5858;
}
</style>
// Expose show method to appState for Toolbar click handler
appState.connectionInfo.show = () => {
  // Prevent opening if another modal is already open
  if (appState.ui.currentOpenModal.value !== null) {
    return;
  }
  updateStats();
  visible.value = true;
  appState.ui.currentOpenModal.value = 'connectionInfo';
};

appState.connectionInfo.hide = handleHide;
</script>

<style scoped>
/* Ensure connection info dialog floats above everything */
.dialog {
  position: fixed !important;
}

/* Transition animations for dialog */
.dialog-fade-enter-active,
.dialog-fade-leave-active {
  transition: opacity 0.2s ease;
}

.dialog-fade-enter-from,
.dialog-fade-leave-to {
  opacity: 0;
}
</style>
