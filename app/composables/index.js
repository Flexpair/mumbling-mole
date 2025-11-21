/**
 * Composables Index
 * 
 * Central export point for all Vue composables.
 * These replace Knockout state modules with Vue reactive primitives.
 */

// State composables (core application state)
export { useConnectionState } from './useConnectionState';
export { useAudioState } from './useAudioState';
export { useVoiceState } from './useVoiceState';
export { useUIState } from './useUIState';
export { useUserState } from './useUserState';
export { useConnectionDialog } from './useConnectionDialog.js';
export { useConnectErrorDialog } from './useConnectErrorDialog.js';
export { useSampleRateWarningDialog } from './useSampleRateWarningDialog.js';
export { useConnectionInfo } from './useConnectionInfo.js';
export { useSettings } from './useSettings.js';

// Utility composables (reusable UI helpers)
export { useLocalStorage } from './useLocalStorage.js';
export { vTooltip } from './useTooltip.js';
export { useClipboard } from './useClipboard.js';
