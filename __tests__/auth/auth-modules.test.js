/**
 * Characterization tests for Auth modules
 * Tests AuthProvider, AuthFactory, MockAuthAdapter
 */

import { jest } from '@jest/globals';

// Import AuthProvider (abstract base class)
const AuthProvider = (await import('../../app/auth/AuthProvider.js')).default;

// Import AuthFactory
const AuthFactory = (await import('../../app/auth/AuthFactory.js')).default;

// Import MockAuthAdapter
const MockAuthAdapter = (await import('../../app/auth/MockAuthAdapter.js')).default;

// Test provider classes extracted to reduce nesting
class TestProvider extends AuthProvider {
  async init() { return; }
  async getCurrentUser() { return null; }
  async openAuth() { return; }
  async closeAuth() { return; }
  async signup() { return {}; }
  async login() { return {}; }
  async logout() { return; }
  async updateUser() { return {}; }
  async resetPassword() { return; }
  async confirmEmail() { return; }
  async refreshToken() { return; }
  on() { return () => {}; }
  off() {}
}

class IncompleteProvider extends AuthProvider {}

class AuthenticatedTestProvider extends AuthProvider {
  constructor() {
    super();
    this._currentUser = null;
  }
  async init() { return; }
  async getCurrentUser() { return this._currentUser; }
  async openAuth() { return; }
  async closeAuth() { return; }
  async signup() { return {}; }
  async login(email) { 
    this._currentUser = { email, id: '123' };
    return this._currentUser; 
  }
  async logout() { 
    this._currentUser = null;
  }
  async updateUser() { return {}; }
  async requestPasswordReset() {}
  async refreshToken() { return; }
  on() { return () => {}; }
  off() {}
}

class UndefinedUserProvider extends AuthenticatedTestProvider {
  async getCurrentUser() { return undefined; }
}

describe('AuthProvider', () => {
  describe('Abstract Class Behavior', () => {
    test('cannot be instantiated directly', () => {
      expect(() => {
        new AuthProvider();
      }).toThrow('AuthProvider is an abstract class');
    });

    test('can be extended by subclasses', () => {
      const provider = new TestProvider();
      expect(provider).toBeInstanceOf(AuthProvider);
    });
  });

  describe('Interface Contract', () => {
    test('requires init() implementation', async () => {
      const provider = new IncompleteProvider();
      await expect(provider.init()).rejects.toThrow('must be implemented');
    });

    test('requires getCurrentUser() implementation', async () => {
      const provider = new IncompleteProvider();
      await expect(provider.getCurrentUser()).rejects.toThrow('must be implemented');
    });

    test('requires openAuth() implementation', async () => {
      const provider = new IncompleteProvider();
      await expect(provider.openAuth()).rejects.toThrow('must be implemented');
    });

    test('requires closeAuth() implementation', async () => {
      const provider = new IncompleteProvider();
      await expect(provider.closeAuth()).rejects.toThrow('must be implemented');
    });

    test('requires signup() implementation', async () => {
      const provider = new IncompleteProvider();
      await expect(provider.signup('test@test.com', 'pass')).rejects.toThrow('must be implemented');
    });

    test('requires login() implementation', async () => {
      const provider = new IncompleteProvider();
      await expect(provider.login('test@test.com', 'pass')).rejects.toThrow('must be implemented');
    });

    test('requires logout() implementation', async () => {
      const provider = new IncompleteProvider();
      await expect(provider.logout()).rejects.toThrow('must be implemented');
    });

    test('requires updateUser() implementation', async () => {
      const provider = new IncompleteProvider();
      await expect(provider.updateUser({})).rejects.toThrow('must be implemented');
    });

    test('requires requestPasswordReset() implementation', async () => {
      const provider = new IncompleteProvider();
      await expect(provider.requestPasswordReset('test@test.com')).rejects.toThrow('must be implemented');
    });

    test('requires refreshToken() implementation', async () => {
      const provider = new IncompleteProvider();
      await expect(provider.refreshToken()).rejects.toThrow('must be implemented');
    });

    test('requires on() implementation', () => {
      const provider = new IncompleteProvider();
      expect(() => provider.on('login', () => {})).toThrow('must be implemented');
    });

    test('requires off() implementation', () => {
      const provider = new IncompleteProvider();
      expect(() => provider.off('login', () => {})).toThrow('must be implemented');
    });
  });

  describe('Utility Methods', () => {
    test('isAuthenticated returns true when user is logged in', async () => {
      const provider = new AuthenticatedTestProvider();
      await provider.login('test@example.com');
      
      const authenticated = await provider.isAuthenticated();
      expect(authenticated).toBe(true);
    });

    test('isAuthenticated returns false when user is logged out', async () => {
      const provider = new AuthenticatedTestProvider();
      
      const authenticated = await provider.isAuthenticated();
      expect(authenticated).toBe(false);
    });

    test('isAuthenticated returns false when user is undefined', async () => {
      const provider = new UndefinedUserProvider();
      const authenticated = await provider.isAuthenticated();
      expect(authenticated).toBe(false);
    });

    test('getProviderName returns class name', () => {
      const provider = new AuthenticatedTestProvider();
      expect(provider.getProviderName()).toBe('AuthenticatedTestProvider');
    });
  });
});

