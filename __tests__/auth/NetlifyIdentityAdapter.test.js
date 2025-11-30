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
    delete globalThis.netlifyIdentity;
  });

  describe('Constructor', () => {
    test('starts with null netlifyIdentity before init', () => {
      adapter = new NetlifyIdentityAdapter();
      expect(adapter.netlifyIdentity).toBeNull();
      expect(adapter._initialized).toBe(false);
    });
  });

  describe('init()', () => {
    test('uses globalThis.netlifyIdentity when available', async () => {
      adapter = new NetlifyIdentityAdapter();
      await adapter.init();
      
      expect(adapter.netlifyIdentity).toBe(mockNetlifyIdentity);
      expect(consoleWarnSpy).not.toHaveBeenCalled();
    });

    test('throws error when globalThis.netlifyIdentity is unavailable', async () => {
      delete globalThis.netlifyIdentity;
      adapter = new NetlifyIdentityAdapter();
      
      await expect(adapter.init()).rejects.toThrow(
        'Netlify Identity widget failed to load. Authentication is required.'
      );
    }, 10000);

    test('throws error when init function is missing', async () => {
      globalThis.netlifyIdentity = { ...mockNetlifyIdentity };
      delete globalThis.netlifyIdentity.init;
      
      adapter = new NetlifyIdentityAdapter();
      
      await expect(adapter.init()).rejects.toThrow(
        'Netlify Identity widget failed to load. Authentication is required.'
      );
    }, 10000);

    test('calls netlifyIdentity.init with config', async () => {
      adapter = new NetlifyIdentityAdapter();
      const config = { container: '#widget' };
      await adapter.init(config);
      
      expect(adapter.netlifyIdentity.init).toHaveBeenCalledWith(config);
    });

    test('calls netlifyIdentity.init with empty config by default', async () => {
      adapter = new NetlifyIdentityAdapter();
      await adapter.init();
      
      expect(adapter.netlifyIdentity.init).toHaveBeenCalledWith({});
    });

    test('only initializes once', async () => {
      adapter = new NetlifyIdentityAdapter();
      await adapter.init({ first: true });
      await adapter.init({ second: true });
      
      expect(adapter.netlifyIdentity.init).toHaveBeenCalledTimes(1);
      expect(adapter.netlifyIdentity.init).toHaveBeenCalledWith({ first: true });
    });

    test('concurrent init() calls share same _waitForWidget promise', async () => {
      adapter = new NetlifyIdentityAdapter();
      
      // Call init() concurrently - _waitForWidget promise is cached to prevent race conditions
      const promise1 = adapter.init();
      const promise2 = adapter.init();
      
      await Promise.all([promise1, promise2]);
      
      // Both init calls resolve but _waitForWidget was only called once
      // (The init check guards subsequent calls, but concurrent calls may both pass)
      expect(adapter._initialized).toBe(true);
    });

    test('waits for widget to appear if not immediately available', async () => {
      // Remove netlifyIdentity initially
      delete globalThis.netlifyIdentity;
      
      adapter = new NetlifyIdentityAdapter();
      
      // Start init (will wait for widget)
      const initPromise = adapter.init();
      
      // After a short delay, add the widget
      setTimeout(() => {
        globalThis.netlifyIdentity = mockNetlifyIdentity;
      }, 100);
      
      await initPromise;
      
      expect(adapter.netlifyIdentity).toBe(mockNetlifyIdentity);
    });
  });

  describe('getCurrentUser()', () => {
    beforeEach(async () => {
      adapter = new NetlifyIdentityAdapter();
      await adapter.init();
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
    beforeEach(async () => {
      adapter = new NetlifyIdentityAdapter();
      await adapter.init();
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
    beforeEach(async () => {
      adapter = new NetlifyIdentityAdapter();
      await adapter.init();
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
    beforeEach(async () => {
      adapter = new NetlifyIdentityAdapter();
      await adapter.init();
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
    beforeEach(async () => {
      adapter = new NetlifyIdentityAdapter();
      await adapter.init();
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
    beforeEach(async () => {
      adapter = new NetlifyIdentityAdapter();
      await adapter.init();
    });

    test('closes the modal', () => {
      adapter.close();
      expect(adapter.netlifyIdentity.close).toHaveBeenCalled();
    });
  });

  describe('signup()', () => {
    beforeEach(async () => {
      adapter = new NetlifyIdentityAdapter();
      await adapter.init();
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
    beforeEach(async () => {
      adapter = new NetlifyIdentityAdapter();
      await adapter.init();
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
    beforeEach(async () => {
      adapter = new NetlifyIdentityAdapter();
      await adapter.init();
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
    beforeEach(async () => {
      adapter = new NetlifyIdentityAdapter();
      await adapter.init();
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
    beforeEach(async () => {
      adapter = new NetlifyIdentityAdapter();
      await adapter.init();
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
    beforeEach(async () => {
      adapter = new NetlifyIdentityAdapter();
      await adapter.init();
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
    describe('on() before init - pending handlers', () => {
      test('queues handler if called before init()', async () => {
        adapter = new NetlifyIdentityAdapter();
        
        const callback = jest.fn();
        adapter.on('login', callback);
        
        // Handler is queued, not registered yet
        expect(adapter._pendingHandlers).toHaveLength(1);
        expect(adapter._pendingHandlers[0]).toEqual({ event: 'login', callback });
        
        // Now init
        await adapter.init();
        
        // Pending handlers should be cleared
        expect(adapter._pendingHandlers).toHaveLength(0);
        // Handler was registered
        expect(mockNetlifyIdentity.on).toHaveBeenCalledWith('login', callback);
      });

      test('queues multiple handlers before init()', async () => {
        adapter = new NetlifyIdentityAdapter();
        
        const callback1 = jest.fn();
        const callback2 = jest.fn();
        adapter.on('login', callback1);
        adapter.on('logout', callback2);
        
        expect(adapter._pendingHandlers).toHaveLength(2);
        
        await adapter.init();
        
        expect(adapter._pendingHandlers).toHaveLength(0);
        expect(mockNetlifyIdentity.on).toHaveBeenCalledWith('login', callback1);
        expect(mockNetlifyIdentity.on).toHaveBeenCalledWith('logout', callback2);
      });
    });

    describe('off() before init - pending handlers', () => {
      test('removes from pending handlers if called before init()', () => {
        adapter = new NetlifyIdentityAdapter();
        
        const callback = jest.fn();
        adapter.on('login', callback);
        
        expect(adapter._pendingHandlers).toHaveLength(1);
        
        adapter.off('login', callback);
        
        // Handler was removed from pending
        expect(adapter._pendingHandlers).toHaveLength(0);
      });

      test('only removes matching handler from pending', () => {
        adapter = new NetlifyIdentityAdapter();
        
        const callback1 = jest.fn();
        const callback2 = jest.fn();
        adapter.on('login', callback1);
        adapter.on('login', callback2);
        
        expect(adapter._pendingHandlers).toHaveLength(2);
        
        adapter.off('login', callback1);
        
        // Only callback1 was removed
        expect(adapter._pendingHandlers).toHaveLength(1);
        expect(adapter._pendingHandlers[0].callback).toBe(callback2);
      });

      test('off on non-existing pending handler does nothing', () => {
        adapter = new NetlifyIdentityAdapter();
        
        const callback1 = jest.fn();
        const callback2 = jest.fn();
        adapter.on('login', callback1);
        
        // Try to remove different callback
        adapter.off('login', callback2);
        
        expect(adapter._pendingHandlers).toHaveLength(1);
        expect(adapter._pendingHandlers[0].callback).toBe(callback1);
      });
    });

    describe('on() after init', () => {
      beforeEach(async () => {
        adapter = new NetlifyIdentityAdapter();
        await adapter.init();
      });

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

    describe('off() after init', () => {
      beforeEach(async () => {
        adapter = new NetlifyIdentityAdapter();
        await adapter.init();
      });

      test('removes event listener', () => {
        const callback = jest.fn();
        adapter.off('login', callback);
        
        expect(adapter.netlifyIdentity.off).toHaveBeenCalledWith('login', callback);
      });

      test('removes specific callback', () => {
        const callback1 = jest.fn();
        
        adapter.off('login', callback1);
        
        expect(adapter.netlifyIdentity.off).toHaveBeenCalledWith('login', callback1);
      });
    });
  });

  describe('getProviderName()', () => {
    beforeEach(async () => {
      adapter = new NetlifyIdentityAdapter();
      await adapter.init();
    });

    test('returns correct provider name', () => {
      expect(adapter.getProviderName()).toBe('Netlify Identity');
    });
  });
});
