/**
 * REGRESSION TEST: Password Recovery Token blocked by signup modal / connect dialog
 *
 * BUG #1: When opening a recovery link (e.g. #recovery_token=XYZ), the widget
 * detects the token during init() and shows the password reset modal.  However
 * initializeAuth() then sees user === null and calls auth.open("signup"),
 * which replaces the recovery modal.
 *
 * BUG #2: When a user already has a session (localStorage) and opens a recovery
 * link, auth.currentUser() is non-null so the code jumps to the else-branch
 * and shows the connect dialog — hiding the recovery modal.
 *
 * FIX: Identity tokens take priority.  When a token is present and init
 * succeeded, skip both signup and connect dialog so the widget can handle
 * the token (password reset, email confirmation, invite acceptance).
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

/**
 * Simulates the initializeAuth() logic from app/index.js.
 * Returns { connectVisible } to verify behavior.
 */
async function simulateInitializeAuth(mockAuth, hash) {
  const hadIdentityToken = hasIdentityTokenInHash(hash);
  const result = { connectVisible: undefined };

  let initSucceeded = false;
  try {
    await mockAuth.init({});
    initSucceeded = true;
  } catch {
    // init failed
  }
  let user = null;
  if (initSucceeded) {
    user = mockAuth.currentUser();
  }

  if (initSucceeded && hadIdentityToken) {
    result.connectVisible = false;
  } else if (user === null) {
    result.connectVisible = false;
    mockAuth.open('signup');
  } else {
    result.connectVisible = true;
  }

  return result;
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

  describe('initializeAuth behavior', () => {
    it('should let widget handle recovery token (no signup, no connect dialog)', async () => {
      const mockAuth = {
        init: jest.fn().mockResolvedValue(undefined),
        currentUser: jest.fn().mockReturnValue(null),
        open: jest.fn(),
      };

      const result = await simulateInitializeAuth(mockAuth, '#recovery_token=PvfCnpSj_7hdroWcFXP4Ag');

      expect(mockAuth.open).not.toHaveBeenCalled();
      expect(result.connectVisible).toBe(false);
    });

    it('should let widget handle recovery token even when user is already logged in', async () => {
      const mockAuth = {
        init: jest.fn().mockResolvedValue(undefined),
        currentUser: jest.fn().mockReturnValue({ user_metadata: { full_name: 'Test User' } }),
        open: jest.fn(),
      };

      const result = await simulateInitializeAuth(mockAuth, '#recovery_token=IKhPWdwOwPi-c5hbx-yxJA');

      expect(mockAuth.open).not.toHaveBeenCalled();
      expect(result.connectVisible).toBe(false);
    });

    it('should fall back to signup when token is present but init FAILED', async () => {
      const mockAuth = {
        init: jest.fn().mockRejectedValue(new Error('network error')),
        currentUser: jest.fn().mockReturnValue(null),
        open: jest.fn(),
      };

      await simulateInitializeAuth(mockAuth, '#recovery_token=PvfCnpSj_7hdroWcFXP4Ag');

      expect(mockAuth.open).toHaveBeenCalledWith('signup');
    });

    it('should open signup when no token and no user', async () => {
      const mockAuth = {
        init: jest.fn().mockResolvedValue(undefined),
        currentUser: jest.fn().mockReturnValue(null),
        open: jest.fn(),
      };

      await simulateInitializeAuth(mockAuth, '');

      expect(mockAuth.open).toHaveBeenCalledWith('signup');
    });

    it('should show connect dialog when no token and user is authenticated', async () => {
      const mockAuth = {
        init: jest.fn().mockResolvedValue(undefined),
        currentUser: jest.fn().mockReturnValue({ user_metadata: { full_name: 'Test User' } }),
        open: jest.fn(),
      };

      const result = await simulateInitializeAuth(mockAuth, '');

      expect(mockAuth.open).not.toHaveBeenCalled();
      expect(result.connectVisible).toBe(true);
    });
  });
});
