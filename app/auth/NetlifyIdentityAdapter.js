import AuthProvider from './AuthProvider.js';

/**
 * Netlify Identity Authentication Adapter
 * 
 * Wraps the existing Netlify Identity widget to conform to the AuthProvider interface.
 * This maintains backward compatibility with the current implementation while
 * allowing future migration to other auth providers.
 * 
 * @example
 * const auth = new NetlifyIdentityAdapter();
 * await auth.init();
 * auth.on('login', user => console.log('User logged in:', user.email));
 */
class NetlifyIdentityAdapter extends AuthProvider {
  constructor() {
    super();

    // Will be set in init() after widget loads
    this.netlifyIdentity = null;
    this._initialized = false;
    // Queue event handlers registered before init()
    this._pendingHandlers = [];
    // Promise cache for _waitForWidget to prevent race conditions
    this._waitPromise = null;
  }

  /**
   * Wait for Netlify Identity widget to load (max 5 seconds)
   * Uses promise caching to prevent race conditions if called concurrently
   * @private
   * @returns {Promise<Object>}
   * @throws {Error} If widget doesn't load within timeout
   */
  _waitForWidget(timeout = 5000) {
    // Return cached promise if already waiting (prevents race conditions)
    if (this._waitPromise !== null) {
      return this._waitPromise;
    }

    this._waitPromise = new Promise((resolve, reject) => {
      // Already available
      if (globalThis.netlifyIdentity?.init) {
        resolve(globalThis.netlifyIdentity);
        return;
      }

      const startTime = Date.now();
      const checkInterval = setInterval(() => {
        if (globalThis.netlifyIdentity?.init) {
          clearInterval(checkInterval);
          resolve(globalThis.netlifyIdentity);
        } else if (Date.now() - startTime >= timeout) {
          clearInterval(checkInterval);
          reject(new Error('Netlify Identity widget failed to load. Authentication is required.'));
        }
      }, 50);
    });

    return this._waitPromise;
  }

  /**
   * Initialize Netlify Identity
   * @param {Object} config - Netlify Identity configuration
   * @returns {Promise<void>}
   */
  async init(config = {}) {
    if (this._initialized) {
      return;
    }

    // Wait for widget to load - throws if unavailable (no fallback for security)
    this.netlifyIdentity = await this._waitForWidget();

    // Restore identity hash that was saved and cleared by the inline script in
    // index.html (before the widget loaded). This way the widget's own init()
    // finds the token and processes it with the correctly configured API URL.
    if (globalThis.__savedIdentityHash) {
      // Clear any existing session so the GoTrue client doesn't attach a stale
      // JWT to the token-verification request.  Without this, invite/recovery
      // links fail in browsers that already have a logged-in session because
      // the server sees the conflicting Bearer token.
      try {
        globalThis.localStorage?.removeItem('gotrue.user');
      } catch (e) {
        console.warn('[Auth] Could not clear stored session:', e);
      }
      globalThis.location.hash = globalThis.__savedIdentityHash;
      delete globalThis.__savedIdentityHash;
    }

    this.netlifyIdentity.init(config);

    // Register any event handlers that were queued before init()
    for (const { event, callback } of this._pendingHandlers) {
      this.netlifyIdentity.on(event, callback);
    }
    this._pendingHandlers = [];

    this._initialized = true;
  }

  /**
   * Get currently authenticated user
   * @returns {Promise<Object|null>}
   */
  async getCurrentUser() {
    return this.netlifyIdentity.currentUser();
  }

  /**
   * Get currently authenticated user (synchronous, for backward compatibility)
   * @returns {Object|null}
   */
  currentUser() {
    return this.netlifyIdentity.currentUser();
  }

  /**
   * Open Netlify Identity modal
   * @param {string} view - 'login' or 'signup'
   * @returns {Promise<void>}
   */
  async openAuth(view = 'login') {
    this.netlifyIdentity.open(view);
  }

  /**
   * Open Netlify Identity modal (for backward compatibility)
   * @param {string} view - 'login' or 'signup'
   */
  open(view = 'login') {
    this.netlifyIdentity.open(view);
  }

  /**
   * Close Netlify Identity modal
   * @returns {Promise<void>}
   */
  async closeAuth() {
    this.netlifyIdentity.close();
  }

  /**
   * Close Netlify Identity modal (for backward compatibility)
   */
  close() {
    this.netlifyIdentity.close();
  }

  /**
   * Helper method to create error handler for auth operations
   * @private
   * @param {Function} handleLogin - Login success handler
   * @param {Function} reject - Promise reject function
   * @returns {Function} Error handler function
   */
  _createErrorHandler(handleLogin, reject) {
    const handleError = (error) => {
      this.netlifyIdentity.off('login', handleLogin);
      this.netlifyIdentity.off('error', handleError);
      reject(error);
    };
    return handleError;
  }

  /**
   * Helper method to open auth modal and wait for login/error
   * @private
   * @param {string} view - 'login' or 'signup'
   * @returns {Promise<Object>}
   */
  _openAuthAndWait(view) {
    return new Promise((resolve, reject) => {
      this.netlifyIdentity.open(view);
      
      const handleLogin = (user) => {
        this.netlifyIdentity.off('login', handleLogin);
        this.netlifyIdentity.off('error', handleError);
        resolve(user);
      };
      
      const handleError = this._createErrorHandler(handleLogin, reject);
      
      this.netlifyIdentity.on('login', handleLogin);
      this.netlifyIdentity.on('error', handleError);
    });
  }

  /**
   * Sign up new user (opens modal to signup tab)
   * Netlify Identity handles signup via modal, not programmatically
   * @returns {Promise<Object>}
   */
  async signup(email, password, metadata = {}) {
    return this._openAuthAndWait('signup');
  }

  /**
   * Log in user (opens modal to login tab)
   * Netlify Identity handles login via modal, not programmatically
   * @returns {Promise<Object>}
   */
  async login(email, password) {
    return this._openAuthAndWait('login');
  }

  /**
   * Log out current user
   * @returns {Promise<void>}
   */
  async logout() {
    return new Promise((resolve) => {
      const done = () => {
        this.netlifyIdentity.off('logout', done);
        resolve();
      };
      this.netlifyIdentity.on('logout', done);
      this.netlifyIdentity.logout();
    });
  }

  /**
   * Register event listener
   * Can be called before init() - handlers will be queued and registered after init
   * @param {string} event
   * @param {Function} callback
   */
  on(event, callback) {
    if (this.netlifyIdentity) {
      this.netlifyIdentity.on(event, callback);
    } else {
      // Queue for later registration after init()
      this._pendingHandlers.push({ event, callback });
    }
  }

  /**
   * Unregister event listener
   * @param {string} event
   * @param {Function} callback
   */
  off(event, callback) {
    if (this.netlifyIdentity) {
      this.netlifyIdentity.off(event, callback);
    } else {
      // Remove from pending handlers if exists
      this._pendingHandlers = this._pendingHandlers.filter(
        h => !(h.event === event && h.callback === callback)
      );
    }
  }

  /**
   * Get provider name
   * @returns {string}
   */
  getProviderName() {
    return 'Netlify Identity';
  }
}

export default NetlifyIdentityAdapter;
