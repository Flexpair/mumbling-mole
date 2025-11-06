import ko from "knockout";

/**
 * ChannelState - manages minimal channel protocol support
 * 
 * Responsibilities:
 * - Root channel tracking (for messageBoxHint check)
 * - Minimal channel.__ui wrapper (protocol objects have channel.users array)
 * 
 * NOTE: No UI rendering of channel tree - app displays single-channel mode.
 * Channel protocol objects (mumble-client/channel.js) maintain channel.users array.
 * UI only needs to check if target has .users property to distinguish channel from user.
 */
export default class ChannelState {
  constructor() {
    // Root channel - needed for messageBoxHint default target
    this.root = ko.observable();
  }

  /**
   * Register a channel with minimal UI wrapper
   * Only creates channel.__ui with model and name for protocol compatibility.
   * No tree observables, event handlers, or UI-specific properties.
   * 
   * @param {object} channel - Channel model from mumble-client
   */
  registerChannel(channel) {
    // Skip if UI already initialized
    if (channel.__ui) {
      return;
    }
    
    // Minimal wrapper: only model and name observable
    // Protocol channel.users array exists on model (not copied to __ui)
    channel.__ui = {
      model: channel,
      name: ko.observable(channel.name),
    };
  }

  /**
   * Reset channel state
   */
  reset() {
    this.root(null);
  }
}
