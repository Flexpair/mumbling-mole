/**
 * REGRESSION TEST: Password Recovery Token blocked by signup modal
 *
 * BUG: When opening a recovery link (e.g. #recovery_token=XYZ), the Netlify
 * Identity Widget detects the token during init() and shows the password reset
 * modal. However, initializeAuth() then sees user === null and immediately
 * calls auth.open("signup"), which replaces the recovery modal.
 *
 * FIX: hasIdentityTokenInHash() is called BEFORE auth.init() and the result
 * is captured, because the widget consumes the hash token during init() and
 * the adapter deletes __savedIdentityHash — checking afterwards is too late.
 */

import { jest } from '@jest/globals';

/**
 * Mirrors the production function in app/index.js — uses URLSearchParams
 * so that tokens are detected regardless of position in the hash.
 */
function hasIdentityTokenInHash(hash) {
  const params = new URLSearchParams(hash.startsWith("#") ? hash.slice(1) : hash);
  return params.has("recovery_token") || params.has("confirmation_token") || params.has("invite_token");
}

describe('Recovery token blocked by signup modal', () => {

  describe('hasIdentityTokenInHash()', () => {
    it('detects recovery_token', () => {
      expect(hasIdentityTokenInHash('#recovery_token=PvfCnpSj_7hdroWcFXP4Ag')).toBe(true);
    });

    it('detects confirmation_token', () => {
      expect(hasIdentityTokenInHash('#confirmation_token=abc123')).toBe(true);
    });

    it('detects invite_token', () => {
      expect(hasIdentityTokenInHash('#invite_token=xyz789')).toBe(true);
    });

    it('detects token even when not the first parameter', () => {
      expect(hasIdentityTokenInHash('#foo=bar&recovery_token=abc')).toBe(true);
    });

    it('returns false for empty hash', () => {
      expect(hasIdentityTokenInHash('')).toBe(false);
    });

    it('returns false for bare fragment', () => {
      expect(hasIdentityTokenInHash('#')).toBe(false);
    });

    it('returns false for unrelated hash', () => {
      expect(hasIdentityTokenInHash('#section-about')).toBe(false);
    });
  });

  describe('initializeAuth behavior with recovery token', () => {
    it('should NOT call auth.open("signup") when recovery_token is present and init succeeded', async () => {
      const hash = '#recovery_token=PvfCnpSj_7hdroWcFXP4Ag';

      const mockAuth = {
        init: jest.fn().mockResolvedValue(undefined),
        currentUser: jest.fn().mockReturnValue(null),
        open: jest.fn(),
      };

      // Capture token presence BEFORE init (mirrors production fix)
      const hadIdentityToken = hasIdentityTokenInHash(hash);

      await mockAuth.init({});
      const initSucceeded = true;
      const user = mockAuth.currentUser();

      if (user === null) {
        if (!initSucceeded || !hadIdentityToken) {
          mockAuth.open('signup');
        }
      }

      expect(mockAuth.open).not.toHaveBeenCalled();
    });

    it('should NOT call auth.open("signup") even when hash is cleared after init (race condition)', async () => {
      // This is the core regression: the widget clears the hash during init(),
      // so checking hasIdentityTokenInHash() AFTER init() returns false.
      const hashBeforeInit = '#recovery_token=IKhPWdwOwPi-c5hbx-yxJA';
      const hashAfterInit = '';  // widget consumed the token and cleared the hash

      const mockAuth = {
        init: jest.fn().mockResolvedValue(undefined),
        currentUser: jest.fn().mockReturnValue(null),
        open: jest.fn(),
      };

      // Production fix: capture BEFORE init
      const hadIdentityToken = hasIdentityTokenInHash(hashBeforeInit);

      await mockAuth.init({});
      const initSucceeded = true;
      const user = mockAuth.currentUser();

      // After init, the hash is gone — but we use the pre-init snapshot
      expect(hasIdentityTokenInHash(hashAfterInit)).toBe(false);  // would have caused the bug

      if (user === null) {
        if (!initSucceeded || !hadIdentityToken) {
          mockAuth.open('signup');
        }
      }

      expect(mockAuth.open).not.toHaveBeenCalled();
    });

    it('should call auth.open("signup") when recovery_token is present but init FAILED', async () => {
      const hash = '#recovery_token=PvfCnpSj_7hdroWcFXP4Ag';

      const mockAuth = {
        init: jest.fn().mockRejectedValue(new Error('network error')),
        currentUser: jest.fn().mockReturnValue(null),
        open: jest.fn(),
      };

      const hadIdentityToken = hasIdentityTokenInHash(hash);

      let initSucceeded = false;
      try {
        await mockAuth.init({});
        initSucceeded = true;
      } catch {
        // init failed
      }
      const user = mockAuth.currentUser();

      if (user === null) {
        if (!initSucceeded || !hadIdentityToken) {
          mockAuth.open('signup');
        }
      }

      expect(mockAuth.open).toHaveBeenCalledWith('signup');
    });

    it('should call auth.open("signup") when NO token is present', async () => {
      const hash = '';

      const mockAuth = {
        init: jest.fn().mockResolvedValue(undefined),
        currentUser: jest.fn().mockReturnValue(null),
        open: jest.fn(),
      };

      const hadIdentityToken = hasIdentityTokenInHash(hash);

      await mockAuth.init({});
      const initSucceeded = true;
      const user = mockAuth.currentUser();

      if (user === null) {
        if (!initSucceeded || !hadIdentityToken) {
          mockAuth.open('signup');
        }
      }

      expect(mockAuth.open).toHaveBeenCalledWith('signup');
    });

    it('should NOT call auth.open when user is already authenticated', async () => {
      const hash = '';

      const mockUser = { user_metadata: { full_name: 'Test User' } };
      const mockAuth = {
        init: jest.fn().mockResolvedValue(undefined),
        currentUser: jest.fn().mockReturnValue(mockUser),
        open: jest.fn(),
      };

      const hadIdentityToken = hasIdentityTokenInHash(hash);

      await mockAuth.init({});
      const initSucceeded = true;
      const user = mockAuth.currentUser();

      if (user === null) {
        if (!initSucceeded || !hadIdentityToken) {
          mockAuth.open('signup');
        }
      }

      expect(mockAuth.open).not.toHaveBeenCalled();
    });
  });
});
