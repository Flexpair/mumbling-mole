/**
 * ConnectionManager - Manages Mumble client connection lifecycle
 * Responsibilities:
 * - Client connection and disconnection
 * - Loopback mode management
 * - Voice handler lifecycle
 */
export class ConnectionManager {
  constructor(context) {
    // Store references to GlobalBindings context
    this.client = null;
    this.connector = context.connector;
    this.settings = context.settings;
    this.isLoopbackMode = context.isLoopbackMode;
    this.thisUser = context.thisUser;
    this.root = context.root;
    this.selected = context.selected;
    this.beeperReady = context.beeperReady;
    this.voiceHandlerReady = context.voiceHandlerReady;
    this.audioLockActive = context.audioLockActive;
    this.selfMute = context.selfMute;
    
    // Callback references (to be set by GlobalBindings)
    this.onStopBeep = null;
  }

  /**
   * Get current client instance
   */
  getClient() {
    return this.client;
  }

  /**
   * Set client instance
   */
  setClient(client) {
    this.client = client;
  }

  /**
   * Check if connected to server
   */
  isConnected() {
    return this.thisUser() != null;
  }

  /**
   * Reset client connection
   * @param {Function} stopBeep - Callback to stop beep tone
   */
  resetClient(stopBeep) {
    if (stopBeep) {
      stopBeep();
    }
    
    if (this.client) {
      this.client.disconnect();
    }
    
    this.client = null;
    this.selected(null);
    this.root(null);
    this.thisUser(null);
    this.isLoopbackMode(false);
    this.beeperReady(false);
    this.voiceHandlerReady(false);
  }
}
