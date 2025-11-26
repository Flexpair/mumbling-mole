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

// ═══════════════════════════════════════════════════════════════════════════════
// Backward Compatibility Aliases
// These wrapper functions provide the same API as the old individual stores
// by delegating to the consolidated dialogStore.
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * @deprecated Use useDialogStore().connectDialog instead
 * Backward-compatible wrapper that delegates to the consolidated dialogStore
 */
export function useConnectionDialogStore() {
  const dialogStore = useDialogStore();
  
  // Pinia auto-unwraps refs in nested objects, so we access properties directly
  return {
    // State (getters/setters that delegate to dialogStore)
    get address() { return dialogStore.connectDialog.address; },
    set address(v) { dialogStore.connectDialog.address = v; },
    get port() { return dialogStore.connectDialog.port; },
    set port(v) { dialogStore.connectDialog.port = v; },
    get username() { return dialogStore.connectDialog.username; },
    set username(v) { dialogStore.connectDialog.username = v; },
    get password() { return dialogStore.connectDialog.password; },
    set password(v) { dialogStore.connectDialog.password = v; },
    get visible() { return dialogStore.connectDialog.visible; },
    set visible(v) { dialogStore.connectDialog.visible = v; },
    get isTestActive() { return dialogStore.connectDialog.isTestActive; },
    set isTestActive(v) { dialogStore.connectDialog.isTestActive = v; },
    
    // Actions (delegate to dialogStore actions)
    show: () => dialogStore.showConnectDialog(),
    hide: () => dialogStore.hideConnectDialog(),
    reset: () => dialogStore.resetConnectDialog(),
  };
}

/**
 * @deprecated Use useDialogStore().errorDialog instead
 * Backward-compatible wrapper that delegates to the consolidated dialogStore
 */
export function useConnectErrorDialogStore() {
  const dialogStore = useDialogStore();
  
  // Pinia auto-unwraps refs in nested objects, so we access properties directly
  return {
    get type() { return dialogStore.errorDialog.type; },
    set type(v) { dialogStore.errorDialog.type = v; },
    get reason() { return dialogStore.errorDialog.reason; },
    set reason(v) { dialogStore.errorDialog.reason = v; },
    get visible() { return dialogStore.errorDialog.visible; },
    set visible(v) { dialogStore.errorDialog.visible = v; },
    
    show: (error, connectionParams) => dialogStore.showErrorDialog(error, connectionParams),
    hide: () => dialogStore.hideErrorDialog(),
    reset: () => dialogStore.resetErrorDialog(),
  };
}

/**
 * @deprecated Use useDialogStore().infoDialog instead
 * Backward-compatible wrapper that delegates to the consolidated dialogStore
 */
export function useConnectionInfoStore() {
  const dialogStore = useDialogStore();
  
  // Pinia auto-unwraps refs in nested objects, so we access properties directly
  return {
    get visible() { return dialogStore.infoDialog.visible; },
    set visible(v) { dialogStore.infoDialog.visible = v; },
    get serverVersion() { return dialogStore.infoDialog.serverVersion; },
    set serverVersion(v) { dialogStore.infoDialog.serverVersion = v; },
    get latencyMs() { return dialogStore.infoDialog.latencyMs; },
    set latencyMs(v) { dialogStore.infoDialog.latencyMs = v; },
    get latencyDeviation() { return dialogStore.infoDialog.latencyDeviation; },
    set latencyDeviation(v) { dialogStore.infoDialog.latencyDeviation = v; },
    get remoteHost() { return dialogStore.infoDialog.remoteHost; },
    set remoteHost(v) { dialogStore.infoDialog.remoteHost = v; },
    get remotePort() { return dialogStore.infoDialog.remotePort; },
    set remotePort(v) { dialogStore.infoDialog.remotePort = v; },
    get maxBitrate() { return dialogStore.infoDialog.maxBitrate; },
    set maxBitrate(v) { dialogStore.infoDialog.maxBitrate = v; },
    get currentBitrate() { return dialogStore.infoDialog.currentBitrate; },
    set currentBitrate(v) { dialogStore.infoDialog.currentBitrate = v; },
    get maxBandwidth() { return dialogStore.infoDialog.maxBandwidth; },
    set maxBandwidth(v) { dialogStore.infoDialog.maxBandwidth = v; },
    get currentBandwidth() { return dialogStore.infoDialog.currentBandwidth; },
    set currentBandwidth(v) { dialogStore.infoDialog.currentBandwidth = v; },
    get codec() { return dialogStore.infoDialog.codec; },
    set codec(v) { dialogStore.infoDialog.codec = v; },
    
    show: () => dialogStore.showInfoDialog(),
    hide: () => dialogStore.hideInfoDialog(),
    reset: () => dialogStore.resetInfoDialog(),
  };
}

/**
 * @deprecated Use useDialogStore().sampleRateDialog instead
 * Backward-compatible wrapper that delegates to the consolidated dialogStore
 */
export function useSampleRateWarningDialogStore() {
  const dialogStore = useDialogStore();
  
  // Pinia auto-unwraps refs in nested objects, so we access properties directly
  return {
    get visible() { return dialogStore.sampleRateDialog.visible; },
    set visible(v) { dialogStore.sampleRateDialog.visible = v; },
    get mode() { return dialogStore.sampleRateDialog.mode; },
    set mode(v) { dialogStore.sampleRateDialog.mode = v; },
    get sampleRate() { return dialogStore.sampleRateDialog.sampleRate; },
    set sampleRate(v) { dialogStore.sampleRateDialog.sampleRate = v; },
    
    show: () => dialogStore.showSampleRateDialog(),
    hide: () => dialogStore.hideSampleRateDialog(),
    reset: () => dialogStore.resetSampleRateDialog(),
  };
}
