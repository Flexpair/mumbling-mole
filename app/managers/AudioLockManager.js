import ko from "knockout";

/**
 * AudioLockManager - Manages audio lock state
 * Audio lock prevents audio transmission when sample rate is incompatible
 */
class AudioLockManager {
  constructor() {
    this.audioLockActive = ko.observable(false);
    this.audioLockReason = ko.observable(null);
    this.audioLockDetails = ko.observable(null);
  }

  /**
   * Activate audio lock with a reason and details
   * @param {string} reason - Reason for the lock (e.g., "sample-rate")
   * @param {Object} details - Additional details about the lock
   */
  activate(reason, details = {}) {
    this.audioLockReason(reason);
    this.audioLockDetails(details);
    this.audioLockActive(true);
  }

  /**
   * Clear audio lock
   * @param {Object} options
   * @param {boolean} options.resetStates - Whether to reset mute/deaf states
   */
  clear({ resetStates = false } = {}) {
    this.audioLockActive(false);
    this.audioLockReason(null);
    this.audioLockDetails(null);
    return resetStates; // Return this so caller can handle state reset
  }

  /**
   * Check if audio lock is active
   * @returns {boolean}
   */
  isActive() {
    return this.audioLockActive();
  }

  /**
   * Get audio lock details
   * @returns {Object}
   */
  getDetails() {
    return this.audioLockDetails() || {};
  }
}

export default AudioLockManager;