describe('AuthFactory', () => {
  describe('Provider Creation', () => {
    test('creates NetlifyIdentityAdapter by default', () => {
      const auth = AuthFactory.create({ provider: 'netlify' });
      expect(auth).toBeDefined();
      expect(auth.constructor.name).toBe('NetlifyIdentityAdapter');
    });

    test('creates MockAuthAdapter', () => {
      const auth = AuthFactory.create({ provider: 'mock' });
      expect(auth).toBeDefined();
      expect(auth).toBeInstanceOf(MockAuthAdapter);
    });

    test('accepts netlify-identity as alias', () => {
      const auth = AuthFactory.create({ provider: 'netlify-identity' });
      expect(auth.constructor.name).toBe('NetlifyIdentityAdapter');
    });

    test('throws on unknown provider', () => {
      expect(() => {
        AuthFactory.create({ provider: 'unknown' });
      }).toThrow('Unknown auth provider: unknown');
    });

    test('uses default config if none provided', () => {
      // Should not throw
      const auth = AuthFactory.create();
      expect(auth).toBeDefined();
    });

    test('reads from window.mumbleWebConfig if available', () => {
      globalThis.mumbleWebConfig = {
        auth: { provider: 'mock' }
      };
      
      const auth = AuthFactory.create();
      expect(auth).toBeInstanceOf(MockAuthAdapter);
      
      delete globalThis.mumbleWebConfig;
    });
  });

  describe('Supported Providers', () => {
    test('getSupportedProviders returns array', () => {
      const providers = AuthFactory.getSupportedProviders();
      expect(Array.isArray(providers)).toBe(true);
      expect(providers.length).toBeGreaterThan(0);
    });

    test('includes netlify and mock', () => {
      const providers = AuthFactory.getSupportedProviders();
      expect(providers).toContain('netlify');
      expect(providers).toContain('mock');
    });
  });

  describe('Config Validation', () => {
    test('validates config exists', () => {
      expect(() => {
        AuthFactory.validateConfig(null);
      }).toThrow('Auth config is required');
    });

    test('validates provider is specified', () => {
      expect(() => {
        AuthFactory.validateConfig({});
      }).toThrow('Auth provider must be specified');
    });

    test('validates provider is supported', () => {
      expect(() => {
        AuthFactory.validateConfig({ provider: 'unsupported' });
      }).toThrow('Unsupported auth provider');
    });

    test('returns true for valid config', () => {
      const result = AuthFactory.validateConfig({ provider: 'netlify' });
      expect(result).toBe(true);
    });
  });

  describe('Provider Options', () => {
    test('passes options to MockAuthAdapter', () => {
      const auth = AuthFactory.create({
        provider: 'mock',
        mock: {
          autoLogin: true,
          autoLoginDelay: 100
        }
      });
      
      expect(auth.autoLogin).toBe(true);
      expect(auth.autoLoginDelay).toBe(100);
    });
  });
});

