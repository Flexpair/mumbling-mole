const GUACAMOLE_AUTH_TOKEN_KEY = 'GUAC_AUTH_TOKEN';

/**
 * Remove Guacamole's persisted authentication token so it cannot be reused
 * across Flexpair authentication sessions.
 *
 * @param {Storage} [storage]
 */
export function clearGuacamoleSession(storage) {
  try {
    const sessionStorage = storage ?? globalThis.localStorage;
    sessionStorage?.removeItem(GUACAMOLE_AUTH_TOKEN_KEY);
  } catch (error) {
    console.warn('[Guacamole] Could not clear stored session:', error);
  }
}

/**
 * Build a Guacamole URL without allowing credential values to alter fragment
 * parameters.
 *
 * @param {string} username
 * @param {string} password
 * @returns {string}
 */
export function buildGuacamoleSource(username, password) {
  return '/guacamole/#/?username=' + encodeURIComponent(username || '') +
    '&password=' + encodeURIComponent(password || '');
}

/**
 * Start the independent Guacamole iframe for an authorized user.
 * @param {string} guac_login
 * @param {string} password
 * @param {Object} uiStore
 * @returns {boolean}
 */
export function startGuacamoleFrame(guac_login, password, uiStore) {
  if (!uiStore.guacamoleFrame) {
    console.warn('[Guacamole] Frame is not registered');
    return false;
  }

  uiStore.guacamoleFrame.start(guac_login, password);
  uiStore.guacamoleFrame.show();
  return true;
}
