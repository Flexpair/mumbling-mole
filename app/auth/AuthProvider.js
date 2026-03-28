/**
 * Abstract Authentication Provider Interface
 * 
 * This base class defines the contract that all authentication providers must implement.
 * By coding against this interface, the app can switch between auth providers
 * (Netlify Identity, Supabase, Auth0, etc.) with minimal code changes.
 * 
 * @example
 * // Usage in app:
 * const auth = new NetlifyIdentityAdapter();
 * await auth.init();
 * auth.on('login', user => console.log('Logged in:', user));
 * 
 * // Later, switch to different provider by changing ONE line:
 * const auth = new SupabaseAuthAdapter(url, key);
 */
class AuthProvider {
  constructor() {
    if (new.target === AuthProvider) {
      throw new Error('AuthProvider is an abstract class and cannot be instantiated directly');
    }
  }

  /**
   * Initialize the authentication provider
   * Called once during app startup
   * @returns {Promise<void>}
   */
  async init() {
    throw new Error('Method init() must be implemented by subclass');
  }

  /**
   * Get the currently authenticated user
   * @returns {Promise<Object|null>} User object or null if not authenticated
   * User object should have at minimum: { email, id, user_metadata, app_metadata }
   */
  async getCurrentUser() {
    throw new Error('Method getCurrentUser() must be implemented by subclass');
  }

  /**
   * Open login interface (modal, redirect, etc.)
   * Implementation depends on provider's UI/UX
   * @param {string} [view='login'] - 'login' or 'signup'
   * @returns {Promise<void>}
   */
  async openAuth(view = 'login') {
    throw new Error('Method openAuth() must be implemented by subclass');
  }

  /**
   * Close login interface (if applicable)
   * @returns {Promise<void>}
   */
  async closeAuth() {
    throw new Error('Method closeAuth() must be implemented by subclass');
  }

  /**
   * Sign up a new user
   * @param {string} email - User's email
   * @param {string} password - User's password
   * @param {Object} [metadata={}] - Additional user metadata
   * @returns {Promise<Object>} User object
   */
  async signup(email, password, metadata = {}) {
    throw new Error('Method signup() must be implemented by subclass');
  }

  /**
   * Log in an existing user
   * @param {string} email - User's email
   * @param {string} password - User's password
   * @returns {Promise<Object>} User object
   */
  async login(email, password) {
    throw new Error('Method login() must be implemented by subclass');
  }

  /**
   * Log out the current user
   * @returns {Promise<void>}
   */
  async logout() {
    throw new Error('Method logout() must be implemented by subclass');
  }

  /**
   * Register event listener
   * Standard events: 'init', 'login', 'logout', 'error', 'open', 'close'
   * @param {string} event - Event name
   * @param {Function} callback - Event handler
   * @returns {void}
   */
  on(event, callback) {
    throw new Error('Method on() must be implemented by subclass');
  }

  /**
   * Unregister event listener
   * @param {string} event - Event name
   * @param {Function} [callback] - Specific handler to remove, or all if omitted
   * @returns {void}
   */
  off(event, callback) {
    throw new Error('Method off() must be implemented by subclass');
  }

  /**
   * Check if user is currently authenticated
   * @returns {Promise<boolean>}
   */
  async isAuthenticated() {
    const user = await this.getCurrentUser();
    return user !== null && user !== undefined;
  }

  /**
   * Get provider name (for debugging/logging)
   * @returns {string}
   */
  getProviderName() {
    return this.constructor.name;
  }
}

export default AuthProvider;
