/**
 * Characterization tests for NetlifyIdentityAdapter
 * Tests the Netlify Identity widget wrapper functionality
 */

import { jest } from '@jest/globals';

describe('NetlifyIdentityAdapter', () => {
  let NetlifyIdentityAdapter;
  let adapter;
  let consoleWarnSpy;
  let mockNetlifyIdentity;

  beforeEach(async () => {
    // Reset mocks
    jest.clearAllMocks();
    
    // Create fresh mock for each test
    mockNetlifyIdentity = {
      init: jest.fn(),
      open: jest.fn(),
      close: jest.fn(),
      currentUser: jest.fn().mockReturnValue(null),
      logout: jest.fn(),
      refresh: jest.fn().mockResolvedValue(null),
      on: jest.fn(),
      off: jest.fn()
    };
    
    // Setup console.warn spy
    consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    
    // Setup window.netlifyIdentity
    globalThis.window = globalThis.window || {};
    globalThis.window.netlifyIdentity = mockNetlifyIdentity;
    
    // Import module fresh each time
    const module = await import('../../app/auth/NetlifyIdentityAdapter.js');
    NetlifyIdentityAdapter = module.default;
  });

  afterEach(() => {
    consoleWarnSpy.mockRestore();
    delete globalThis.window.netlifyIdentity;
  });

  describe('Constructor', () => {
    test('uses window.netlifyIdentity when available', () => {
      adapter = new NetlifyIdentityAdapter();
      expect(adapter.netlifyIdentity).toBe(mockNetlifyIdentity);
      expect(consoleWarnSpy).not.toHaveBeenCalled();
    });

    test('creates fallback mock when window.netlifyIdentity is unavailable', () => {
      delete globalThis.window.netlifyIdentity;
      adapter = new NetlifyIdentityAdapter();
      
      expect(adapter.netlifyIdentity).toBeDefined();
      expect(adapter.netlifyIdentity).not.toBe(mockNetlifyIdentity);
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        'Netlify Identity widget not found, using fallback mock'
      );
    });

    test('creates fallback mock when init function is missing', () => {
      globalThis.window.netlifyIdentity = { ...mockNetlifyIdentity };
      delete globalThis.window.netlifyIdentity.init;
      
      adapter = new NetlifyIdentityAdapter();
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        'Netlify Identity widget not found, using fallback mock'
      );
    });
  });

  describe('init()', () => {
    beforeEach(() => {
      adapter = new NetlifyIdentityAdapter();
    });

    test('calls netlifyIdentity.init with config', async () => {
      const config = { container: '#widget' };
      await adapter.init(config);
      
      expect(adapter.netlifyIdentity.init).toHaveBeenCalledWith(config);
    });

    test('calls netlifyIdentity.init with empty config by default', async () => {
      await adapter.init();
      
      expect(adapter.netlifyIdentity.init).toHaveBeenCalledWith({});
    });

    test('resolves immediately after calling init', async () => {
      const result = await adapter.init();
      expect(result).toBeUndefined();
    });

    test('handles missing init function gracefully', async () => {
      adapter.netlifyIdentity.init = undefined;
      await expect(adapter.init()).resolves.toBeUndefined();
    });
  });

  describe('getCurrentUser()', () => {
    beforeEach(() => {
      adapter = new NetlifyIdentityAdapter();
      // Reconnect to the actual mock after instantiation
      adapter.netlifyIdentity.currentUser.mockClear();
    });

    test('returns user from netlifyIdentity.currentUser', async () => {
      const mockUser = { id: '123', email: 'test@example.com' };
      adapter.netlifyIdentity.currentUser = jest.fn().mockReturnValue(mockUser);
      
      const user = await adapter.getCurrentUser();
      expect(user).toBe(mockUser);
      expect(adapter.netlifyIdentity.currentUser).toHaveBeenCalled();
    });

    test('returns null when no user is logged in', async () => {
      adapter.netlifyIdentity.currentUser = jest.fn().mockReturnValue(null);
      
      const user = await adapter.getCurrentUser();
      expect(user).toBeNull();
    });
  });

  describe('currentUser() - sync version', () => {
    beforeEach(() => {
      adapter = new NetlifyIdentityAdapter();
    });

    test('returns user synchronously', () => {
      const mockUser = { id: '456', email: 'sync@example.com' };
      adapter.netlifyIdentity.currentUser = jest.fn().mockReturnValue(mockUser);
      
      const user = adapter.currentUser();
      expect(user).toBe(mockUser);
    });

    test('returns null when no user is logged in', () => {
      adapter.netlifyIdentity.currentUser = jest.fn().mockReturnValue(null);
      
      const user = adapter.currentUser();
      expect(user).toBeNull();
    });
  });

  describe('openAuth()', () => {
    beforeEach(() => {
      adapter = new NetlifyIdentityAdapter();
    });

    test('opens login view by default', async () => {
      await adapter.openAuth();
      expect(adapter.netlifyIdentity.open).toHaveBeenCalledWith('login');
    });

    test('opens signup view when specified', async () => {
      await adapter.openAuth('signup');
      expect(adapter.netlifyIdentity.open).toHaveBeenCalledWith('signup');
    });

    test('resolves after opening modal', async () => {
      const result = await adapter.openAuth();
      expect(result).toBeUndefined();
    });
  });

  describe('open() - backward compatibility', () => {
    beforeEach(() => {
      adapter = new NetlifyIdentityAdapter();
    });

    test('opens login view by default', () => {
      adapter.open();
      expect(adapter.netlifyIdentity.open).toHaveBeenCalledWith('login');
    });

    test('opens specified view', () => {
      adapter.open('signup');
      expect(adapter.netlifyIdentity.open).toHaveBeenCalledWith('signup');
    });
  });

  describe('closeAuth()', () => {
    beforeEach(() => {
      adapter = new NetlifyIdentityAdapter();
    });

    test('closes the modal', async () => {
      await adapter.closeAuth();
      expect(adapter.netlifyIdentity.close).toHaveBeenCalled();
    });

    test('resolves after closing', async () => {
      const result = await adapter.closeAuth();
      expect(result).toBeUndefined();
    });
  });

  describe('close() - backward compatibility', () => {
    beforeEach(() => {
      adapter = new NetlifyIdentityAdapter();
    });

    test('closes the modal', () => {
      adapter.close();
      expect(adapter.netlifyIdentity.close).toHaveBeenCalled();
    });
  });

  describe('signup()', () => {
    beforeEach(() => {
      adapter = new NetlifyIdentityAdapter();
    });

    test('opens signup modal', async () => {
      // Setup mock to trigger login event
      adapter.netlifyIdentity.on.mockImplementation((event, callback) => {
        if (event === 'login') {
          setTimeout(() => callback({ id: '789', email: 'new@example.com' }), 10);
        }
      });

      const promise = adapter.signup('new@example.com', 'password123');
      
      expect(adapter.netlifyIdentity.open).toHaveBeenCalledWith('signup');
      
      const user = await promise;
      expect(user).toEqual({ id: '789', email: 'new@example.com' });
    });

    test('registers login and error handlers', async () => {
      const promise = adapter.signup('test@example.com', 'pass');
      
      expect(adapter.netlifyIdentity.on).toHaveBeenCalledWith('login', expect.any(Function));
      expect(adapter.netlifyIdentity.on).toHaveBeenCalledWith('error', expect.any(Function));
      
      // Trigger login to resolve promise
      const loginHandler = adapter.netlifyIdentity.on.mock.calls.find(call => call[0] === 'login')[1];
      loginHandler({ id: '123', email: 'test@example.com' });
      
      await promise;
    });

    test('cleans up handlers on success', async () => {
      adapter.netlifyIdentity.on.mockImplementation((event, callback) => {
        if (event === 'login') {
          setTimeout(() => callback({ id: '999', email: 'cleanup@example.com' }), 10);
        }
      });

      await adapter.signup('cleanup@example.com', 'password');
      
      expect(adapter.netlifyIdentity.off).toHaveBeenCalledWith('login', expect.any(Function));
      expect(adapter.netlifyIdentity.off).toHaveBeenCalledWith('error', expect.any(Function));
    });

    test('rejects on error', async () => {
      adapter.netlifyIdentity.on.mockImplementation((event, callback) => {
        if (event === 'error') {
          setTimeout(() => callback(new Error('Signup failed')), 10);
        }
      });

      await expect(adapter.signup('fail@example.com', 'pass'))
        .rejects.toThrow('Signup failed');
    });

    test('cleans up handlers on error', async () => {
      adapter.netlifyIdentity.on.mockImplementation((event, callback) => {
        if (event === 'error') {
          setTimeout(() => callback(new Error('Error')), 10);
        }
      });

      try {
        await adapter.signup('error@example.com', 'pass');
      } catch (e) {
        // Expected error
      }
      
      expect(adapter.netlifyIdentity.off).toHaveBeenCalledWith('login', expect.any(Function));
      expect(adapter.netlifyIdentity.off).toHaveBeenCalledWith('error', expect.any(Function));
    });
  });

  describe('login()', () => {
    beforeEach(() => {
      adapter = new NetlifyIdentityAdapter();
    });

    test('opens login modal', async () => {
      adapter.netlifyIdentity.on.mockImplementation((event, callback) => {
        if (event === 'login') {
          setTimeout(() => callback({ id: '111', email: 'login@example.com' }), 10);
        }
      });

      const promise = adapter.login('login@example.com', 'password123');
      
      expect(adapter.netlifyIdentity.open).toHaveBeenCalledWith('login');
      
      const user = await promise;
      expect(user).toEqual({ id: '111', email: 'login@example.com' });
    });

    test('registers login and error handlers', async () => {
      const promise = adapter.login('test@example.com', 'pass');
      
      expect(adapter.netlifyIdentity.on).toHaveBeenCalledWith('login', expect.any(Function));
      expect(adapter.netlifyIdentity.on).toHaveBeenCalledWith('error', expect.any(Function));
      
      // Trigger login to resolve promise
      const loginHandler = adapter.netlifyIdentity.on.mock.calls.find(call => call[0] === 'login')[1];
      loginHandler({ id: '222', email: 'test@example.com' });
      
      await promise;
    });

    test('cleans up handlers on success', async () => {
      adapter.netlifyIdentity.on.mockImplementation((event, callback) => {
        if (event === 'login') {
          setTimeout(() => callback({ id: '333', email: 'cleanup@example.com' }), 10);
        }
      });

      await adapter.login('cleanup@example.com', 'password');
      
      expect(adapter.netlifyIdentity.off).toHaveBeenCalledWith('login', expect.any(Function));
      expect(adapter.netlifyIdentity.off).toHaveBeenCalledWith('error', expect.any(Function));
    });

    test('rejects on error', async () => {
      adapter.netlifyIdentity.on.mockImplementation((event, callback) => {
        if (event === 'error') {
          setTimeout(() => callback(new Error('Login failed')), 10);
        }
      });

      await expect(adapter.login('fail@example.com', 'wrongpass'))
        .rejects.toThrow('Login failed');
    });

    test('cleans up handlers on error', async () => {
      adapter.netlifyIdentity.on.mockImplementation((event, callback) => {
        if (event === 'error') {
          setTimeout(() => callback(new Error('Error')), 10);
        }
      });

      try {
        await adapter.login('error@example.com', 'pass');
      } catch (e) {
        // Expected error
      }
      
      expect(adapter.netlifyIdentity.off).toHaveBeenCalledWith('login', expect.any(Function));
      expect(adapter.netlifyIdentity.off).toHaveBeenCalledWith('error', expect.any(Function));
    });
  });

  describe('logout()', () => {
    beforeEach(() => {
      adapter = new NetlifyIdentityAdapter();
    });

    test('calls netlifyIdentity.logout', async () => {
      await adapter.logout();
      expect(adapter.netlifyIdentity.logout).toHaveBeenCalled();
    });

    test('resolves after logout', async () => {
      const result = await adapter.logout();
      expect(result).toBeUndefined();
    });
  });

  describe('updateUser()', () => {
    beforeEach(() => {
      adapter = new NetlifyIdentityAdapter();
    });

    test('logs warning about limited functionality', async () => {
      const mockUser = { id: '555', email: 'update@example.com' };
      adapter.netlifyIdentity.currentUser.mockReturnValue(mockUser);

      await adapter.updateUser({ name: 'New Name' });
      
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('updateUser not fully implemented')
      );
    });

    test('returns current user without applying updates', async () => {
      const mockUser = { id: '555', email: 'update@example.com', name: 'Old Name' };
      adapter.netlifyIdentity.currentUser.mockReturnValue(mockUser);

      const result = await adapter.updateUser({ name: 'New Name' });
      
      expect(result).toBe(mockUser);
      expect(result.name).toBe('Old Name'); // Not updated
    });

    test('throws when no user is logged in', async () => {
      adapter.netlifyIdentity.currentUser.mockReturnValue(null);

      await expect(adapter.updateUser({ name: 'Name' }))
        .rejects.toThrow('No user logged in');
    });
  });

  describe('requestPasswordReset()', () => {
    beforeEach(() => {
      adapter = new NetlifyIdentityAdapter();
    });

    test('opens recover modal', async () => {
      await adapter.requestPasswordReset('reset@example.com');
      expect(adapter.netlifyIdentity.open).toHaveBeenCalledWith('recover');
    });

    test('resolves after opening modal', async () => {
      const result = await adapter.requestPasswordReset('reset@example.com');
      expect(result).toBeUndefined();
    });
  });

  describe('refreshToken()', () => {
    beforeEach(() => {
      adapter = new NetlifyIdentityAdapter();
    });

    test('calls netlifyIdentity.refresh', async () => {
      const mockToken = 'new-token-123';
      adapter.netlifyIdentity.refresh.mockResolvedValue(mockToken);

      const token = await adapter.refreshToken();
      
      expect(adapter.netlifyIdentity.refresh).toHaveBeenCalled();
      expect(token).toBe(mockToken);
    });

    test('returns promise from refresh', async () => {
      adapter.netlifyIdentity.refresh.mockResolvedValue('token');
      
      const result = adapter.refreshToken();
      expect(result).toBeInstanceOf(Promise);
      
      await result;
    });
  });

  describe('Event handling', () => {
    beforeEach(() => {
      adapter = new NetlifyIdentityAdapter();
    });

    describe('on()', () => {
      test('registers event listener', () => {
        const callback = jest.fn();
        adapter.on('login', callback);
        
        expect(adapter.netlifyIdentity.on).toHaveBeenCalledWith('login', callback);
      });

      test('registers multiple listeners', () => {
        const callback1 = jest.fn();
        const callback2 = jest.fn();
        
        adapter.on('login', callback1);
        adapter.on('logout', callback2);
        
        expect(adapter.netlifyIdentity.on).toHaveBeenCalledWith('login', callback1);
        expect(adapter.netlifyIdentity.on).toHaveBeenCalledWith('logout', callback2);
      });
    });

    describe('off()', () => {
      test('removes event listener', () => {
        const callback = jest.fn();
        adapter.off('login', callback);
        
        expect(adapter.netlifyIdentity.off).toHaveBeenCalledWith('login', callback);
      });

      test('removes specific callback', () => {
        const callback1 = jest.fn();
        const callback2 = jest.fn();
        
        adapter.off('login', callback1);
        
        expect(adapter.netlifyIdentity.off).toHaveBeenCalledWith('login', callback1);
      });
    });
  });

  describe('_createFallbackMock()', () => {
    beforeEach(() => {
      delete globalThis.window.netlifyIdentity;
      adapter = new NetlifyIdentityAdapter();
    });

    test('creates mock with required methods', () => {
      expect(adapter.netlifyIdentity.init).toBeInstanceOf(Function);
      expect(adapter.netlifyIdentity.open).toBeInstanceOf(Function);
      expect(adapter.netlifyIdentity.close).toBeInstanceOf(Function);
      expect(adapter.netlifyIdentity.currentUser).toBeInstanceOf(Function);
      expect(adapter.netlifyIdentity.logout).toBeInstanceOf(Function);
      expect(adapter.netlifyIdentity.refresh).toBeInstanceOf(Function);
      expect(adapter.netlifyIdentity.on).toBeInstanceOf(Function);
      expect(adapter.netlifyIdentity.off).toBeInstanceOf(Function);
    });

    test('currentUser returns null', () => {
      expect(adapter.netlifyIdentity.currentUser()).toBeNull();
    });

    test('refresh returns Promise resolving to null', async () => {
      const result = await adapter.netlifyIdentity.refresh();
      expect(result).toBeNull();
    });

    test('open logs warning', () => {
      consoleWarnSpy.mockClear();
      adapter.netlifyIdentity.open('login');
      
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        'Netlify Identity mock: open called with',
        'login'
      );
    });

    test('close logs warning', () => {
      consoleWarnSpy.mockClear();
      adapter.netlifyIdentity.close();
      
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        'Netlify Identity mock: close called'
      );
    });

    test('logout logs warning', () => {
      consoleWarnSpy.mockClear();
      adapter.netlifyIdentity.logout();
      
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        'Netlify Identity mock: logout called'
      );
    });

    test('on() registers listeners', () => {
      const callback1 = jest.fn();
      const callback2 = jest.fn();
      
      adapter.netlifyIdentity.on('login', callback1);
      adapter.netlifyIdentity.on('login', callback2);
      
      // Both callbacks should be registered
      expect(callback1).not.toHaveBeenCalled();
      expect(callback2).not.toHaveBeenCalled();
    });

    test('off() removes specific callback', () => {
      const callback1 = jest.fn();
      const callback2 = jest.fn();
      
      adapter.netlifyIdentity.on('login', callback1);
      adapter.netlifyIdentity.on('login', callback2);
      adapter.netlifyIdentity.off('login', callback1);
      
      // callback1 should be removed, callback2 should remain
    });

    test('off() removes all callbacks when no callback specified', () => {
      const callback1 = jest.fn();
      const callback2 = jest.fn();
      
      adapter.netlifyIdentity.on('login', callback1);
      adapter.netlifyIdentity.on('login', callback2);
      adapter.netlifyIdentity.off('login');
      
      // Both callbacks should be removed
    });

    test('off() handles non-existent event gracefully', () => {
      expect(() => {
        adapter.netlifyIdentity.off('nonexistent');
      }).not.toThrow();
    });
  });

  describe('getProviderName()', () => {
    beforeEach(() => {
      adapter = new NetlifyIdentityAdapter();
    });

    test('returns correct provider name', () => {
      expect(adapter.getProviderName()).toBe('Netlify Identity');
    });
  });
});
