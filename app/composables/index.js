/**
 * Composables Index
 * 
 * Central export point for all Vue composables.
 * These replace Knockout state modules with Vue reactive primitives.
 * 
 * NOTE: Many composables have been migrated to Pinia stores in app/stores/:
 * - useConnectionDialog → useConnectionDialogStore
 * - useConnectErrorDialog → useConnectErrorDialogStore
 * - useConnectionInfo → useConnectionInfoStore
 */

// State composables (remaining non-store state)
export { useSampleRateWarningDialog } from './useSampleRateWarningDialog.js';
export { useSettings } from './useSettings.js';

// Utility composables (reusable UI helpers)
export { useLocalStorage } from './useLocalStorage.js';
export { vTooltip } from './useTooltip.js';
export { useClipboard } from './useClipboard.js';
