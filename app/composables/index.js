/**
 * Composables Index
 * 
 * Central export point for all Vue composables.
 * These replace Knockout state modules with Vue reactive primitives.
 */

// State composables (core application state)
// Note: Core state is now managed directly via Pinia stores in app/stores/
export { useConnectionDialog } from './useConnectionDialog.js';
export { useConnectErrorDialog } from './useConnectErrorDialog.js';
export { useSampleRateWarningDialog } from './useSampleRateWarningDialog.js';
export { useConnectionInfo } from './useConnectionInfo.js';
export { useSettings } from './useSettings.js';

// Utility composables (reusable UI helpers)
export { useLocalStorage } from './useLocalStorage.js';
export { vTooltip } from './useTooltip.js';
export { useClipboard } from './useClipboard.js';
