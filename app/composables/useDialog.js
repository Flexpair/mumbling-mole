/**
 * useDialog - Vue Composable for Dialog Management
 * 
 * Provides reactive dialog state management with native <dialog> element integration.
 * Handles open/close, backdrop clicks, ESC key, and lifecycle management.
 * 
 * @example
 * const { visible, dialogRef, show, hide } = useDialog();
 * 
 * <dialog ref="dialogRef">
 *   <button @click="hide">Close</button>
 * </dialog>
 */

import { ref, watch, nextTick, onBeforeUnmount } from 'vue';

export function useDialog(options = {}) {
  const {
    onShow = null,
    onHide = null,
    closeOnBackdrop = true,
    closeOnEsc = true
  } = options;

  /** @type {import('vue').Ref<boolean>} */
  const visible = ref(false);
  
  /** @type {import('vue').Ref<HTMLDialogElement | null>} */
  const dialogRef = ref(null);

  /**
   * Show the dialog
   */
  async function show() {
    visible.value = true;
    await nextTick();
    
    if (dialogRef.value && !dialogRef.value.open) {
      dialogRef.value.showModal();
      if (onShow) onShow();
    }
  }

  /**
   * Hide the dialog
   */
  function hide() {
    visible.value = false;
    
    if (dialogRef.value?.open) {
      dialogRef.value.close();
      if (onHide) onHide();
    }
  }

  /**
   * Handle backdrop click (close on click outside)
   */
  function handleBackdropClick(event) {
    if (!closeOnBackdrop) return;
    
    const dialog = dialogRef.value;
    if (!dialog) return;

    // Check if click was on ::backdrop (outside dialog)
    const rect = dialog.getBoundingClientRect();
    const clickedOutside =
      event.clientX < rect.left ||
      event.clientX > rect.right ||
      event.clientY < rect.top ||
      event.clientY > rect.bottom;

    if (clickedOutside) {
      hide();
    }
  }

  /**
   * Handle ESC key press
   */
  function handleCancel(event) {
    if (closeOnEsc) {
      event.preventDefault(); // Prevent default ESC behavior
      hide();
    }
  }

  // Watch visible and sync with native dialog
  watch(visible, async (val) => {
    if (!dialogRef.value) return;
    await nextTick();
    
    if (val && !dialogRef.value.open) {
      dialogRef.value.showModal();
    } else if (!val && dialogRef.value.open) {
      dialogRef.value.close();
    }
  });

  // Cleanup on unmount
  onBeforeUnmount(() => {
    if (dialogRef.value?.open) {
      dialogRef.value.close();
    }
  });

  return {
    visible,
    dialogRef,
    show,
    hide,
    handleBackdropClick,
    handleCancel
  };
}
