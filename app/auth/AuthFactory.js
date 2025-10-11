import NetlifyIdentityAdapter from './NetlifyIdentityAdapter.js';
// Import other adapters as they're implemented:
// import SupabaseAuthAdapter from './SupabaseAuthAdapter.js';
// import Auth0Adapter from './Auth0Adapter.js';
// import FirebaseAuthAdapter from './FirebaseAuthAdapter.js';

/**
 * Authentication Provider Factory
 * 
 * Creates the appropriate auth provider based on configuration.
 * This allows switching auth providers via config without changing app code.
 * 
 * @example
 * // In config.js:
 * auth: { provider: 'netlify' }
 * 
 * // In app code:
 * import AuthFactory from './auth/AuthFactory.js';
 * const auth = AuthFactory.create();
 * await auth.init();
 */
class AuthFactory {
  /**
   * Create an authentication provider instance
   * @param {Object} [config] - Optional config override
   * @param {string} config.provider - Provider name: 'netlify', 'supabase', 'auth0', 'firebase'
   * @param {Object} config.options - Provider-specific options
   * @returns {AuthProvider}
   */
  static create(config = null) {
    // Load config from global config if not provided
    let authConfig = config;
    if (!authConfig) {
      try {
        const globalConfig = require('../config.js');
        authConfig = globalConfig.auth || { provider: 'netlify' };
      } catch (err) {
        console.warn('Could not load config.js, using default (netlify)');
        authConfig = { provider: 'netlify' };
      }
    }

    const provider = authConfig.provider || 'netlify';
    const options = authConfig.options || {};

    switch (provider.toLowerCase()) {
      case 'netlify':
      case 'netlify-identity':
        return new NetlifyIdentityAdapter();

      // Uncomment and implement as needed:
      /*
      case 'supabase':
        if (!options.url || !options.anonKey) {
          throw new Error('Supabase requires url and anonKey in config.auth.options');
        }
        return new SupabaseAuthAdapter(options.url, options.anonKey);

      case 'auth0':
        if (!options.domain || !options.clientId) {
          throw new Error('Auth0 requires domain and clientId in config.auth.options');
        }
        return new Auth0Adapter(options.domain, options.clientId);

      case 'firebase':
        if (!options.apiKey || !options.authDomain) {
          throw new Error('Firebase requires apiKey and authDomain in config.auth.options');
        }
        return new FirebaseAuthAdapter(options);
      */

      default:
        throw new Error(`Unknown auth provider: ${provider}. Supported: netlify, supabase, auth0, firebase`);
    }
  }

  /**
   * Get list of supported providers
   * @returns {Array<string>}
   */
  static getSupportedProviders() {
    return [
      'netlify',
      // Add more as they're implemented:
      // 'supabase',
      // 'auth0',
      // 'firebase',
    ];
  }

  /**
   * Validate provider configuration
   * @param {Object} config
   * @returns {boolean}
   * @throws {Error} If config is invalid
   */
  static validateConfig(config) {
    if (!config) {
      throw new Error('Auth config is required');
    }

    if (!config.provider) {
      throw new Error('Auth provider must be specified in config.auth.provider');
    }

    const supported = AuthFactory.getSupportedProviders();
    if (!supported.includes(config.provider.toLowerCase())) {
      throw new Error(
        `Unsupported auth provider: ${config.provider}. ` +
        `Supported providers: ${supported.join(', ')}`
      );
    }

    return true;
  }
}

export default AuthFactory;
