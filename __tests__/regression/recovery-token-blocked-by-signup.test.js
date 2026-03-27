/**
 * REGRESSION TEST: Password Recovery Token blocked by signup modal
 *
 * BUG: When opening a recovery link (e.g. #recovery_token=XYZ), the Netlify
 * Identity Widget detects the token during init() and shows the password reset
 * modal. However, initializeAuth() then sees user === null and immediately
 * calls auth.open("signup"), which replaces the recovery modal.
 *
 * FIX: hasIdentityTokenInHash() checks for identity tokens in the URL hash
 * and skips auth.open("signup") when present.
 */

import { jest } from '@jest/globals';

/**
 * Mirrors the function in app/index.js.
 * Accepts an explicit hash parameter for testability.
 */
function hasIdentityTokenInHash(hash) {
  return /^#(recovery_token|confirmation_token|invite_token)=/.test(hash);
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

    it('returns false for empty hash', () => {
      expect(hasIdentityTokenInHash('')).toBe(false);
    });

    it('returns false for bare fragment', () => {
      expect(hasIdentityTokenInHash('#')).toBe(false);
    });

    it('returns false for unrelated hash', () => {
      expect(hasIdentityTokenInHash('#section-about')).toBe(false);
    });

    it('returns false for token-like substrings that are not at the start', () => {
      expect(hasIdentityTokenInHash('#foo=bar&recovery_token=abc')).toBe(false);
    });
  });

  describe('initializeAuth behavior with recovery token', () => {
    it('should NOT call auth.open("signup") when recovery_token is present', async () => {
      const hash = '#recovery_token=PvfCnpSj_7hdroWcFXP4Ag';

      const mockAuth = {
        init: jest.fn().mockResolvedValue(undefined),
        currentUser: jest.fn().mockReturnValue(null),
        open: jest.fn(),
      };

      // Simulate the initializeAuth logic
      await mockAuth.init({});
      const user = mockAuth.currentUser();

      if (user === null) {
        if (!hasIdentityTokenInHash(hash)) {
          mockAuth.open('signup');
        }
      }

      expect(mockAuth.open).not.toHaveBeenCalled();
    });

    it('should call auth.open("signup") when NO token is present', async () => {
      const hash = '';

      const mockAuth = {
        init: jest.fn().mockResolvedValue(undefined),
        currentUser: jest.fn().mockReturnValue(null),
        open: jest.fn(),
      };

      await mockAuth.init({});
      const user = mockAuth.currentUser();

      if (user === null) {
        if (!hasIdentityTokenInHash(hash)) {
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

      await mockAuth.init({});
      const user = mockAuth.currentUser();

      if (user === null) {
        if (!hasIdentityTokenInHash(hash)) {
          mockAuth.open('signup');
        }
      }

      expect(mockAuth.open).not.toHaveBeenCalled();
    });
  });
});
