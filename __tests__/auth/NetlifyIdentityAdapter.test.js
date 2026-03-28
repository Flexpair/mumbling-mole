/**
 * Characterization tests for NetlifyIdentityAdapter
 * Tests the Netlify Identity widget wrapper functionality
 */

import { jest } from '@jest/globals';

let NetlifyIdentityAdapter;
let adapter;
let consoleWarnSpy;
let mockNetlifyIdentity;

function createMockNetlifyIdentity() {
  return {
    init: jest.fn(),
    open: jest.fn(),
    close: jest.fn(),
    currentUser: jest.fn().mockReturnValue(null),
    logout: jest.fn(),
    refresh: jest.fn().mockResolvedValue(null),
    on: jest.fn(),
    off: jest.fn()
  };
}

async function setupTestEnvironment() {
  jest.clearAllMocks();
  mockNetlifyIdentity = createMockNetlifyIdentity();
  consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
  globalThis.window = globalThis.window || {};
  globalThis.window.netlifyIdentity = mockNetlifyIdentity;
  const module = await import('../../app/auth/NetlifyIdentityAdapter.js');
  NetlifyIdentityAdapter = module.default;
}

async function createInitializedAdapter() {
  adapter = new NetlifyIdentityAdapter();
  await adapter.init();
  return adapter;
}

describe('NetlifyIdentityAdapter', () => {
  beforeEach(setupTestEnvironment);

  afterEach(() => {
    consoleWarnSpy.mockRestore();
    delete globalThis.netlifyIdentity;
  });

  test('constructor starts with null netlifyIdentity before init', () => {
    adapter = new NetlifyIdentityAdapter();
    expect(adapter.netlifyIdentity).toBeNull();
    expect(adapter._initialized).toBe(false);
  });
});

describe('NetlifyIdentityAdapter - init()', () => {
  beforeEach(setupTestEnvironment);

  afterEach(() => {
    consoleWarnSpy.mockRestore();
    delete globalThis.netlifyIdentity;
  });

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
    
    const promise1 = adapter.init();
    const promise2 = adapter.init();
    
    await Promise.all([promise1, promise2]);
    
    expect(adapter._initialized).toBe(true);
  });

  test('waits for widget to appear if not immediately available', async () => {
    delete globalThis.netlifyIdentity;
    
    adapter = new NetlifyIdentityAdapter();
    
    const initPromise = adapter.init();
    
    setTimeout(() => {
      globalThis.netlifyIdentity = mockNetlifyIdentity;
    }, 100);
    
    await initPromise;
    
    expect(adapter.netlifyIdentity).toBe(mockNetlifyIdentity);
  });
});

