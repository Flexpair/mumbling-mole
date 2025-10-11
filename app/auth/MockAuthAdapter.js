import AuthProvider from './AuthProvider.js';

/**
 * Mock Authentication Adapter for Testing
 * 
 * Provides a fake authentication system for automated testing and development.
 * No real authentication happens - useful for testing UI flows without a backend.
 * 
 * @example
 * // In tests:
 * const auth = new MockAuthAdapter();
 * await auth.init();
 * await auth.login('test@example.com', 'password');
 * const user = await auth.getCurrentUser(); // Returns mock user
 */
class MockAuthAdapter extends AuthProvider {
  constructor(options = {}) {
    super();
    
    this.autoLogin = options.autoLogin || false;
    this.autoLoginDelay = options.autoLoginDelay || 0;
    this.throwErrors = options.throwErrors || false;
    
    this.currentUser = null;
    this.listeners = {};
    this.isOpen = false;
    
    // Mock user database
    this.users = new Map();
    this._addDefaultUsers();
  }

  /**
   * Initialize mock auth
   * @returns {Promise<void>}
   */
  async init() {
    return new Promise((resolve) => {
      setTimeout(() => {
        this._emit('init', this.currentUser);
        
        if (this.autoLogin) {
          this.currentUser = this._createUser('auto@example.com');
          this._emit('login', this.currentUser);
        }
        
        resolve();
      }, this.autoLoginDelay);
    });
  }

  /**
   * Get current user
   * @returns {Promise<Object|null>}
   */
  async getCurrentUser() {
    return Promise.resolve(this.currentUser);
  }

  /**
   * Open mock auth UI
   * @param {string} view
   * @returns {Promise<void>}
   */
  async openAuth(view = 'login') {
    this.isOpen = true;
    this._emit('open', { view });
    return Promise.resolve();
  }

  /**
   * Close mock auth UI
   * @returns {Promise<void>}
   */
  async closeAuth() {
    this.isOpen = false;
    this._emit('close');
    return Promise.resolve();
  }

  /**
   * Mock signup
   * @param {string} email
   * @param {string} password
   * @param {Object} metadata
   * @returns {Promise<Object>}
   */
  async signup(email, password, metadata = {}) {
    await this._delay(300); // Simulate network delay
    
    if (this.throwErrors) {
      throw new Error('Mock signup error');
    }
    
    if (this.users.has(email)) {
      throw new Error('User already exists');
    }
    
    const user = this._createUser(email, metadata);
    this.users.set(email, { password, user });
    this.currentUser = user;
    
    this._emit('login', user);
    return user;
  }

  /**
   * Mock login
   * @param {string} email
   * @param {string} password
   * @returns {Promise<Object>}
   */
  async login(email, password) {
    await this._delay(300); // Simulate network delay
    
    if (this.throwErrors) {
      throw new Error('Mock login error');
    }
    
    const userData = this.users.get(email);
    if (!userData) {
      throw new Error('User not found');
    }
    
    if (userData.password !== password) {
      throw new Error('Invalid password');
    }
    
    this.currentUser = userData.user;
    this._emit('login', this.currentUser);
    return this.currentUser;
  }

  /**
   * Mock logout
   * @returns {Promise<void>}
   */
  async logout() {
    await this._delay(100);
    
    this.currentUser = null;
    this._emit('logout');
    return Promise.resolve();
  }

  /**
   * Mock update user
   * @param {Object} updates
   * @returns {Promise<Object>}
   */
  async updateUser(updates) {
    await this._delay(200);
    
    if (!this.currentUser) {
      throw new Error('No user logged in');
    }
    
    this.currentUser = {
      ...this.currentUser,
      user_metadata: {
        ...this.currentUser.user_metadata,
        ...updates
      }
    };
    
    return this.currentUser;
  }

  /**
   * Mock password reset
   * @param {string} email
   * @returns {Promise<void>}
   */
  async requestPasswordReset(email) {
    await this._delay(300);
    
    if (!this.users.has(email)) {
      // In real systems, don't reveal if user exists
      // But for testing, we'll throw
      throw new Error('User not found');
    }
    
    console.log(`[MockAuth] Password reset email sent to ${email}`);
    return Promise.resolve();
  }

  /**
   * Mock token refresh
   * @returns {Promise<string>}
   */
  async refreshToken() {
    await this._delay(100);
    
    if (!this.currentUser) {
      throw new Error('No user logged in');
    }
    
    return Promise.resolve('mock-jwt-token-' + Date.now());
  }

  /**
   * Register event listener
   * @param {string} event
   * @param {Function} callback
   */
  on(event, callback) {
    if (!this.listeners[event]) {
      this.listeners[event] = [];
    }
    this.listeners[event].push(callback);
  }

  /**
   * Unregister event listener
   * @param {string} event
   * @param {Function} callback
   */
  off(event, callback) {
    if (!this.listeners[event]) return;
    
    if (callback) {
      this.listeners[event] = this.listeners[event].filter(cb => cb !== callback);
    } else {
      this.listeners[event] = [];
    }
  }

  /**
   * Get provider name
   * @returns {string}
   */
  getProviderName() {
    return 'Mock Auth (Testing)';
  }

  // Helper methods

  /**
   * Emit event to listeners
   * @private
   */
  _emit(event, data) {
    if (!this.listeners[event]) return;
    
    this.listeners[event].forEach(callback => {
      try {
        callback(data);
      } catch (err) {
        console.error(`Error in ${event} listener:`, err);
      }
    });
  }

  /**
   * Simulate async delay
   * @private
   */
  _delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Create mock user object
   * @private
   */
  _createUser(email, metadata = {}) {
    return {
      id: 'mock-user-' + Math.random().toString(36).substr(2, 9),
      email: email,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      user_metadata: {
        full_name: metadata.full_name || 'Mock User',
        ...metadata
      },
      app_metadata: {
        provider: 'mock',
        roles: ['user']
      }
    };
  }

  /**
   * Add default test users
   * @private
   */
  _addDefaultUsers() {
    const testUsers = [
      { email: 'test@example.com', password: 'password123' },
      { email: 'admin@example.com', password: 'admin123' },
      { email: 'user@example.com', password: 'user123' }
    ];
    
    testUsers.forEach(({ email, password }) => {
      const user = this._createUser(email);
      this.users.set(email, { password, user });
    });
  }

  // Testing utilities

  /**
   * Reset to initial state (for testing)
   */
  reset() {
    this.currentUser = null;
    this.listeners = {};
    this.isOpen = false;
    this.users = new Map();
    this._addDefaultUsers();
  }

  /**
   * Simulate network error (for testing)
   */
  simulateError() {
    this.throwErrors = true;
  }

  /**
   * Clear error simulation
   */
  clearErrors() {
    this.throwErrors = false;
  }

  /**
   * Get all registered users (for testing)
   */
  getAllUsers() {
    return Array.from(this.users.values()).map(u => u.user);
  }
}

export default MockAuthAdapter;
