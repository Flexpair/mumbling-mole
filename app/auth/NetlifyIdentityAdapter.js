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
    
    // Check if Netlify Identity widget is available
    if (typeof window !== 'undefined' && 
        window.netlifyIdentity && 
        typeof window.netlifyIdentity.init === 'function') {
      this.netlifyIdentity = window.netlifyIdentity;
    } else {
      // Fallback mock for testing or when widget fails to load
      console.warn('Netlify Identity widget not found, using fallback mock');
      this.netlifyIdentity = this._createFallbackMock();
    }
  }

  /**
   * Initialize Netlify Identity
   * @returns {Promise<void>}
   */
  async init() {
    return new Promise((resolve) => {
      if (this.netlifyIdentity.init) {
        this.netlifyIdentity.init();
      }
      // Netlify Identity init is synchronous, resolve immediately
      resolve();
    });
  }

  /**
   * Get currently authenticated user
   * @returns {Promise<Object|null>}
   */
  async getCurrentUser() {
    return Promise.resolve(this.netlifyIdentity.currentUser());
  }

  /**
   * Open Netlify Identity modal
   * @param {string} view - 'login' or 'signup'
   * @returns {Promise<void>}
   */
  async openAuth(view = 'login') {
    return Promise.resolve(this.netlifyIdentity.open(view));
  }

  /**
   * Close Netlify Identity modal
   * @returns {Promise<void>}
   */
  async closeAuth() {
    return Promise.resolve(this.netlifyIdentity.close());
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
    return Promise.resolve(this.netlifyIdentity.logout());
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
    console.warn('NetlifyIdentityAdapter: updateUser not fully implemented');
    const user = await this.getCurrentUser();
    if (!user) {
      throw new Error('No user logged in');
    }
    // Return current user as we can't update via widget
    return Promise.resolve(user);
  }

  /**
   * Request password reset
   * Opens the modal to password recovery
   * @param {string} email
   * @returns {Promise<void>}
   */
  async requestPasswordReset(email) {
    // Netlify Identity handles this via modal
    return Promise.resolve(this.netlifyIdentity.open('recover'));
  }

  /**
   * Refresh JWT token
   * @returns {Promise<string>}
   */
  async refreshToken() {
    return this.netlifyIdentity.refresh().then(jwt => jwt);
  }

  /**
   * Register event listener
   * @param {string} event
   * @param {Function} callback
   */
  on(event, callback) {
    this.netlifyIdentity.on(event, callback);
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
   * Create fallback mock when Netlify Identity is unavailable
   * @private
   * @returns {Object}
   */
  _createFallbackMock() {
    const listeners = {};
    
    return {
      init: () => {},
      open: (tab) => console.warn('Netlify Identity mock: open called with', tab),
      close: () => console.warn('Netlify Identity mock: close called'),
      currentUser: () => null,
      logout: () => console.warn('Netlify Identity mock: logout called'),
      refresh: () => Promise.resolve(null),
      on: (event, callback) => {
        if (!listeners[event]) {
          listeners[event] = [];
        }
        listeners[event].push(callback);
      },
      off: (event, callback) => {
        if (!listeners[event]) return;
        if (callback) {
          listeners[event] = listeners[event].filter(cb => cb !== callback);
        } else {
          listeners[event] = [];
        }
      }
    };
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
