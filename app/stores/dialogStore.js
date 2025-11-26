import { defineStore } from 'pinia';
import { ref, reactive } from 'vue';

/**
 * Consolidated Dialog Store
 * 
 * Manages all dialog/modal states in a single store with namespaced sections.
 * Consolidates: connectionDialogStore, connectErrorDialogStore, 
 * connectionInfoStore, sampleRateWarningDialogStore
 * 
 * NOTE: Uses reactive() for nested objects to ensure refs remain refs internally,
 * while Pinia auto-unwraps them when accessed externally.
 */
export const useDialogStore = defineStore('dialog', () => {
  // ═══════════════════════════════════════════════════════════════════════════
  // Connection Dialog State
  // Using reactive() to maintain ref behavior internally while allowing
  // direct property access externally (Pinia auto-unwraps reactive objects)
  // ═══════════════════════════════════════════════════════════════════════════
  const connectDialog = reactive({
    address: '',
    port: '',
    username: '',
    password: '',
    visible: false,
    isTestActive: false,
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Connect Error Dialog State
  // Error types: 0=refused, 1=incompatible, 2=username rejected, 3=user pw wrong,
  // 4=server pw wrong, 5=username in use, 6=full, 7=NoCert, 8=refused alt
  // ═══════════════════════════════════════════════════════════════════════════
  const errorDialog = reactive({
    type: 0,
    reason: '',
    visible: false,
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Connection Info Dialog State (statistics modal)
  // ═══════════════════════════════════════════════════════════════════════════
  const infoDialog = reactive({
    visible: false,
    serverVersion: null,
    latencyMs: Number.NaN,
    latencyDeviation: Number.NaN,
    remoteHost: null,
    remotePort: null,
    maxBitrate: Number.NaN,
    currentBitrate: Number.NaN,
    maxBandwidth: Number.NaN,
    currentBandwidth: Number.NaN,
    codec: 'Unknown',
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Sample Rate Warning Dialog State
  // ═══════════════════════════════════════════════════════════════════════════
  const sampleRateDialog = reactive({
    visible: false,
    mode: 'confirm',
    sampleRate: null,
    connectionParams: null,
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Actions
  // With reactive() objects, we access properties directly (no .value needed)
  // ═══════════════════════════════════════════════════════════════════════════

  // Connect Dialog Actions
  function showConnectDialog() {
    connectDialog.visible = true;
  }

  function hideConnectDialog() {
    connectDialog.visible = false;
  }

  function resetConnectDialog() {
    connectDialog.address = '';
    connectDialog.port = '';
    connectDialog.username = '';
    connectDialog.password = '';
    connectDialog.visible = false;
    connectDialog.isTestActive = false;
  }

  // Error Dialog Actions
  function showErrorDialog(error, _connectionParams) {
    if (error) {
      errorDialog.type = error.type ?? 0;
      errorDialog.reason = error.reason ?? error.message ?? '';
    }
    errorDialog.visible = true;
  }

  function hideErrorDialog() {
    errorDialog.visible = false;
  }

  function resetErrorDialog() {
    errorDialog.type = 0;
    errorDialog.reason = '';
    errorDialog.visible = false;
  }

  // Info Dialog Actions
  function showInfoDialog() {
    infoDialog.visible = true;
  }

  function hideInfoDialog() {
    infoDialog.visible = false;
  }

  function resetInfoDialog() {
    infoDialog.visible = false;
    infoDialog.serverVersion = null;
    infoDialog.latencyMs = Number.NaN;
    infoDialog.latencyDeviation = Number.NaN;
    infoDialog.remoteHost = null;
    infoDialog.remotePort = null;
    infoDialog.maxBitrate = Number.NaN;
    infoDialog.currentBitrate = Number.NaN;
    infoDialog.maxBandwidth = Number.NaN;
    infoDialog.currentBandwidth = Number.NaN;
    infoDialog.codec = 'Unknown';
  }

  // Sample Rate Dialog Actions
  function showSampleRateDialog() {
    sampleRateDialog.visible = true;
  }

  function hideSampleRateDialog() {
    sampleRateDialog.visible = false;
  }

  function resetSampleRateDialog() {
    sampleRateDialog.visible = false;
    sampleRateDialog.mode = 'confirm';
    sampleRateDialog.sampleRate = null;
    sampleRateDialog.connectionParams = null;
  }

  // Global reset
  function resetAll() {
    resetConnectDialog();
    resetErrorDialog();
    resetInfoDialog();
    resetSampleRateDialog();
  }

  return {
    // Namespaced state objects
    connectDialog,
    errorDialog,
    infoDialog,
    sampleRateDialog,

    // Connect Dialog Actions
    showConnectDialog,
    hideConnectDialog,
    resetConnectDialog,

    // Error Dialog Actions
    showErrorDialog,
    hideErrorDialog,
    resetErrorDialog,

    // Info Dialog Actions
    showInfoDialog,
    hideInfoDialog,
    resetInfoDialog,

    // Sample Rate Dialog Actions
    showSampleRateDialog,
hideSampleRateDialog,
    resetSampleRateDialog,

    // Global
    resetAll,
  };
});