describe('MockAuthAdapter', () => {
  let auth;

  afterEach(async () => {
    if (auth?._currentUser) {
      await auth.logout();
    }
    auth = null;
  });

  describe('Constructor & Initialization', () => {
    test('creates instance with default options', () => {
      auth = new MockAuthAdapter();
      expect(auth).toBeInstanceOf(MockAuthAdapter);
      expect(auth).toBeInstanceOf(AuthProvider);
      expect(auth.autoLogin).toBe(false);
      expect(auth.autoLoginDelay).toBe(0);
    });

    test('accepts custom options', () => {
      auth = new MockAuthAdapter({
        autoLogin: true,
        autoLoginDelay: 500,
        throwErrors: true
      });
      
      expect(auth.autoLogin).toBe(true);
      expect(auth.autoLoginDelay).toBe(500);
      expect(auth.throwErrors).toBe(true);
    });

    test('initializes without error', async () => {
      auth = new MockAuthAdapter();
      await expect(auth.init()).resolves.toBeUndefined();
    });

    test('starts with no current user', async () => {
      auth = new MockAuthAdapter();
      await auth.init();
      const user = await auth.getCurrentUser();
      expect(user).toBeNull();
    });

    test('auto-login creates user', async () => {
      auth = new MockAuthAdapter({ autoLogin: true });
      await auth.init();
      
      const user = await auth.getCurrentUser();
      expect(user).not.toBeNull();
      expect(user.email).toBe('auto@example.com');
    });

    test('emits init event', (done) => {
      auth = new MockAuthAdapter();
      auth.on('init', () => {
        done();
      });
      auth.init();
    });
  });

  describe('User Authentication', () => {
    beforeEach(async () => {
      auth = new MockAuthAdapter();
      await auth.init();
    });

    test('signup creates new user', async () => {
      const user = await auth.signup('user1@example.com', 'password123');
      
      expect(user).toBeDefined();
      expect(user.email).toBe('user1@example.com');
      expect(user.id).toBeDefined();
    });

    test('signup with metadata', async () => {
      const metadata = { name: 'Test User', role: 'admin' };
      const user = await auth.signup('user2@example.com', 'password123', metadata);
      
      // MockAuthAdapter adds full_name by default, then spreads custom metadata
      expect(user.user_metadata.name).toBe('Test User');
      expect(user.user_metadata.role).toBe('admin');
      expect(user.user_metadata.full_name).toBeDefined();
    });

    test('signup emits login event', (done) => {
      auth.on('login', (user) => {
        expect(user.email).toBe('user3@example.com');
        done();
      });
      
      auth.signup('user3@example.com', 'password123');
    });

    test('signup rejects duplicate email', async () => {
      await auth.signup('user4@example.com', 'password123');
      
      await expect(
        auth.signup('user4@example.com', 'password456')
      ).rejects.toThrow('User already exists');
    });

    test('login with valid credentials', async () => {
      await auth.signup('user5@example.com', 'password123');
      await auth.logout();
      
      const user = await auth.login('user5@example.com', 'password123');
      expect(user.email).toBe('user5@example.com');
    });

    test('login emits login event', (done) => {
      // Setup listener first
      auth.on('login', (user) => {
        if (user.email === 'user6@example.com') {
          done();
        }
      });
      
      // Signup emits login too, so we filter
      auth.signup('user6@example.com', 'password123').then(() => {
        return auth.logout();
      }).then(() => {
        return auth.login('user6@example.com', 'password123');
      });
    });

    test('login rejects unknown user', async () => {
      await expect(
        auth.login('unknown@example.com', 'password')
      ).rejects.toThrow('User not found');
    });

    test('login rejects invalid password', async () => {
      await auth.signup('user7@example.com', 'password123');
      await auth.logout();
      
      await expect(
        auth.login('user7@example.com', 'wrongpassword')
      ).rejects.toThrow('Invalid password');
    });

    test('logout clears current user', async () => {
      await auth.signup('user8@example.com', 'password123');
      await auth.logout();
      
      const user = await auth.getCurrentUser();
      expect(user).toBeNull();
    });

    test('logout emits logout event', (done) => {
      auth.signup('user9@example.com', 'password123').then(() => {
        auth.on('logout', () => {
          done();
        });
        return auth.logout();
      });
    });
  });

  describe('UI State Management', () => {
    beforeEach(async () => {
      auth = new MockAuthAdapter();
      await auth.init();
    });

    test('openAuth sets isOpen flag', async () => {
      await auth.openAuth();
      expect(auth.isOpen).toBe(true);
    });

    test('openAuth emits open event', (done) => {
      auth.on('open', (data) => {
        expect(data.view).toBe('signup');
        done();
      });
      
      auth.openAuth('signup');
    });

    test('closeAuth clears isOpen flag', async () => {
      await auth.openAuth();
      await auth.closeAuth();
      expect(auth.isOpen).toBe(false);
    });

    test('closeAuth emits close event', (done) => {
      auth.openAuth().then(() => {
        auth.on('close', () => {
          done();
        });
        return auth.closeAuth();
      });
    });
  });

  describe('Event System', () => {
    beforeEach(async () => {
      auth = new MockAuthAdapter();
      await auth.init();
    });

    test('on() registers event listener', () => {
      const callback = jest.fn();
      auth.on('login', callback);
      
      // Check that listeners array was created
      expect(auth.listeners['login']).toBeDefined();
      expect(auth.listeners['login']).toContain(callback);
    });

    test('listener receives event data', (done) => {
      auth.on('login', (user) => {
        expect(user).toBeDefined();
        expect(user.email).toBe('user10@example.com');
        done();
      });
      
      auth.signup('user10@example.com', 'password');
    });

    test('multiple listeners for same event', async () => {
      const callback1 = jest.fn();
      const callback2 = jest.fn();
      
      auth.on('login', callback1);
      auth.on('login', callback2);
      
      await auth.signup('user11@example.com', 'password');
      
      expect(callback1).toHaveBeenCalled();
      expect(callback2).toHaveBeenCalled();
    });

    test('off() removes specific listener', async () => {
      const callback = jest.fn();
      auth.on('login', callback);
      auth.off('login', callback);
      
      await auth.signup('user12@example.com', 'password');
      expect(callback).not.toHaveBeenCalled();
    });

    test('off() removes all listeners when no callback provided', async () => {
      const callback1 = jest.fn();
      const callback2 = jest.fn();
      
      auth.on('login', callback1);
      auth.on('login', callback2);
      auth.off('login'); // No callback = remove all
      
      await auth.signup('user13@example.com', 'password');
      expect(callback1).not.toHaveBeenCalled();
      expect(callback2).not.toHaveBeenCalled();
    });
  });

  describe('Error Mode', () => {
    beforeEach(async () => {
      auth = new MockAuthAdapter({ throwErrors: true });
      await auth.init();
    });

    test('signup throws in error mode', async () => {
      await expect(
        auth.signup('test@example.com', 'password')
      ).rejects.toThrow('Mock signup error');
    });

    test('login throws in error mode', async () => {
      await expect(
        auth.login('test@example.com', 'password')
      ).rejects.toThrow('Mock login error');
    });
  });

  describe('Default Users', () => {
    beforeEach(async () => {
      auth = new MockAuthAdapter();
      await auth.init();
    });

    test('includes pre-configured test users', async () => {
      // MockAuthAdapter adds default users during construction
      const user = await auth.login('test@example.com', 'password123');
      expect(user).toBeDefined();
      expect(user.email).toBe('test@example.com');
    });

    test('includes admin user', async () => {
      const user = await auth.login('admin@example.com', 'admin123');
      expect(user).toBeDefined();
      expect(user.email).toBe('admin@example.com');
    });

    test('includes standard user', async () => {
      const user = await auth.login('user@example.com', 'user123');
      expect(user).toBeDefined();
      expect(user.email).toBe('user@example.com');
    });
  });

  describe('Network Simulation', () => {
    beforeEach(async () => {
      auth = new MockAuthAdapter();
      await auth.init();
    });

    test('signup has simulated delay', async () => {
      const start = Date.now();
      await auth.signup('user14@example.com', 'password');
      const duration = Date.now() - start;
      
      // Should take at least 250ms (simulated network delay)
      expect(duration).toBeGreaterThanOrEqual(250);
    });

    test('login has simulated delay', async () => {
      const start = Date.now();
      await auth.login('test@example.com', 'password123'); // Use default user
      const duration = Date.now() - start;
      
      expect(duration).toBeGreaterThanOrEqual(250);
    });
  });

  describe('User Profile Updates', () => {
    beforeEach(async () => {
      auth = new MockAuthAdapter();
      await auth.init();
      await auth.signup('user15@example.com', 'password123');
    });

    test('updateUser updates user metadata', async () => {
      const updates = { name: 'Updated Name', role: 'editor' };
      const updated = await auth.updateUser(updates);
      
      expect(updated.user_metadata.name).toBe('Updated Name');
      expect(updated.user_metadata.role).toBe('editor');
    });

    test('updateUser merges with existing metadata', async () => {
      // First update
      await auth.updateUser({ field1: 'value1' });
      
      // Second update (should preserve field1)
      const updated = await auth.updateUser({ field2: 'value2' });
      
      expect(updated.user_metadata.field1).toBe('value1');
      expect(updated.user_metadata.field2).toBe('value2');
    });

    test('updateUser throws when not logged in', async () => {
      await auth.logout();
      
      await expect(
        auth.updateUser({ name: 'Test' })
      ).rejects.toThrow('No user logged in');
    });

    test('updateUser has simulated delay', async () => {
      const start = Date.now();
      await auth.updateUser({ name: 'Test' });
      const duration = Date.now() - start;
      
      // Allow some timing tolerance (190ms instead of exact 200ms)
      expect(duration).toBeGreaterThanOrEqual(190);
    });
  });

  describe('Password Reset', () => {
    beforeEach(async () => {
      auth = new MockAuthAdapter();
      await auth.init();
      await auth.signup('user16@example.com', 'password123');
    });

    test('requestPasswordReset succeeds for existing user', async () => {
      await expect(
        auth.requestPasswordReset('user16@example.com')
      ).resolves.toBeUndefined();
    });

    test('requestPasswordReset throws for unknown user', async () => {
      await expect(
        auth.requestPasswordReset('unknown@example.com')
      ).rejects.toThrow('User not found');
    });

    test('requestPasswordReset has simulated delay', async () => {
      const start = Date.now();
      await auth.requestPasswordReset('user16@example.com');
      const duration = Date.now() - start;
      
      expect(duration).toBeGreaterThanOrEqual(300);
    });
  });

  describe('Token Management', () => {
    beforeEach(async () => {
      auth = new MockAuthAdapter();
      await auth.init();
      await auth.signup('user17@example.com', 'password123');
    });

    test('refreshToken returns mock token when logged in', async () => {
      const token = await auth.refreshToken();
      
      expect(token).toMatch(/^mock-jwt-token-\d+$/);
    });

    test('refreshToken throws when not logged in', async () => {
      await auth.logout();
      
      await expect(auth.refreshToken()).rejects.toThrow('No user logged in');
    });

    test('refreshToken generates different tokens', async () => {
      const token1 = await auth.refreshToken();
      await new Promise(resolve => setTimeout(resolve, 10));
      const token2 = await auth.refreshToken();
      
      expect(token1).not.toBe(token2);
    });

    test('refreshToken has simulated delay', async () => {
      const start = Date.now();
      await auth.refreshToken();
      const duration = Date.now() - start;
      
      expect(duration).toBeGreaterThanOrEqual(100);
    });
  });

  describe('Provider Information', () => {
    test('getProviderName returns correct name', () => {
      auth = new MockAuthAdapter();
      expect(auth.getProviderName()).toBe('Mock Auth (Testing)');
    });
  });

  describe('Event Error Handling', () => {
    beforeEach(async () => {
      auth = new MockAuthAdapter();
      await auth.init();
    });

    test('_emit handles listener errors gracefully', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      const throwingCallback = jest.fn(() => {
        throw new Error('Listener error');
      });
      const normalCallback = jest.fn();
      
      auth.on('login', throwingCallback);
      auth.on('login', normalCallback);
      
      await auth.signup('user18@example.com', 'password123');
      
      // Both callbacks should have been called despite error
      expect(throwingCallback).toHaveBeenCalled();
      expect(normalCallback).toHaveBeenCalled();
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Error in login listener'),
        expect.any(Error)
      );
      
      consoleSpy.mockRestore();
    });
  });

  describe('Testing Utilities', () => {
    beforeEach(async () => {
      auth = new MockAuthAdapter();
      await auth.init();
    });

    test('reset() clears current user', async () => {
      await auth.signup('user19@example.com', 'password123');
      auth.reset();
      
      const user = await auth.getCurrentUser();
      expect(user).toBeNull();
    });

    test('reset() clears listeners', async () => {
      const callback = jest.fn();
      auth.on('login', callback);
      auth.reset();
      
      await auth.init(); // Re-initialize after reset
      await auth.signup('user20@example.com', 'password123');
      
      expect(callback).not.toHaveBeenCalled();
    });

    test('reset() clears custom users but restores defaults', () => {
      auth.users.set('custom@example.com', {
        user: { email: 'custom@example.com' },
        password: 'custom123'
      });
      
      auth.reset();
      
      expect(auth.users.has('custom@example.com')).toBe(false);
      expect(auth.users.has('test@example.com')).toBe(true); // Default restored
    });

    test('simulateError() enables error mode', async () => {
      auth.simulateError();
      
      await expect(
        auth.signup('user21@example.com', 'password123')
      ).rejects.toThrow('Mock signup error');
    });

    test('clearErrors() disables error mode', async () => {
      auth.simulateError();
      auth.clearErrors();
      
      await expect(
        auth.signup('user22@example.com', 'password123')
      ).resolves.toBeDefined();
    });

    test('getAllUsers() returns all registered users', async () => {
      const users = auth.getAllUsers();
      
      // Should include at least the default users
      expect(users.length).toBeGreaterThan(0);
      expect(users.some(u => u.email === 'test@example.com')).toBe(true);
    });

    test('currentUser() returns sync version of current user', async () => {
      await auth.signup('user23@example.com', 'password123');
      
      const user = auth.currentUser();
      expect(user).not.toBeNull();
      expect(user.email).toBe('user23@example.com');
    });

    test('open() is alias for openAuth()', async () => {
      await auth.open('signup');
      expect(auth.isOpen).toBe(true);
    });

    test('close() is alias for closeAuth()', async () => {
      await auth.openAuth();
      await auth.close();
      expect(auth.isOpen).toBe(false);
    });
  });
});
