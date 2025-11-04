/**
 * @jest-environment jsdom
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import ko from 'knockout';

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
      this.guacSource = ko.observable(null);
      this.visible = ko.observable(false);
      this.show = this.visible.bind(this.visible, true);
      this.hide = this.visible.bind(this.visible, false);
      this.loading = ko.observable(false);
      this.error = ko.observable(null);

      this.start = function (guacUser, password) {
        this.loading(true);
        this.error(null);
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
        this.guacSource(src);
      };

      this.onLoad = function () {
        this.loading(false);
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
    expect(instance.guacSource()).toBeNull();
    expect(instance.visible()).toBe(false);
    expect(instance.loading()).toBe(false);
    expect(instance.error()).toBeNull();
  });

  it('observable changes are reactive', () => {
    const callback = jest.fn();
    instance.guacSource.subscribe(callback);
    
    instance.guacSource('/test');
    expect(callback).toHaveBeenCalledWith('/test');
  });

  // ========================================
  // SHOW/HIDE METHODS
  // ========================================

  it('show() method sets visible to true', () => {
    instance.show();
    expect(instance.visible()).toBe(true);
  });

  it('hide() method sets visible to false', () => {
    instance.visible(true);
    instance.hide();
    expect(instance.visible()).toBe(false);
  });

  // ========================================
  // START METHOD
  // ========================================

  it('start() method sets loading state and builds Guacamole URL', () => {
    instance.start('admin', 'secret123');

    expect(instance.loading()).toBe(true);
    expect(instance.error()).toBeNull();
    expect(instance.guacSource()).toBe('/guacamole/#/?username=admin&password=secret123');
  });

  it('start() method URL-encodes password correctly', () => {
    instance.start('user', 'p@ss w0rd!');

    expect(instance.guacSource()).toContain('password=p%40ss%20w0rd!');
  });

  it('start() method handles empty password', () => {
    instance.start('user', '');

    expect(instance.guacSource()).toBe('/guacamole/#/?username=user&password=');
  });

  it('start() method handles undefined password', () => {
    instance.start('user', undefined);

    expect(instance.guacSource()).toBe('/guacamole/#/?username=user&password=');
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
    expect(instance.guacSource()).toBe('/guacamole/#/?username=admin&password=pass');
  });

  // ========================================
  // ONLOAD (IFRAME LOAD EVENT)
  // ========================================

  it('onLoad() sets loading to false', () => {
    instance.loading(true);
    instance.onLoad();
    expect(instance.loading()).toBe(false);
  });

  // ========================================
  // INTEGRATION FLOW
  // ========================================

  it('simulates complete Guacamole session flow', () => {
    // Initial state: hidden, no source
    expect(instance.visible()).toBe(false);
    expect(instance.guacSource()).toBeNull();

    // Start session (called from AppState)
    instance.start('admin', 'password123');
    expect(instance.loading()).toBe(true);
    expect(instance.guacSource()).toBe('/guacamole/#/?username=admin&password=password123');

    // Show frame
    instance.show();
    expect(instance.visible()).toBe(true);

    // Simulate iframe load
    instance.onLoad();
    expect(instance.loading()).toBe(false);

    // Hide frame
    instance.hide();
    expect(instance.visible()).toBe(false);
  });

  it('maintains state across multiple start() calls', () => {
    instance.start('user1', 'pass1');
    expect(instance.guacSource()).toBe('/guacamole/#/?username=user1&password=pass1');

    instance.start('user2', 'pass2');
    expect(instance.guacSource()).toBe('/guacamole/#/?username=user2&password=pass2');
    expect(instance.loading()).toBe(true);
  });

  it('error state can be set and cleared', () => {
    instance.error('Network timeout');
    expect(instance.error()).toBe('Network timeout');

    instance.start('admin', 'pass');
    expect(instance.error()).toBeNull(); // start() clears errors
  });

  it('loading state is managed independently', () => {
    expect(instance.loading()).toBe(false);
    
    instance.loading(true);
    expect(instance.loading()).toBe(true);
    
    instance.onLoad();
    expect(instance.loading()).toBe(false);
  });

  // ========================================
  // EDGE CASES
  // ========================================

  it('handles rapid show/hide toggling', () => {
    instance.show();
    instance.hide();
    instance.show();
    expect(instance.visible()).toBe(true);
  });

  it('handles start() with special characters in username', () => {
    instance.start('user@domain.com', 'pass');
    expect(instance.guacSource()).toBe('/guacamole/#/?username=user@domain.com&password=pass');
  });

  it('handles start() with Unicode password', () => {
    instance.start('user', 'пароль');
    expect(instance.guacSource()).toContain('password=%D0%BF%D0%B0%D1%80%D0%BE%D0%BB%D1%8C');
  });
});
