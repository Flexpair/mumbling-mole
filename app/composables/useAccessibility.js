/**
 * Accessibility Composable
 * 
 * Provides screen reader announcements and keyboard navigation utilities.
 * Uses the global live region (#a11y-announcer) defined in index.html.
 */

import { ref } from 'vue';

/**
 * Announce a message to screen readers via ARIA live region
 * @param {string} message - Message to announce
 * @param {('polite'|'assertive')} priority - Announcement priority
 */
export function announceToScreenReader(message, priority = 'polite') {
  const announcer = document.getElementById('a11y-announcer');
  if (!announcer) {
    console.warn('[A11y] Announcer element not found');
    return;
  }
  
  // Set priority if different from default
  if (priority === 'assertive') {
    announcer.setAttribute('aria-live', 'assertive');
  }
  
  announcer.textContent = message;
  
  // Reset after announcement
  setTimeout(() => {
    announcer.textContent = '';
    announcer.setAttribute('aria-live', 'polite');
  }, 1000);
}

/**
 * Composable for focus trap within a container
 * Useful for modal dialogs
 */
export function useFocusTrap() {
  const containerRef = ref(null);
  let previouslyFocusedElement = null;
  
  const getFocusableElements = () => {
    if (!containerRef.value) return [];
    return Array.from(
      containerRef.value.querySelectorAll(
        'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"]):not([disabled]), [role="button"]:not([disabled]), [role="link"], summary, audio[controls], video[controls], details'
      )
    ).filter(el => el.offsetParent !== null); // Only visible elements
  };
  
  const handleKeydown = (event) => {
    if (event.key !== 'Tab') return;
    
    const focusable = getFocusableElements();
    if (focusable.length === 0) return;
    
    const firstElement = focusable[0];
    const lastElement = focusable.at(-1);
    
    if (event.shiftKey && document.activeElement === firstElement) {
      event.preventDefault();
      lastElement.focus();
    } else if (!event.shiftKey && document.activeElement === lastElement) {
      event.preventDefault();
      firstElement.focus();
    }
  };
  
  const activate = () => {
    previouslyFocusedElement = document.activeElement;
    
    if (containerRef.value) {
      containerRef.value.addEventListener('keydown', handleKeydown);
      
      // Focus first focusable element
      const focusable = getFocusableElements();
      if (focusable.length > 0) {
        focusable[0].focus();
      }
    }
  };
  
  const deactivate = () => {
    if (containerRef.value) {
      containerRef.value.removeEventListener('keydown', handleKeydown);
    }
    
    // Restore focus to previously focused element
    previouslyFocusedElement?.focus();
  };
  
  return {
    containerRef,
    activate,
    deactivate
  };
}

/**
 * Composable for roving tabindex pattern
 * Useful for toolbar, menu, and tab list navigation
 */
export function useRovingTabindex(items, options = {}) {
  const { 
    orientation = 'horizontal',
    loop = true 
  } = options;
  
  const currentIndex = ref(0);
  
  const handleKeydown = (event, index) => {
    const isHorizontal = orientation === 'horizontal';
    const prevKey = isHorizontal ? 'ArrowLeft' : 'ArrowUp';
    const nextKey = isHorizontal ? 'ArrowRight' : 'ArrowDown';
    
    let newIndex;
    
    switch (event.key) {
      case prevKey:
        event.preventDefault();
        newIndex = loop 
          ? (index - 1 + items.value.length) % items.value.length
          : Math.max(0, index - 1);
        break;
      case nextKey:
        event.preventDefault();
        newIndex = loop
          ? (index + 1) % items.value.length
          : Math.min(items.value.length - 1, index + 1);
        break;
      case 'Home':
        event.preventDefault();
        newIndex = 0;
        break;
      case 'End':
        event.preventDefault();
        newIndex = items.value.length - 1;
        break;
      default:
        return;
    }
    
    currentIndex.value = newIndex;
    return newIndex;
  };
  
  const getTabindex = (index) => {
    return index === currentIndex.value ? 0 : -1;
  };
  
  return {
    currentIndex,
    handleKeydown,
    getTabindex
  };
}

export default {
  announceToScreenReader,
  useFocusTrap,
  useRovingTabindex
};
