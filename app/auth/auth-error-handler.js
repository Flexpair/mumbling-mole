/**
 * Register the provider error handler that keeps failed login attempts inside
 * the authentication modal instead of handing control to the Connect dialog.
 *
 * @param {{ on: Function }} auth - Authentication provider
 * @param {{ connectDialog: { visible: boolean } }} dialogStore - Dialog state
 * @param {() => boolean} isWidgetHandlingToken - Whether a token flow owns UI
 * @returns {Function} Registered error handler
 */
export function registerAuthErrorHandler(auth, dialogStore, isWidgetHandlingToken = () => false) {
  const handleAuthError = (error) => {
    console.warn('[Auth] Authentication error:', error);
    if (!isWidgetHandlingToken()) {
      dialogStore.connectDialog.visible = false;
    }
  };

  auth.on('error', handleAuthError);
  return handleAuthError;
}