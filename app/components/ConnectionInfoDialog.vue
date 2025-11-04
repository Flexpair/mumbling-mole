<template>
  <div class="connection-info-dialog dialog" v-show="visible">
    <div id="connection-info_title" class="dialog-header">
      Audio transmission info
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

      <h3 id="connection-info_webapp">Statistics for this web app</h3>
      <template v-if="currentBandwidth && currentBitrate && !Number.isNaN(currentBandwidth) && !Number.isNaN(currentBitrate)">
        Sending
        {{ (currentBandwidth / 1000).toFixed(1) }}
        kbits/s (<span>{{ (currentBitrate / 1000).toFixed(1) }}</span>
        kbits/s payload)
        <br />
      </template>
      <template v-else>
        Sending: Unknown
        <br />
      </template>
      <template v-if="latencyMs && !Number.isNaN(latencyMs)">
        <strong>Network latency (TCP ping):</strong>
        {{ latencyMs.toFixed(2) }} ms average
        ({{ latencyDeviation.toFixed(2) }} ms deviation)
        <br />
        <small style="color: #666; font-style: italic;">
          Note: Voice latency is typically 35-80ms higher due to audio encoding/decoding and buffering.
          Use the Piano test button to measure end-to-end audio latency.
        </small>
      </template>
      <template v-else>
        <strong>Network latency (TCP ping):</strong> Unknown
      </template>

      <h3 id="connection-info_native">Desktop client / mobile app</h3>
      <a href="https://www.mumble.info/downloads/" target="_blank"
        >Offical download page</a
      >
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
</template>

<script setup>
import { ref, inject, onMounted, onUnmounted, watch } from 'vue';
import MumbleClient from '../mumble-client/index.js';

/**
 * Vue 3 ConnectionInfoDialog Component (DUAL RUNTIME)
 * 
 * Displays connection statistics and server information.
 * Integrates with existing Knockout AppState via provide/inject.
 */

// Inject AppState (from main app)
const appState = inject('appState');

// Local reactive state
const visible = ref(false);
const serverVersion = ref(null);
const latencyMs = ref(Number.NaN);
const latencyDeviation = ref(Number.NaN);
const remoteHost = ref('');
const remotePort = ref('');
const maxBitrate = ref(Number.NaN);
const currentBitrate = ref(Number.NaN);
const maxBandwidth = ref(Number.NaN);
const currentBandwidth = ref(Number.NaN);
const codec = ref('Unknown');

// Track subscription for cleanup
let visibleSubscription = null;

// Sync with Knockout observable
onMounted(() => {
  if (appState?.connectionInfo) {
    // Initialize from Knockout state
    visible.value = appState.connectionInfo.visible();
    
    // Subscribe to Knockout visible changes
    visibleSubscription = appState.connectionInfo.visible.subscribe((val) => {
      visible.value = val;
      if (val) {
        // Update stats when dialog becomes visible
        updateStats();
      }
    });
  }
});

// Cleanup subscription
onUnmounted(() => {
  if (visibleSubscription) {
    visibleSubscription.dispose();
  }
});

// Sync Vue visible changes back to Knockout
watch(visible, (val) => {
  if (appState?.connectionInfo) {
    appState.connectionInfo.visible(val);
  }
});

/**
 * Update connection statistics from client
 */
function updateStats() {
  const client = appState?.client;
  
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
    // Not connected
    serverVersion.value = null;
    latencyMs.value = Number.NaN;
    latencyDeviation.value = Number.NaN;
  }
  
  remoteHost.value = appState?.remoteHost() || '';
  remotePort.value = appState?.remotePort() || '';
  
  const spp = appState?.settings?.samplesPerPacket;
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
    
    maxBitrate.value = maxBitrateValue;
    currentBitrate.value = actualBitrate;
    maxBandwidth.value = maxBandwidthValue;
    currentBandwidth.value = actualBandwidth;
    codec.value = "Opus"; // only one supported for sending
  } else {
    // Not connected or no settings
    maxBitrate.value = Number.NaN;
    currentBitrate.value = Number.NaN;
    maxBandwidth.value = Number.NaN;
    currentBandwidth.value = Number.NaN;
    codec.value = "Unknown";
  }
}

/**
 * Handle hide button click
 */
function handleHide() {
  visible.value = false;
  
  // Clear modal state in Knockout
  if (appState?.ui?.currentOpenModal() === 'connectionInfo') {
    appState.ui.currentOpenModal(null);
  }
}
</script>

<style scoped>
/* Component-specific styles if needed */
</style>
