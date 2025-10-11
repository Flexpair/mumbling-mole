/**
 * Authentication Module Exports
 * 
 * Central export point for all authentication-related classes.
 * Use this for cleaner imports throughout the app.
 * 
 * @example
 * // Instead of:
 * import AuthFactory from './auth/AuthFactory.js';
 * import AuthProvider from './auth/AuthProvider.js';
 * 
 * // Use:
 * import { AuthFactory, AuthProvider } from './auth/index.js';
 */

export { default as AuthProvider } from './AuthProvider.js';
export { default as AuthFactory } from './AuthFactory.js';
export { default as NetlifyIdentityAdapter } from './NetlifyIdentityAdapter.js';
export { default as MockAuthAdapter } from './MockAuthAdapter.js';

// Export future adapters as they're implemented:
// export { default as SupabaseAuthAdapter } from './SupabaseAuthAdapter.js';
// export { default as Auth0Adapter } from './Auth0Adapter.js';
// export { default as FirebaseAuthAdapter } from './FirebaseAuthAdapter.js';
