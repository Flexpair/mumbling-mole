/**
 * Characterization tests for Auth modules
 * Tests AuthProvider and AuthFactory
 */

// Import AuthProvider (abstract base class)
const AuthProvider = (await import('../../app/auth/AuthProvider.js')).default;

// Import AuthFactory
const AuthFactory = (await import('../../app/auth/AuthFactory.js')).default;

// Test provider classes extracted to reduce nesting
class TestProvider extends AuthProvider {
  async init() { return; }
  async getCurrentUser() { return null; }
  async openAuth() { return; }
  async closeAuth() { return; }
  async signup() { return {}; }
  async login() { return {}; }
  async logout() { return; }
  on() { return () => {}; }
  off() { /* Intentionally blank for testing */ }
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
  on() { return () => {}; }
  off() { /* Intentionally empty for test provider */ }
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

    test('accepts netlify-identity as alias', () => {
      const auth = AuthFactory.create({ provider: 'netlify-identity' });
      expect(auth.constructor.name).toBe('NetlifyIdentityAdapter');
    });

    test('throws on unknown provider', () => {
      expect(() => {
        AuthFactory.create({ provider: 'unknown' });
      }).toThrow('Unknown auth provider: unknown');
    });

    test('throws on mock provider (removed for security)', () => {
      expect(() => {
        AuthFactory.create({ provider: 'mock' });
      }).toThrow('Unknown auth provider: mock');
    });

    test('uses default config if none provided', () => {
      // Should not throw
      const auth = AuthFactory.create();
      expect(auth).toBeDefined();
    });

    test('reads from window.mumbleWebConfig if available', () => {
      globalThis.mumbleWebConfig = {
        auth: { provider: 'netlify' }
      };
      
      const auth = AuthFactory.create();
      expect(auth.constructor.name).toBe('NetlifyIdentityAdapter');
      
      delete globalThis.mumbleWebConfig;
    });

    test('uses netlify as default when provider is not specified in config', () => {
      // Config exists but has no provider property
      const auth = AuthFactory.create({});
      expect(auth.constructor.name).toBe('NetlifyIdentityAdapter');
    });
  });

  describe('Supported Providers', () => {
    test('getSupportedProviders returns array', () => {
      const providers = AuthFactory.getSupportedProviders();
      expect(Array.isArray(providers)).toBe(true);
      expect(providers.length).toBeGreaterThan(0);
    });

    test('includes only netlify', () => {
      const providers = AuthFactory.getSupportedProviders();
      expect(providers).toContain('netlify');
      expect(providers).not.toContain('mock');
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
});

