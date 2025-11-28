/**
 * Composables Index
 * 
 * Central export point for all Vue composables.
 * These are reusable UI utilities, NOT global state.
 * 
 * NOTE: All state is now managed by Pinia stores in app/stores/:
 * - useSettingsStore (audio settings, persisted to localStorage)
 * - useConnectionStore, useAudioStore, useVoiceStore, etc.
 * - Dialog stores: connectionDialogStore, connectErrorDialogStore, etc.
 */

// Utility composables (reusable UI helpers)
export { useLocalStorage } from './useLocalStorage.js';
export { vTooltip } from './useTooltip.js';
export { useClipboard } from './useClipboard.js';

// Accessibility composables
export { 
  announceToScreenReader, 
  useFocusTrap, 
  useRovingTabindex 
} from './useAccessibility.js';
