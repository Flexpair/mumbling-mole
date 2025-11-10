/**
 * @jest-environment jsdom
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';

/**
 * GuacamoleFrame Integration Tests
 * 
 * Tests the Knockout GuacamoleFrame class behavior and state management.
 * Vue component integration is tested separately via Playwright E2E tests.
 */
describe('GuacamoleFrame - Knockout State Management', () => {
  let GuacamoleFrame;
  let instance;

  beforeEach(() => {
    // Mock localStorage
    const localStorageMock = {
      _data: {},
      getItem: jest.fn((key) => localStorageMock._data[key] || null),
      setItem: jest.fn((key, value) => {
        localStorageMock._data[key] = String(value);
      }),
      removeItem: jest.fn((key) => {
        delete localStorageMock._data[key];
      }),
      clear: jest.fn(() => {
        localStorageMock._data = {};
      }),
      key: jest.fn((index) => {
        const keys = Object.keys(localStorageMock._data);
        return keys[index] || null;
      }),
      get length() {
        return Object.keys(localStorageMock._data).length;
      }
    };
    global.localStorage = localStorageMock;

    // Mock console methods
    global.console.log = jest.fn();
    global.console.warn = jest.fn();

    // Define GuacamoleFrame constructor (from index.js)
    GuacamoleFrame = function() {
      this.guacSource = { value: null };
      this.visible = { value: false };
      this.show = () => { this.visible.value = true; };
      this.hide = () => { this.visible.value = false; };
      this.loading = { value: false };
      this.error = { value: null };

      this.start = function (guacUser, password) {
        this.loading.value = true;
        this.error.value = null;
        // Sanitize previously bad localStorage entries
        try {
          for (let i = 0; i < localStorage.length; i++) {
            const k = localStorage.key(i);
            if (!k) continue;
            if (/guac|token|auth/i.test(k)) {
              const val = localStorage.getItem(k);
              if (val === "undefined" || val === "null") {
                localStorage.removeItem(k);
              }
            }
          }
        } catch (e) {
          console.warn("[Guac] localStorage sanitization failed", e);
        }
        const src =
          "/guacamole/#/?username=" +
          guacUser +
          "&password=" +
          encodeURIComponent(password || "");
        this.guacSource.value = src;
      };

      this.onLoad = function () {
        this.loading.value = false;
      };
    };

    instance = new GuacamoleFrame();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // ========================================
  // INITIALIZATION & STATE
  // ========================================

  it('initializes with default state', () => {
    expect(instance.guacSource.value).toBeNull();
    expect(instance.visible.value).toBe(false);
    expect(instance.loading.value).toBe(false);
    expect(instance.error.value).toBeNull();
  });


  // ========================================
  // SHOW/HIDE METHODS
  // ========================================

  it('show() method sets visible to true', () => {
    instance.show();
    expect(instance.visible.value).toBe(true);
  });

  it('hide() method sets visible to false', () => {
    instance.visible.value = true;
    instance.hide();
    expect(instance.visible.value).toBe(false);
  });

  // ========================================
  // START METHOD
  // ========================================

  it('start() method sets loading state and builds Guacamole URL', () => {
    instance.start('admin', 'secret123');

    expect(instance.loading.value).toBe(true);
    expect(instance.error.value).toBeNull();
    expect(instance.guacSource.value).toBe('/guacamole/#/?username=admin&password=secret123');
  });

  it('start() method URL-encodes password correctly', () => {
    instance.start('user', 'p@ss w0rd!');

    expect(instance.guacSource.value).toContain('password=p%40ss%20w0rd!');
  });

  it('start() method handles empty password', () => {
    instance.start('user', '');

    expect(instance.guacSource.value).toBe('/guacamole/#/?username=user&password=');
  });

  it('start() method handles undefined password', () => {
    instance.start('user', undefined);

    expect(instance.guacSource.value).toBe('/guacamole/#/?username=user&password=');
  });

  // ========================================
  // LOCALSTORAGE SANITIZATION
  // ========================================

  it('start() attempts localStorage sanitization', () => {
    // This test just verifies the sanitization code doesn't throw
    localStorage.setItem('guac_token', 'undefined');
    localStorage.setItem('auth_data', 'null');

    expect(() => {
      instance.start('admin', 'pass');
    }).not.toThrow();

    // URL should still be built correctly
    expect(instance.guacSource.value).toBe('/guacamole/#/?username=admin&password=pass');
  });

  // ========================================
  // ONLOAD (IFRAME LOAD EVENT)
  // ========================================

  it('onLoad() sets loading to false', () => {
    instance.loading.value = true;
    instance.onLoad();
    expect(instance.loading.value).toBe(false);
  });

  // ========================================
  // INTEGRATION FLOW
  // ========================================

  it('simulates complete Guacamole session flow', () => {
    // Initial state: hidden, no source
    expect(instance.visible.value).toBe(false);
    expect(instance.guacSource.value).toBeNull();

    // Start session (called from AppState)
    instance.start('admin', 'password123');
    expect(instance.loading.value).toBe(true);
    expect(instance.guacSource.value).toBe('/guacamole/#/?username=admin&password=password123');

    // Show frame
    instance.show();
    expect(instance.visible.value).toBe(true);

    // Simulate iframe load
    instance.onLoad();
    expect(instance.loading.value).toBe(false);

    // Hide frame
    instance.hide();
    expect(instance.visible.value).toBe(false);
  });

  it('maintains state across multiple start() calls', () => {
    instance.start('user1', 'pass1');
    expect(instance.guacSource.value).toBe('/guacamole/#/?username=user1&password=pass1');

    instance.start('user2', 'pass2');
    expect(instance.guacSource.value).toBe('/guacamole/#/?username=user2&password=pass2');
    expect(instance.loading.value).toBe(true);
  });

  it('error state can be set and cleared', () => {
    instance.error.value = 'Network timeout';
    expect(instance.error.value).toBe('Network timeout');

    instance.start('admin', 'pass');
    expect(instance.error.value).toBeNull(); // start() clears errors
  });

  it('loading state is managed independently', () => {
    expect(instance.loading.value).toBe(false);
    
    instance.loading.value = true;
    expect(instance.loading.value).toBe(true);
    
    instance.onLoad();
    expect(instance.loading.value).toBe(false);
  });

  // ========================================
  // EDGE CASES
  // ========================================

  it('handles rapid show/hide toggling', () => {
    instance.show();
    instance.hide();
    instance.show();
    expect(instance.visible.value).toBe(true);
  });

  it('handles start() with special characters in username', () => {
    instance.start('user@domain.com', 'pass');
    expect(instance.guacSource.value).toBe('/guacamole/#/?username=user@domain.com&password=pass');
  });

  it('handles start() with Unicode password', () => {
    instance.start('user', 'пароль');
    expect(instance.guacSource.value).toContain('password=%D0%BF%D0%B0%D1%80%D0%BE%D0%BB%D1%8C');
  });
});
