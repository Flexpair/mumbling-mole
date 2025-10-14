import ko from "knockout";

/**
 * Manages UI state including modals, dialogs, and selection
 */
export default class UIStateManager {
  constructor() {
    // Modal management - track currently open modal to prevent multiple modals
    this.currentOpenModal = ko.observable(null);
    this.selected = ko.observable();
    this.settingsDialog = ko.observable();
  }

  /**
   * Select an element
   */
  select(element) {
    this.selected(element);
  }

  /**
   * Open settings dialog
   */
  openSettings(SettingsDialog, settings) {
    // Prevent opening settings if another modal is already open
    if (this.currentOpenModal() !== null) {
      return;
    }
    this.settingsDialog(new SettingsDialog(settings));
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
    // Clear the modal state when settings dialog is closed
    if (this.currentOpenModal() === 'settings') {
      this.currentOpenModal(null);
    }
  }

  /**
   * Open source code
   */
  openSourceCode() {
    var homepage = require("../../package.json").homepage;
    window.open(homepage, "_blank").focus();
  }
}
