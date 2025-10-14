import ko from "knockout";

/**
 * UIState - manages UI-specific state and modal management
 * 
 * Responsibilities:
 * - Selected channel/user tracking
 * - Message box state
 * - Modal management (prevent multiple modals)
 * - Settings dialog state
 */
export default class UIState {
  constructor() {
    // Modal management - track currently open modal
    this.currentOpenModal = ko.observable(null);
    
    // Selection state
    this.selected = ko.observable();
    
    // Message box
    this.messageBox = ko.observable("");
    
    // Settings dialog
    this.settingsDialog = ko.observable();
  }

  /**
   * Select a channel or user
   * @param {object} element - Channel or user UI object
   */
  select(element) {
    this.selected(element);
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
   * @param {object} selectedTarget - Selected channel/user target
   */
  submitMessageBox(sendMessageFn, selectedTarget) {
    sendMessageFn(selectedTarget, this.messageBox());
    this.messageBox("");
  }

  /**
   * Reset UI state
   */
  reset() {
    this.selected(null);
    this.messageBox("");
    this.settingsDialog(null);
    this.currentOpenModal(null);
  }
}
