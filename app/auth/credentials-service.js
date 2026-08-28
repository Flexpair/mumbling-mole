/**
 * Credentials Service
 * 
 * Fetches server credentials (Mumble password, Guacamole user) from the auth server
 * after successful authentication. Credentials are only available after JWT validation.
 * 
 * @module credentials-service
 */

/**
 * @typedef {Object} ServerCredentials
 * @property {string} mumblePassword - Password for Mumble server
 * @property {string} guacamoleUser - Guacamole username (admin/editor/watcher)
 * @property {string} guacamolePassword - Guacamole password
 */

/**
 * Cached credentials to avoid repeated API calls
 * @type {ServerCredentials|null}
 */
let cachedCredentials = null;

/**
 * Token associated with the cached credentials. Credentials must not be
 * reused across authenticated sessions.
 * @type {string|null}
 */
let cachedToken = null;

/**
 * Cache timestamp for TTL-based invalidation
 * @type {number|null}
 */
let cacheTimestamp = null;

/**
 * Cache TTL in milliseconds (5 minutes default - matches typical JWT refresh)
 */
const CACHE_TTL_MS = 5 * 60 * 1000;

/**
 * Pending request to prevent concurrent fetches
 * @type {Promise<ServerCredentials>|null}
 */
let pendingRequest = null;
/** @type {string|null} */
let pendingToken = null;
let requestGeneration = 0;

class SupersededCredentialsRequestError extends Error {
  constructor() {
    super('Credentials request superseded by a newer authentication session');
    this.name = 'SupersededCredentialsRequestError';
    this.code = 'CREDENTIALS_REQUEST_SUPERSEDED';
  }
}

/**
 * Check if cache has expired
 * @returns {boolean}
 */
function isCacheExpired() {
  if (!cacheTimestamp) return true;
  return Date.now() - cacheTimestamp > CACHE_TTL_MS;
}

/**
 * Internal function to fetch credentials from server
 * @private
 */
async function _fetchCredentialsFromServer(token) {
  const response = await fetch('/api/credentials', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    }
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error || `Failed to fetch credentials: ${response.status}`);
  }

  const credentials = await response.json();
  const requiredFields = ['mumblePassword', 'guacamoleUser', 'guacamolePassword'];
  if (!credentials || requiredFields.some(field => typeof credentials[field] !== 'string' || !credentials[field])) {
    throw new Error('Credentials response is incomplete');
  }
  return credentials;
}

/**
 * Fetch server credentials from auth endpoint
 * Requires valid JWT token from auth provider
 * 
 * @param {string} token - JWT access token
 * @param {Object} options - Optional configuration
 * @param {boolean} options.forceRefresh - Bypass cache and fetch fresh credentials
 * @returns {Promise<ServerCredentials>}
 * @throws {Error} If token is invalid or server unreachable
 */
export async function fetchCredentials(token, { forceRefresh = false } = {}) {
  if (!token) {
    throw new Error('No authentication token provided');
  }

  // Return cached credentials if available, not expired, and not forcing refresh
  if (cachedCredentials && cachedToken === token && !isCacheExpired() && !forceRefresh) {
    return cachedCredentials;
  }

  // Prevent concurrent requests
  if (pendingRequest !== null && pendingToken === token) {
    return pendingRequest;
  }

  // A different authenticated session must not await the previous session's
  // request. Invalidate its result so its caller cannot continue with stale
  // Mumble or Guacamole credentials.
  if (pendingRequest !== null && pendingToken !== token) {
    requestGeneration += 1;
  }

  const requestToken = token;
  const requestGenerationAtStart = requestGeneration;

  const request = _fetchCredentialsFromServer(requestToken)
    .then(result => {
      if (requestGenerationAtStart !== requestGeneration || pendingRequest !== request) {
        throw new SupersededCredentialsRequestError();
      }

      cachedCredentials = result;
      cachedToken = requestToken;
      cacheTimestamp = Date.now();
      pendingRequest = null;
      pendingToken = null;
      return result;
    })
    .catch(error => {
      const superseded = requestGenerationAtStart !== requestGeneration || pendingRequest !== request;
      if (pendingRequest === request) {
        pendingRequest = null;
        pendingToken = null;
      }
      if (superseded && error?.code !== 'CREDENTIALS_REQUEST_SUPERSEDED') {
        throw new SupersededCredentialsRequestError();
      }
      throw error;
    });

  pendingRequest = request;
  pendingToken = requestToken;
  return request;
}

/**
 * Clear cached credentials (e.g., on logout)
 */
export function clearCredentials() {
  requestGeneration += 1;
  cachedCredentials = null;
  cachedToken = null;
  cacheTimestamp = null;
  pendingRequest = null;
  pendingToken = null;
}

/**
 * Check if credentials are cached and not expired
 * @returns {boolean}
 */
export function hasCredentials() {
  return cachedCredentials !== null && !isCacheExpired();
}

/**
 * Get cached credentials without fetching
 * @returns {ServerCredentials|null}
 */
export function getCachedCredentials() {
  return cachedCredentials;
}

export default {
  fetchCredentials,
  clearCredentials,
  hasCredentials,
  getCachedCredentials
};
