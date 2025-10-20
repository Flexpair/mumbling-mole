import ko from "knockout";
import WorkerBasedMumbleConnector from "../worker-client";
import { translate } from "../localize";

/**
 * ConnectionState - manages Mumble server connection lifecycle
 * 
 * Responsibilities:
 * - WebSocket connection management via WorkerBasedMumbleConnector
 * - Remote host/port tracking
 * - Client instance lifecycle
 * - Connection state observables
 */
export default class ConnectionState {
  constructor(log) {
    this.log = log || console.log.bind(console);
    
    // Connection infrastructure
    this.connector = new WorkerBasedMumbleConnector();
    this.client = null;
    
    // Connection parameters
    this.remoteHost = ko.observable();
    this.remotePort = ko.observable();
  }

  /**
   * Check if currently connected to a Mumble server
   * @returns {boolean} true if connected
   */
  isConnected() {
    return this.client != null;
  }

  /**
   * Connect to Mumble server via WebSocket
   * @param {string} host - Server hostname
   * @param {string|number} port - Server port. Can be a number (e.g., 64738) or a string in the format "port/path" (e.g., "443/murmur" or "443/ws").
   * @param {string} username - Username
   * @param {string} password - Password
   * @param {Array} tokens - Access tokens
   * @returns {Promise<MumbleClient>} Connected client instance
   */
  async connect(host, port, username, password, tokens = []) {
    // Disconnect existing client before creating new connection
    if (this.client) {
      this.client.disconnect();
      this.client = null;
    }
    
    this.remoteHost(host);
    this.remotePort(port);

    this.log(translate("logentry.connecting"), host);

    try {
      // Parse port format: can be "443/murmur" (port + path) or just "64738" (port only)
      // For HTTPS (443) and HTTP (80), omit port from URL
      let wsUrl;
      const portStr = String(port);
      
      if (portStr.includes('/')) {
        // Format: "443/path" or "443/path/subpath" → wss://host/path or wss://host/path/subpath
        const slashIndex = portStr.indexOf('/');
        const portNum = portStr.substring(0, slashIndex);
        const path = portStr.substring(slashIndex + 1);
        const protocol = portNum === '443' ? 'wss' : 'ws';
        wsUrl = portNum === '443' || portNum === '80'
          ? `${protocol}://${host}/${path}`
          : `${protocol}://${host}:${portNum}/${path}`;
      } else {
        // Format: "64738" → wss://host:64738
        const protocol = portStr === '443' ? 'wss' : 'ws';
        wsUrl = portStr === '443' || portStr === '80'
          ? `${protocol}://${host}`
          : `${protocol}://${host}:${portStr}`;
      }

      const client = await this.connector.connect(wsUrl, {
        username: username,
        password: password,
        tokens: tokens,
      });

      this.log(translate("logentry.connected"));
      this.client = client;

      // Set up error handler
      client.on("error", (err) => {
        this.log(translate("logentry.connection_error"), err);
        this.resetClient();
      });

      return client;
    } catch (err) {
      this.log(translate("logentry.connection_error"), err);
      throw err;
    }
  }

  /**
   * Disconnect and reset client state
   */
  resetClient() {
    if (this.client) {
      this.client.disconnect();
    }
    this.client = null;
  }

  /**
   * Get current client instance
   * @returns {MumbleClient|null}
   */
  getClient() {
    return this.client;
  }

  /**
   * Set audio quality parameters on the client
   * @param {number} audioBitrate - Audio bitrate in bps
   * @param {number} samplesPerPacket - Samples per packet
   */
  setAudioQuality(audioBitrate, samplesPerPacket) {
    if (this.client) {
      this.client.setAudioQuality(audioBitrate, samplesPerPacket);
    }
  }

  /**
   * Set self mute state on the server
   * @param {boolean} muted - Mute state
   */
  setSelfMute(muted) {
    if (this.client) {
      this.client.setSelfMute(muted);
    }
  }

  /**
   * Set self deaf state on the server
   * @param {boolean} deafened - Deaf state
   */
  setSelfDeaf(deafened) {
    if (this.client) {
      this.client.setSelfDeaf(deafened);
    }
  }
}
