/**
 * Register the provider error handler without changing dialog ownership.
 * Authentication and connection flows decide which dialog is visible.
 *
 * @param {{ on: Function }} auth - Authentication provider
 * @returns {Function} Registered error handler
 */
export function registerAuthErrorHandler(auth) {
  const handleAuthError = (error) => {
    console.warn('[Auth] Authentication error:', error);
  };

  auth.on('error', handleAuthError);
  return handleAuthError;
}