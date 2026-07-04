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
 * Start the Guacamole remote-desktop frame for an authorized user.
 * @param {string} guac_login
 * @param {string} password
 * @param {Object} uiStore
 */
export function startGuacamoleFrame(guac_login, password, uiStore) {
  if (uiStore.guacamoleFrame) {
    uiStore.guacamoleFrame.start(guac_login, password);
    uiStore.guacamoleFrame.show();
  }
}

/**
 * Notify the user that visual access is unavailable (no Guacamole role).
 */
export function notifyGuacamoleUnavailable() {
  alert('For visual access please ask your administrator.');
}
