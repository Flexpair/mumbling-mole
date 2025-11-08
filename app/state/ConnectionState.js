import ko from "knockout";
import WorkerBasedMumbleConnector from "../worker-client";
import { translate } from "../localize";
import { buildWebSocketUrl } from "../utils/websocket-url";

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
      const wsUrl = buildWebSocketUrl(host, port);

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
