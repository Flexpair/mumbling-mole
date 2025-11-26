import { defineStore } from 'pinia';
import { ref } from 'vue';

/**
 * Connection Info Store
 * 
 * Manages state for the connection statistics modal that shows
 * server version, latency, bandwidth, bitrate, and codec info.
 * Replaces the singleton composable useConnectionInfo.js
 */
export const useConnectionInfoStore = defineStore('connectionInfo', () => {
  const visible = ref(false);
  const serverVersion = ref(null);
  const latencyMs = ref(Number.NaN);
  const latencyDeviation = ref(Number.NaN);
  const remoteHost = ref(null);
  const remotePort = ref(null);
  const maxBitrate = ref(Number.NaN);
  const currentBitrate = ref(Number.NaN);
  const maxBandwidth = ref(Number.NaN);
  const currentBandwidth = ref(Number.NaN);
  const codec = ref('Unknown');

  // Actions
  function show() {
    visible.value = true;
  }

  function hide() {
    visible.value = false;
  }

  function reset() {
    visible.value = false;
    serverVersion.value = null;
    latencyMs.value = Number.NaN;
    latencyDeviation.value = Number.NaN;
    remoteHost.value = null;
    remotePort.value = null;
    maxBitrate.value = Number.NaN;
    currentBitrate.value = Number.NaN;
    maxBandwidth.value = Number.NaN;
    currentBandwidth.value = Number.NaN;
    codec.value = 'Unknown';
  }

  return {
    visible,
    serverVersion,
    latencyMs,
    latencyDeviation,
    remoteHost,
    remotePort,
    maxBitrate,
    currentBitrate,
    maxBandwidth,
    currentBandwidth,
    codec,
    show,
    hide,
    reset
  };
});
