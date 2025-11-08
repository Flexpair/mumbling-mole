/**
 * Utilities for managing microphone permission requests
 * Prevents duplication of permission logic between Knockout and Vue implementations
 */

/**
 * Creates a microphone permission manager with retry logic
 * 
 * @param {object} config - Configuration object
 * @param {Function} config.onGranted - Callback when permission is granted
 * @param {Function} config.onDenied - Callback when permission is denied with error message
 * @param {number} config.maxRetryCount - Maximum number of automatic retries (default: 3)
 * @param {number} config.retryDelayMs - Delay between retries in milliseconds (default: 1000)
 * @returns {object} Manager with attemptPermission and retryPermission methods
 * 
 * @example
 * const permManager = createMicrophonePermissionManager({
 *   onGranted: () => {
 *     micPermissionDenied.value = false;
 *     micPermissionErrorMessage.value = '';
 *   },
 *   onDenied: (errorMessage) => {
 *     micPermissionErrorMessage.value = errorMessage;
 *   },
 *   maxRetryCount: 3,
 *   retryDelayMs: 1000
 * });
 * 
 * // Attempt permission request
 * permManager.attemptPermission();
 * 
 * // Reset and retry after user fixes browser settings
 * permManager.retryPermission();
 */
export function createMicrophonePermissionManager({
  onGranted,
  onDenied,
  maxRetryCount = 3,
  retryDelayMs = 1000
}) {
  let retryCount = 0;

  /**
   * Attempt to get microphone permission
   * Automatically retries on non-permission errors (e.g., temporary device issues)
   */
  function attemptPermission() {
    if (!navigator.mediaDevices?.getUserMedia) {
      return;
    }

    navigator.mediaDevices
      .getUserMedia({ audio: true })
      .then((stream) => {
        // Permission granted - reset state and stop all tracks
        retryCount = 0;
        onGranted();
        
        for (const track of stream.getTracks()) {
          track.stop();
        }
      })
      .catch((err) => {
        console.error('Microphone permission denied on retry:', err);
        retryCount += 1;
        
        // Detect permission-specific errors
        const isPermissionBlocked =
          err &&
          (err.name === 'NotAllowedError' ||
            err.name === 'SecurityError' ||
            (typeof err.message === 'string' &&
              err.message.toLowerCase().includes('denied')));

        if (isPermissionBlocked) {
          onDenied(
            'Microphone access is blocked by the browser. Please allow it in the address bar or system settings, then try again.'
          );
        }

        // Stop automatic retries if max reached or permission blocked
        if (retryCount >= maxRetryCount) {
          return;
        }
        if (isPermissionBlocked) {
          return;
        }
        
        // Retry for temporary errors (e.g., device busy)
        setTimeout(() => attemptPermission(), retryDelayMs);
      });
  }

  /**
   * Reset retry count and attempt permission request again
   * Called when user manually clicks "Retry" button
   */
  function retryPermission() {
    retryCount = 0;
    onGranted(); // Clear error message
    attemptPermission();
  }

  /**
   * Get current retry count (for debugging/testing)
   */
  function getRetryCount() {
    return retryCount;
  }

  return {
    attemptPermission,
    retryPermission,
    getRetryCount
  };
}
