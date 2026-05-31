/**
 * Determine Guacamole login role from user roles
 * @param {Array} roles - User roles array
 * @returns {string|false} - 'admin', 'editor', 'watcher', or false
 */
export function getGuacamoleLogin(roles = []) {
  if (roles.includes('admin')) return 'admin';
  if (roles.includes('edit')) return 'editor';
  if (roles.includes('watch')) return 'watcher';
  return false;
}

/**
 * Get Guacamole credentials from server or legacy fallback
 * @param {Object} serverCredentials
 * @param {string} password
 * @param {Object} auth
 * @returns {Object} {user, password}
 */
export function getGuacamoleCredentials(serverCredentials, password, auth) {
  const roles = auth?.currentUser()?.app_metadata?.roles || [];
  return {
    user: serverCredentials?.guacamoleUser || getGuacamoleLogin(roles),
    password: serverCredentials?.guacamolePassword || password
  };
}

/**
 * Setup Guacamole frame if needed
 * @param {string|false} guac_login
 * @param {string} password
 * @param {boolean} isLoopbackMode
 * @param {Object} uiStore
 */
export function setupGuacamoleFrame(guac_login, password, isLoopbackMode, uiStore) {
  if (guac_login && !isLoopbackMode) {
    if (uiStore.guacamoleFrame) {
      uiStore.guacamoleFrame.start(guac_login, password);
      uiStore.guacamoleFrame.show();
    }
  } else if (!guac_login && !isLoopbackMode) {
    alert('For visual access please ask your administrator.');
  }
}
