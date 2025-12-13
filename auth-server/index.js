/**
 * Auth Server for Mumble Web Client
 * 
 * Validates Netlify Identity JWT tokens and returns server credentials.
 * Credentials are only distributed after successful authentication.
 * 
 * Supports multiple auth providers (Netlify, Supabase, Auth0) via config.
 */

import express from 'express';
import crypto from 'crypto';
import rateLimit from 'express-rate-limit';

const app = express();
app.use(express.json());

// Rate limiting to prevent brute force attacks (OWASP A07)
const credentialsLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 30, // 30 requests per window per IP
  message: { error: 'Too many authentication attempts, please try again later' },
  standardHeaders: true,
  legacyHeaders: false
});

const PORT = process.env.AUTH_SERVER_PORT || 8082;
// In container: bind to 0.0.0.0 to be reachable via nginx proxy
// In dev: bind to 127.0.0.1 for security
const HOST = process.env.AUTH_SERVER_HOST || '0.0.0.0';

/**
 * Generate a cryptographically secure random password
 * @param {number} length - Password length (default: 32)
 * @returns {string} Random password
 */
function generateSecurePassword(length = 32) {
  return crypto.randomBytes(length).toString('base64url').slice(0, length);
}

// Server credentials from environment (generate if not set)
const MUMBLE_PASSWORD = process.env.MUMBLE_PASSWORD || generateSecurePassword(32);
const GUACAMOLE_PASSWORDS = {
  admin: process.env.GUAC_ADMIN_PASSWORD || MUMBLE_PASSWORD,
  editor: process.env.GUAC_EDITOR_PASSWORD || MUMBLE_PASSWORD,
  watcher: process.env.GUAC_WATCHER_PASSWORD || MUMBLE_PASSWORD
};

// Auth provider configuration
const AUTH_PROVIDER = process.env.AUTH_PROVIDER || 'netlify';
const AUTH_PROVIDERS = {
  netlify: {
    userEndpoint: process.env.NETLIFY_IDENTITY_URL || 'https://welcome.flexpair.com/identity-proxy',
    rolesClaim: 'app_metadata.roles'
  },
  supabase: {
    userEndpoint: process.env.SUPABASE_URL ? `${process.env.SUPABASE_URL}/auth/v1` : null,
    rolesClaim: 'user_metadata.roles'
  },
  auth0: {
    userEndpoint: process.env.AUTH0_DOMAIN ? `https://${process.env.AUTH0_DOMAIN}` : null,
    rolesClaim: 'https://flexpair.com/roles'
  }
};

/**
 * Extract nested property from object using dot notation
 * @param {Object} obj - Source object
 * @param {string} path - Dot-notated path (e.g., 'app_metadata.roles')
 * @returns {*} Value at path or undefined
 */
function getNestedProperty(obj, path) {
  return path.split('.').reduce((acc, part) => acc?.[part], obj);
}

/**
 * Determine Guacamole user from roles
 * @param {Array} roles - User roles array
 * @returns {string} Guacamole username
 */
function getGuacamoleUser(roles = []) {
  if (roles.includes('admin')) return 'admin';
  if (roles.includes('edit')) return 'editor';
  if (roles.includes('watch')) return 'watcher';
  return 'watcher';
}

/**
 * Validate JWT by calling the auth provider's user endpoint
 * @param {string} token - JWT token
 * @param {Object} providerConfig - Auth provider configuration
 * @returns {Promise<Object|null>} User object or null if invalid
 */
async function validateToken(token, providerConfig) {
  if (!providerConfig.userEndpoint) {
    console.error('[AUTH] Provider endpoint not configured');
    return null;
  }

  try {
    const response = await fetch(`${providerConfig.userEndpoint}/user`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      }
    });

    if (!response.ok) {
      console.warn(`[AUTH] Token validation failed: ${response.status}`);
      return null;
    }

    return await response.json();
  } catch (error) {
    console.error('[AUTH] Token validation error:', error.message);
    return null;
  }
}

/**
 * Hash email for privacy-compliant logging (GDPR/CCPA)
 */
function hashEmail(email) {
  if (!email) return 'unknown';
  return crypto.createHash('sha256').update(email).digest('hex').slice(0, 8);
}

/**
 * Health check endpoint
 */
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', provider: AUTH_PROVIDER });
});

/**
 * Credentials endpoint - returns Mumble/Guacamole credentials after JWT validation
 * 
 * Request:
 *   POST /api/credentials
 *   Headers: Authorization: Bearer <jwt>
 * 
 * Response (200):
 *   { mumblePassword, guacamoleUser, guacamolePassword }
 * 
 * Response (401):
 *   { error: 'Invalid or expired token' }
 */
app.post('/api/credentials', credentialsLimiter, async (req, res) => {
  const authHeader = req.headers.authorization;
  
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing authorization header' });
  }

  const token = authHeader.slice(7);
  const providerConfig = AUTH_PROVIDERS[AUTH_PROVIDER];

  if (!providerConfig) {
    console.error(`[AUTH] Unknown provider: ${AUTH_PROVIDER}`);
    return res.status(500).json({ error: 'Auth provider misconfigured' });
  }

  // Validate token with auth provider
  const user = await validateToken(token, providerConfig);

  if (!user) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }

  // Extract roles from user object
  const roles = getNestedProperty(user, providerConfig.rolesClaim) || [];
  const guacamoleUser = getGuacamoleUser(roles);

  // Privacy-compliant logging (GDPR/CCPA) - hash email instead of storing plaintext
  console.log(`[AUTH] Credentials issued for user:${hashEmail(user.email)} (roles: ${roles.join(', ')})`);

  res.json({
    mumblePassword: MUMBLE_PASSWORD,
    guacamoleUser,
    guacamolePassword: GUACAMOLE_PASSWORDS[guacamoleUser]
  });
});

// Start server
app.listen(PORT, HOST, () => {
  console.log(`[AUTH] Server listening on ${HOST}:${PORT}`);
  console.log(`[AUTH] Provider: ${AUTH_PROVIDER}`);
  console.log(`[AUTH] Mumble password configured: ${MUMBLE_PASSWORD ? 'yes' : 'no'}`);
});