describe('NetlifyIdentityAdapter - on() before init', () => {
  beforeEach(setupTestEnvironment);

  afterEach(() => {
    consoleWarnSpy.mockRestore();
    delete globalThis.netlifyIdentity;
  });

  test('queues handler if called before init()', async () => {
    adapter = new NetlifyIdentityAdapter();
    
    const callback = jest.fn();
    adapter.on('login', callback);
    
    expect(adapter._pendingHandlers).toHaveLength(1);
    expect(adapter._pendingHandlers[0]).toEqual({ event: 'login', callback });
    
    await adapter.init();
    
    expect(adapter._pendingHandlers).toHaveLength(0);
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

describe('NetlifyIdentityAdapter - off() before init', () => {
  beforeEach(setupTestEnvironment);

  afterEach(() => {
    consoleWarnSpy.mockRestore();
    delete globalThis.netlifyIdentity;
  });

  test('removes from pending handlers if called before init()', () => {
    adapter = new NetlifyIdentityAdapter();
    
    const callback = jest.fn();
    adapter.on('login', callback);
    
    expect(adapter._pendingHandlers).toHaveLength(1);
    
    adapter.off('login', callback);
    
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
    
    expect(adapter._pendingHandlers).toHaveLength(1);
    expect(adapter._pendingHandlers[0].callback).toBe(callback2);
  });

  test('off on non-existing pending handler does nothing', () => {
    adapter = new NetlifyIdentityAdapter();
    
    const callback1 = jest.fn();
    const callback2 = jest.fn();
    adapter.on('login', callback1);
    
    adapter.off('login', callback2);
    
    expect(adapter._pendingHandlers).toHaveLength(1);
    expect(adapter._pendingHandlers[0].callback).toBe(callback1);
  });
});

describe('NetlifyIdentityAdapter - getCurrentUser()', () => {
  beforeEach(async () => {
    await setupTestEnvironment();
    await createInitializedAdapter();
  });

  afterEach(() => {
    consoleWarnSpy.mockRestore();
    delete globalThis.netlifyIdentity;
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

describe('NetlifyIdentityAdapter - currentUser() sync version', () => {
  beforeEach(async () => {
    await setupTestEnvironment();
    await createInitializedAdapter();
  });

  afterEach(() => {
    consoleWarnSpy.mockRestore();
    delete globalThis.netlifyIdentity;
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

describe('NetlifyIdentityAdapter - openAuth()', () => {
  beforeEach(async () => {
    await setupTestEnvironment();
    await createInitializedAdapter();
  });

  afterEach(() => {
    consoleWarnSpy.mockRestore();
    delete globalThis.netlifyIdentity;
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

describe('NetlifyIdentityAdapter - open() backward compatibility', () => {
  beforeEach(async () => {
    await setupTestEnvironment();
    await createInitializedAdapter();
  });

  afterEach(() => {
    consoleWarnSpy.mockRestore();
    delete globalThis.netlifyIdentity;
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

describe('NetlifyIdentityAdapter - closeAuth()', () => {
  beforeEach(async () => {
    await setupTestEnvironment();
    await createInitializedAdapter();
  });

  afterEach(() => {
    consoleWarnSpy.mockRestore();
    delete globalThis.netlifyIdentity;
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

describe('NetlifyIdentityAdapter - close() backward compatibility', () => {
  beforeEach(async () => {
    await setupTestEnvironment();
    await createInitializedAdapter();
  });

  afterEach(() => {
    consoleWarnSpy.mockRestore();
    delete globalThis.netlifyIdentity;
  });

  test('closes the modal', () => {
    adapter.close();
    expect(adapter.netlifyIdentity.close).toHaveBeenCalled();
  });
});

describe('NetlifyIdentityAdapter - signup()', () => {
  beforeEach(async () => {
    await setupTestEnvironment();
    await createInitializedAdapter();
  });

  afterEach(() => {
    consoleWarnSpy.mockRestore();
    delete globalThis.netlifyIdentity;
  });

  test('opens signup modal', async () => {
    const mockUser = { id: '789', email: 'new@example.com' };
    adapter.netlifyIdentity.on.mockImplementation((event, callback) => {
      if (event === 'login') {
        setTimeout(callback, 10, mockUser);
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
    
    const loginHandler = adapter.netlifyIdentity.on.mock.calls.find(call => call[0] === 'login')[1];
    loginHandler({ id: '123', email: 'test@example.com' });
    
    await promise;
  });

  test('cleans up handlers on success', async () => {
    const mockUser = { id: '999', email: 'cleanup@example.com' };
    adapter.netlifyIdentity.on.mockImplementation((event, callback) => {
      if (event === 'login') {
        setTimeout(callback, 10, mockUser);
      }
    });

    await adapter.signup('cleanup@example.com', 'password');
    
    expect(adapter.netlifyIdentity.off).toHaveBeenCalledWith('login', expect.any(Function));
    expect(adapter.netlifyIdentity.off).toHaveBeenCalledWith('error', expect.any(Function));
  });

  test('rejects on error', async () => {
    const signupError = new Error('Signup failed');
    adapter.netlifyIdentity.on.mockImplementation((event, callback) => {
      if (event === 'error') {
        setTimeout(callback, 10, signupError);
      }
    });

    await expect(adapter.signup('fail@example.com', 'pass'))
      .rejects.toThrow('Signup failed');
  });

  test('cleans up handlers on error', async () => {
    const signupError = new Error('Error');
    adapter.netlifyIdentity.on.mockImplementation((event, callback) => {
      if (event === 'error') {
        setTimeout(callback, 10, signupError);
      }
    });

    await expect(adapter.signup('error@example.com', 'pass')).rejects.toThrow();
    
    expect(adapter.netlifyIdentity.off).toHaveBeenCalledWith('login', expect.any(Function));
    expect(adapter.netlifyIdentity.off).toHaveBeenCalledWith('error', expect.any(Function));
  });
});

describe('NetlifyIdentityAdapter - login()', () => {
  beforeEach(async () => {
    await setupTestEnvironment();
    await createInitializedAdapter();
  });

  afterEach(() => {
    consoleWarnSpy.mockRestore();
    delete globalThis.netlifyIdentity;
  });

  test('opens login modal', async () => {
    const mockUser = { id: '111', email: 'login@example.com' };
    adapter.netlifyIdentity.on.mockImplementation((event, callback) => {
      if (event === 'login') {
        setTimeout(callback, 10, mockUser);
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
    
    const loginHandler = adapter.netlifyIdentity.on.mock.calls.find(call => call[0] === 'login')[1];
    loginHandler({ id: '222', email: 'test@example.com' });
    
    await promise;
  });

  test('cleans up handlers on success', async () => {
    const mockUser = { id: '333', email: 'cleanup@example.com' };
    adapter.netlifyIdentity.on.mockImplementation((event, callback) => {
      if (event === 'login') {
        setTimeout(callback, 10, mockUser);
      }
    });

    await adapter.login('cleanup@example.com', 'password');
    
    expect(adapter.netlifyIdentity.off).toHaveBeenCalledWith('login', expect.any(Function));
    expect(adapter.netlifyIdentity.off).toHaveBeenCalledWith('error', expect.any(Function));
  });

  test('rejects on error', async () => {
    const loginError = new Error('Login failed');
    adapter.netlifyIdentity.on.mockImplementation((event, callback) => {
      if (event === 'error') {
        setTimeout(callback, 10, loginError);
      }
    });

    await expect(adapter.login('fail@example.com', 'wrongpass'))
      .rejects.toThrow('Login failed');
  });

  test('cleans up handlers on error', async () => {
    const loginError = new Error('Error');
    adapter.netlifyIdentity.on.mockImplementation((event, callback) => {
      if (event === 'error') {
        setTimeout(callback, 10, loginError);
      }
    });

    await expect(adapter.login('error@example.com', 'pass')).rejects.toThrow();
    
    expect(adapter.netlifyIdentity.off).toHaveBeenCalledWith('login', expect.any(Function));
    expect(adapter.netlifyIdentity.off).toHaveBeenCalledWith('error', expect.any(Function));
  });
});

describe('NetlifyIdentityAdapter - logout()', () => {
  beforeEach(async () => {
    await setupTestEnvironment();
    await createInitializedAdapter();
  });

  afterEach(() => {
    consoleWarnSpy.mockRestore();
    delete globalThis.netlifyIdentity;
  });

  test('calls netlifyIdentity.logout and resolves on logout event', async () => {
    adapter.netlifyIdentity.logout.mockImplementation(() => {
      // Simulate the widget firing the 'logout' event after logout completes
      const logoutCallback = adapter.netlifyIdentity.on.mock.calls.find(c => c[0] === 'logout')[1];
      logoutCallback();
    });
    await adapter.logout();
    expect(adapter.netlifyIdentity.logout).toHaveBeenCalled();
    expect(adapter.netlifyIdentity.off).toHaveBeenCalledWith('logout', expect.any(Function));
  });

  test('resolves after logout', async () => {
    adapter.netlifyIdentity.logout.mockImplementation(() => {
      const logoutCallback = adapter.netlifyIdentity.on.mock.calls.find(c => c[0] === 'logout')[1];
      logoutCallback();
    });
    const result = await adapter.logout();
    expect(result).toBeUndefined();
  });
});

describe('NetlifyIdentityAdapter - updateUser()', () => {
  beforeEach(async () => {
    await setupTestEnvironment();
    await createInitializedAdapter();
  });

  afterEach(() => {
    consoleWarnSpy.mockRestore();
    delete globalThis.netlifyIdentity;
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
    expect(result.name).toBe('Old Name');
  });

  test('throws when no user is logged in', async () => {
    adapter.netlifyIdentity.currentUser.mockReturnValue(null);

    await expect(adapter.updateUser({ name: 'Name' }))
      .rejects.toThrow('No user logged in');
  });
});

describe('NetlifyIdentityAdapter - requestPasswordReset()', () => {
  beforeEach(async () => {
    await setupTestEnvironment();
    await createInitializedAdapter();
  });

  afterEach(() => {
    consoleWarnSpy.mockRestore();
    delete globalThis.netlifyIdentity;
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

describe('NetlifyIdentityAdapter - refreshToken()', () => {
  beforeEach(async () => {
    await setupTestEnvironment();
    await createInitializedAdapter();
  });

  afterEach(() => {
    consoleWarnSpy.mockRestore();
    delete globalThis.netlifyIdentity;
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

describe('NetlifyIdentityAdapter - on() after init', () => {
  beforeEach(async () => {
    await setupTestEnvironment();
    await createInitializedAdapter();
  });

  afterEach(() => {
    consoleWarnSpy.mockRestore();
    delete globalThis.netlifyIdentity;
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

describe('NetlifyIdentityAdapter - off() after init', () => {
  beforeEach(async () => {
    await setupTestEnvironment();
    await createInitializedAdapter();
  });

  afterEach(() => {
    consoleWarnSpy.mockRestore();
    delete globalThis.netlifyIdentity;
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

describe('NetlifyIdentityAdapter - getProviderName()', () => {
  beforeEach(async () => {
    await setupTestEnvironment();
    await createInitializedAdapter();
  });

  afterEach(() => {
    consoleWarnSpy.mockRestore();
    delete globalThis.netlifyIdentity;
  });

  test('returns correct provider name', () => {
    expect(adapter.getProviderName()).toBe('Netlify Identity');
  });
});
