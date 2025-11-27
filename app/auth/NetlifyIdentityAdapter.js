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
  }

  /**
   * Wait for Netlify Identity widget to load (max 5 seconds)
   * @private
   * @returns {Promise<Object>}
   * @throws {Error} If widget doesn't load within timeout
   */
  _waitForWidget(timeout = 5000) {
    return new Promise((resolve, reject) => {
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
   * Sign up new user (opens modal to signup tab)
   * Netlify Identity handles signup via modal, not programmatically
   * @returns {Promise<Object>}
   */
  async signup(email, password, metadata = {}) {
    return new Promise((resolve, reject) => {
      this.netlifyIdentity.open('signup');
      
      const handleLogin = (user) => {
        this.netlifyIdentity.off('login', handleLogin);
        this.netlifyIdentity.off('error', handleError);
        resolve(user);
      };
      
      const handleError = (error) => {
        this.netlifyIdentity.off('login', handleLogin);
        this.netlifyIdentity.off('error', handleError);
        reject(error);
      };
      
      this.netlifyIdentity.on('login', handleLogin);
      this.netlifyIdentity.on('error', handleError);
    });
  }

  /**
   * Log in user (opens modal to login tab)
   * Netlify Identity handles login via modal, not programmatically
   * @returns {Promise<Object>}
   */
  async login(email, password) {
    return new Promise((resolve, reject) => {
      this.netlifyIdentity.open('login');
      
      const handleLogin = (user) => {
        this.netlifyIdentity.off('login', handleLogin);
        this.netlifyIdentity.off('error', handleError);
        resolve(user);
      };
      
      const handleError = (error) => {
        this.netlifyIdentity.off('login', handleLogin);
        this.netlifyIdentity.off('error', handleError);
        reject(error);
      };
      
      this.netlifyIdentity.on('login', handleLogin);
      this.netlifyIdentity.on('error', handleError);
    });
  }

  /**
   * Log out current user
   * @returns {Promise<void>}
   */
  async logout() {
    this.netlifyIdentity.logout();
  }

  /**
   * Update user metadata
   * Note: Netlify Identity widget doesn't expose direct update method,
   * this would need to use the underlying GoTrue client
   * @param {Object} updates
   * @returns {Promise<Object>}
   */
  async updateUser(updates) {
    // This is a limitation of the widget - would need gotrue client access
    console.warn('NetlifyIdentityAdapter: updateUser not fully implemented. The Netlify Identity widget does not support direct user metadata updates; updates will NOT be applied. Only the current user object will be returned.');
    const user = await this.getCurrentUser();
    if (!user) {
      throw new Error('No user logged in');
    }
    // Return current user as we can't update via widget
    return user;
  }

  /**
   * Request password reset
   * Opens the modal to password recovery
   * @param {string} email
   * @returns {Promise<void>}
   */
  async requestPasswordReset(email) {
    this.netlifyIdentity.open('recover');
  }

  /**
   * Refresh JWT token
   * @returns {Promise<string>}
   */
  async refreshToken() {
    return this.netlifyIdentity.refresh();
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
    this.netlifyIdentity.off(event, callback);
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
