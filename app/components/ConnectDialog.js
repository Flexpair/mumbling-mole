import ko from "knockout";

/**
 * ConnectDialog Component
 * 
 * Handles Mumble server connection UI and loopback test mode.
 * This is extracted as a separate module to prepare for Vue.js migration.
 * 
 * Features:
 * - Server connection form (address, port, username, password)
 * - Loopback test mode toggle
 * - Modal visibility management
 * - Integration with AppState for connection management
 * 
 * Vue Migration Notes:
 * - ko.observable() → ref()
 * - this.visible() → visible.value
 * - data-bind="visible: visible()" → v-show="visible"
 * - data-bind="value: username" → v-model="username"
 * - data-bind="click: connect" → @click="connect"
 */
export default class ConnectDialog {
  constructor(appState) {
    this.appState = appState;
    
    // Form fields
    this.address = ko.observable("");
    this.port = ko.observable("");
    this.username = ko.observable("");
    this.password = ko.observable("");
    
    // UI state
    this.visible = ko.observable(false);
    this.isTestActive = ko.observable(false);
  }

  /**
   * Show the connect dialog
   */
  show() {
    this.visible(true);
  }

  /**
   * Hide the connect dialog
   */
  hide() {
    this.visible(false);
  }

  /**
   * Connect to Mumble server or exit loopback mode
   */
  connect = () => {
    this.hide();
    
    // LOOPBACK-FEATURE: When already connected, this transitions from test mode back to normal mode
    if (this.appState.connected()) {
      // Switch from loopback test mode back to normal voice routing
      this.isTestActive(false);
      this.appState.voice.isLoopbackMode(false);
      
      // Recreate voice handler with normal target (not loopback target 31)
      this.appState._updateVoiceHandler();
      
      // GUACAMOLE-INTEGRATION: Show Guacamole desktop frame after exiting test mode
      // Uses stored credentials from initial connection
      if (this.appState._guacLogin) {
        this.appState.guacamoleFrame.loading(false);
        this.appState.guacamoleFrame.start(
          this.appState._guacLogin,
          this.appState._guacPassword
        );
        this.appState.guacamoleFrame.show();
      } else {
        this.appState.guacamoleFrame.loading(false);
      }
    } else {
      // Normal connection flow - not yet connected to server
      this.isTestActive(false);
      this.appState.connect(
        this.address(),
        this.port(),
        this.username(),
        this.password()
      );
    }
  };

  /**
   * Toggle loopback test mode
   * LOOPBACK-FEATURE: Toggle button handler - activates loopback test mode
   */
  toggleLoopback = async () => {
    // One-way activation: prevent deactivation via this button (use Connect button instead)
    if (this.isTestActive()) {
      return;
    }
    
    // USER-GESTURE: Ensure AudioContext is created and running SYNCHRONOUSLY in click handler
    // This must happen before any async operations that might lose the user gesture context
    try {
      // Mark user interaction for audio-context-manager
      if (this.appState.audio?.audioContextManager) {
        this.appState.audio.audioContextManager.userInteractionDetected = true;
      }
      
      // Create AudioContext if not exists
      if (!this.appState.audio?.audioContext) {
        console.log('[LOOPBACK] Creating AudioContext on user click');
        await this.appState.audio.initializeAudioContext();
      }
      
      // Resume if suspended
      if (this.appState.audio?.audioContext?.state === 'suspended') {
        console.log('[LOOPBACK] Resuming AudioContext on user click');
        await this.appState.audio.audioContext.resume();
      }
      
      console.log('[LOOPBACK] AudioContext ready:', this.appState.audio.audioContext.state);
    } catch (err) {
      console.error('[LOOPBACK] Failed to prepare AudioContext on click:', err);
    }
    
    // Mark test as active and connect in loopback mode
    this.isTestActive(true);
    
    // MODAL-BEHAVIOR: Keep dialog open during loopback test (don't call this.hide())
    // This allows user to see connection status and switch back to normal mode
    this.appState.connectLoopback(
      this.address(),
      this.port(),
      this.username(),
      this.password()
    );
  };

  /**
   * Connect in loopback mode (legacy compatibility)
   */
  connectLoopback = () => {
    this.hide();
    this.appState.connectLoopback(
      this.address(),
      this.port(),
      this.username(),
      this.password()
    );
  };
}
