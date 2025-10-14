import ko from "knockout";

/**
 * ModalManager - Manages the state of currently open modals
 * Ensures only one modal is open at a time
 */
class ModalManager {
  constructor() {
    this.currentOpenModal = ko.observable(null);
  }

  /**
   * Check if a modal is currently open
   * @returns {boolean}
   */
  isModalOpen() {
    return this.currentOpenModal() !== null;
  }

  /**
   * Open a modal if no other modal is currently open
   * @param {string} modalName - Name of the modal to open
   * @returns {boolean} - true if modal was opened, false if another modal is already open
   */
  openModal(modalName) {
    if (this.isModalOpen()) {
      return false;
    }
    this.currentOpenModal(modalName);
    return true;
  }

  /**
   * Close a modal if it's currently open
   * @param {string} modalName - Name of the modal to close
   */
  closeModal(modalName) {
    if (this.currentOpenModal() === modalName) {
      this.currentOpenModal(null);
    }
  }

  /**
   * Close any currently open modal
   */
  closeAnyModal() {
    this.currentOpenModal(null);
  }
}

export default ModalManager;
