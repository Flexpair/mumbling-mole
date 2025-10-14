import ko from "knockout";
import WorkerBasedMumbleConnector from "../worker-client";

/**
 * ConnectionManager - Manages Mumble client connection state
 * Handles connection, disconnection, and connection-related observables
 */
export class ConnectionManager {
  constructor() {
    this.connector = new WorkerBasedMumbleConnector();
    this.client = null;
    this.thisUser = ko.observable();
    this.root = ko.observable();
    this.remoteHost = ko.observable();
    this.remotePort = ko.observable();
  }
  
  /**
   * Check if currently connected
   */
  connected() {
    return this.thisUser() != null;
  }
  
  /**
   * Reset client connection
   */
  resetClient() {
    if (this.client) {
      this.client.disconnect();
    }
    this.client = null;
    this.thisUser(null);
    this.root(null);
  }
  
  /**
   * Get the Mumble client instance
   */
  getClient() {
    return this.client;
  }
  
  /**
   * Set the Mumble client instance
   */
  setClient(client) {
    this.client = client;
  }
}
