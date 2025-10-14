import ko from "knockout";

/**
 * UIStateManager - Manages UI state, dialogs, and modal tracking
 * Handles dialog visibility, modal state, selected items, and message box
 */
export class UIStateManager {
  constructor() {
    // Modal management - track currently open modal to prevent multiple modals
    this.currentOpenModal = ko.observable(null);
    
    // Selected channel/user
    this.selected = ko.observable();
    
    // Message box
    this.messageBox = ko.observable("");
    this.messageBoxHint = ko.observable();
    
    // Settings dialog
    this.settingsDialog = ko.observable();
  }
  
  /**
   * Select a channel or user
   */
  select(target) {
    this.selected(target);
  }
  
  /**
   * Clear message box
   */
  clearMessageBox() {
    this.messageBox("");
  }
  
  /**
   * Set message box hint
   */
  setMessageBoxHint(hint) {
    this.messageBoxHint(hint);
  }
}
