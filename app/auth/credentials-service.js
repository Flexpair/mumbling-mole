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

/**
 * Check if cache has expired
 * @returns {boolean}
 */
function isCacheExpired() {
  if (!cacheTimestamp) return true;
  return Date.now() - cacheTimestamp > CACHE_TTL_MS;
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
  if (cachedCredentials && !isCacheExpired() && !forceRefresh) {
    return cachedCredentials;
  }

  // Prevent concurrent requests
  if (pendingRequest !== null) {
    return pendingRequest;
  }

  pendingRequest = (async () => {
    try {
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
      cachedCredentials = credentials;
      cacheTimestamp = Date.now();
      return credentials;
    } finally {
      pendingRequest = null;
    }
  })();

  return pendingRequest;
}

/**
 * Clear cached credentials (e.g., on logout)
 */
export function clearCredentials() {
  cachedCredentials = null;
  cacheTimestamp = null;
  pendingRequest = null;
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
