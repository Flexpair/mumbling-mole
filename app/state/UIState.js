import ko from "knockout";

/**
 * UIState - manages UI-specific state and modal management
 * 
 * Responsibilities:
 * - Message box state
 * - Modal management (prevent multiple modals)
 * - Settings dialog state
 * 
 * NOTE: Selection state removed - no UI for selecting channels/users.
 * All messages go to current channel (thisUser().channel()).
 */
export default class UIState {
  constructor() {
    // Modal management - track currently open modal
    this.currentOpenModal = ko.observable(null);
    
    // Message box
    this.messageBox = ko.observable("");
    
    // Settings dialog
    this.settingsDialog = ko.observable();
  }

  /**
   * Open settings dialog
   * @param {object} settings - Settings instance
   * @param {Function} SettingsDialogClass - Settings dialog constructor
   */
  openSettings(settings, SettingsDialogClass) {
    // Prevent opening if another modal is already open
    if (this.currentOpenModal() !== null) {
      return;
    }
    this.settingsDialog(new SettingsDialogClass(settings));
    this.currentOpenModal('settings');
  }

  /**
   * Close settings dialog
   */
  closeSettings() {
    if (this.settingsDialog()) {
      this.settingsDialog().end();
    }
    this.settingsDialog(null);
    
    // Clear the modal state
    if (this.currentOpenModal() === 'settings') {
      this.currentOpenModal(null);
    }
  }

  /**
   * Submit message box content
   * @param {Function} sendMessageFn - Function to send the message
   * @param {object} target - Target channel/user for the message
   */
  submitMessageBox(sendMessageFn, target) {
    sendMessageFn(target, this.messageBox());
    this.messageBox("");
  }

  /**
   * Reset UI state
   */
  reset() {
    this.messageBox("");
    this.settingsDialog(null);
    this.currentOpenModal(null);
  }
}
