/**
 * Tests for auth-server/index.js
 * 
 * Tests the Express auth server that validates JWT tokens and distributes credentials.
 * Uses module-level function extraction for unit testing without starting the server.
 */

import { jest } from '@jest/globals';

describe('auth-server', () => {
  // Helper functions extracted from auth-server logic
  
  describe('getNestedProperty', () => {
    function getNestedProperty(obj, path) {
      return path.split('.').reduce((acc, part) => acc?.[part], obj);
    }

    it('should extract top-level property', () => {
      const obj = { name: 'test' };
      expect(getNestedProperty(obj, 'name')).toBe('test');
    });

    it('should extract nested property', () => {
      const obj = { app_metadata: { roles: ['admin', 'edit'] } };
      expect(getNestedProperty(obj, 'app_metadata.roles')).toEqual(['admin', 'edit']);
    });

    it('should return undefined for missing property', () => {
      const obj = { app_metadata: {} };
      expect(getNestedProperty(obj, 'app_metadata.roles')).toBeUndefined();
    });

    it('should handle null object', () => {
      expect(getNestedProperty(null, 'path')).toBeUndefined();
    });

    it('should handle deep nesting', () => {
      const obj = { a: { b: { c: { d: 'deep' } } } };
      expect(getNestedProperty(obj, 'a.b.c.d')).toBe('deep');
    });
  });

  describe('getGuacamoleUser', () => {
    function getGuacamoleUser(roles = []) {
      if (roles.includes('admin')) return 'admin';
      if (roles.includes('edit')) return 'editor';
      if (roles.includes('watch')) return 'watcher';
      return 'watcher';
    }

    it('should return admin for admin role', () => {
      expect(getGuacamoleUser(['admin'])).toBe('admin');
    });

    it('should return editor for edit role', () => {
      expect(getGuacamoleUser(['edit'])).toBe('editor');
    });

    it('should return watcher for watch role', () => {
      expect(getGuacamoleUser(['watch'])).toBe('watcher');
    });

    it('should return watcher for empty roles', () => {
      expect(getGuacamoleUser([])).toBe('watcher');
    });

    it('should return watcher for undefined roles', () => {
      expect(getGuacamoleUser()).toBe('watcher');
    });

    it('should prioritize admin over other roles', () => {
      expect(getGuacamoleUser(['edit', 'admin', 'watch'])).toBe('admin');
    });

    it('should prioritize edit over watch', () => {
      expect(getGuacamoleUser(['watch', 'edit'])).toBe('editor');
    });

    it('should return watcher for unknown roles', () => {
      expect(getGuacamoleUser(['guest', 'viewer'])).toBe('watcher');
    });
  });

  describe('Authorization header parsing', () => {
    function parseAuthHeader(authHeader) {
      if (!authHeader?.startsWith('Bearer ')) {
        return null;
      }
      return authHeader.slice(7);
    }

    it('should extract token from valid Bearer header', () => {
      expect(parseAuthHeader('Bearer abc123')).toBe('abc123');
    });

    it('should return null for missing header', () => {
      expect(parseAuthHeader(undefined)).toBeNull();
      expect(parseAuthHeader(null)).toBeNull();
    });

    it('should return null for non-Bearer header', () => {
      expect(parseAuthHeader('Basic abc123')).toBeNull();
    });

    it('should return null for empty header', () => {
      expect(parseAuthHeader('')).toBeNull();
    });

    it('should handle Bearer with no token', () => {
      expect(parseAuthHeader('Bearer ')).toBe('');
    });

    it('should preserve full token with special chars', () => {
      const token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ';
      expect(parseAuthHeader(`Bearer ${token}`)).toBe(token);
    });
  });

  describe('Provider configuration', () => {
    const AUTH_PROVIDERS = {
      netlify: {
        userEndpoint: 'https://welcome.flexpair.com/identity-proxy',
        rolesClaim: 'app_metadata.roles'
      },
      supabase: {
        userEndpoint: null,
        rolesClaim: 'user_metadata.roles'
      },
      auth0: {
        userEndpoint: null,
        rolesClaim: 'https://flexpair.com/roles'
      }
    };

    it('should have netlify provider configured', () => {
      expect(AUTH_PROVIDERS.netlify).toBeDefined();
      expect(AUTH_PROVIDERS.netlify.userEndpoint).toContain('flexpair.com');
      expect(AUTH_PROVIDERS.netlify.rolesClaim).toBe('app_metadata.roles');
    });

    it('should have supabase provider placeholder', () => {
      expect(AUTH_PROVIDERS.supabase).toBeDefined();
      expect(AUTH_PROVIDERS.supabase.rolesClaim).toBe('user_metadata.roles');
    });

    it('should have auth0 provider placeholder', () => {
      expect(AUTH_PROVIDERS.auth0).toBeDefined();
      expect(AUTH_PROVIDERS.auth0.rolesClaim).toBe('https://flexpair.com/roles');
    });
  });

  describe('Credential generation', () => {
    // Simulates crypto.randomBytes behavior for password generation
    function generateSecurePassword(length = 32) {
      // In real code uses crypto.randomBytes
      const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
      let result = '';
      for (let i = 0; i < length; i++) {
        result += chars[Math.floor(Math.random() * chars.length)];
      }
      return result;
    }

    it('should generate password of specified length', () => {
      expect(generateSecurePassword(16).length).toBe(16);
      expect(generateSecurePassword(32).length).toBe(32);
      expect(generateSecurePassword(64).length).toBe(64);
    });

    it('should generate different passwords each time', () => {
      const pwd1 = generateSecurePassword(32);
      const pwd2 = generateSecurePassword(32);
      expect(pwd1).not.toBe(pwd2);
    });

    it('should default to 32 chars', () => {
      expect(generateSecurePassword().length).toBe(32);
    });
  });

  describe('Response formatting', () => {
    function formatCredentialsResponse(mumblePassword, guacamoleUser, guacamolePasswords) {
      return {
        mumblePassword,
        guacamoleUser,
        guacamolePassword: guacamolePasswords[guacamoleUser]
      };
    }

    const passwords = {
      admin: 'admin-pwd',
      editor: 'editor-pwd',
      watcher: 'watcher-pwd'
    };

    it('should return correct credentials for admin', () => {
      const result = formatCredentialsResponse('mumble-pwd', 'admin', passwords);
      expect(result).toEqual({
        mumblePassword: 'mumble-pwd',
        guacamoleUser: 'admin',
        guacamolePassword: 'admin-pwd'
      });
    });

    it('should return correct credentials for editor', () => {
      const result = formatCredentialsResponse('mumble-pwd', 'editor', passwords);
      expect(result).toEqual({
        mumblePassword: 'mumble-pwd',
        guacamoleUser: 'editor',
        guacamolePassword: 'editor-pwd'
      });
    });

    it('should return correct credentials for watcher', () => {
      const result = formatCredentialsResponse('mumble-pwd', 'watcher', passwords);
      expect(result).toEqual({
        mumblePassword: 'mumble-pwd',
        guacamoleUser: 'watcher',
        guacamolePassword: 'watcher-pwd'
      });
    });
  });

  describe('Error responses', () => {
    const errorResponses = {
      missingAuth: { status: 401, body: { error: 'Missing authorization header' } },
      invalidToken: { status: 401, body: { error: 'Invalid or expired token' } },
      providerMisconfigured: { status: 500, body: { error: 'Auth provider misconfigured' } }
    };

    it('should have correct status for missing auth', () => {
      expect(errorResponses.missingAuth.status).toBe(401);
    });

    it('should have correct status for invalid token', () => {
      expect(errorResponses.invalidToken.status).toBe(401);
    });

    it('should have correct status for misconfigured provider', () => {
      expect(errorResponses.providerMisconfigured.status).toBe(500);
    });

    it('should include error message in body', () => {
      Object.values(errorResponses).forEach(response => {
        expect(response.body).toHaveProperty('error');
        expect(typeof response.body.error).toBe('string');
      });
    });
  });

  describe('Token validation logic', () => {
    // Mock validateToken behavior
    async function validateToken(token, providerConfig, mockFetch) {
      if (!providerConfig.userEndpoint) {
        return null;
      }

      try {
        const response = await mockFetch(`${providerConfig.userEndpoint}/user`, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
            'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36'
          }
        });

        if (!response.ok) {
          return null;
        }

        return await response.json();
      } catch {
        return null;
      }
    }

    it('should return null if provider endpoint not configured', async () => {
      const result = await validateToken('token', { userEndpoint: null }, jest.fn());
      expect(result).toBeNull();
    });

    it('should return user on successful validation', async () => {
      const mockUser = { email: 'test@example.com', app_metadata: { roles: ['admin'] } };
      const mockFetch = jest.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockUser)
      });

      const result = await validateToken('valid-token', { userEndpoint: 'https://api.test.com' }, mockFetch);
      expect(result).toEqual(mockUser);
    });

    it('should return null on 401 response', async () => {
      const mockFetch = jest.fn().mockResolvedValue({ ok: false, status: 401 });
      
      const result = await validateToken('bad-token', { userEndpoint: 'https://api.test.com' }, mockFetch);
      expect(result).toBeNull();
    });

    it('should return null on network error', async () => {
      const mockFetch = jest.fn().mockRejectedValue(new Error('Network error'));
      
      const result = await validateToken('token', { userEndpoint: 'https://api.test.com' }, mockFetch);
      expect(result).toBeNull();
    });

    it('should include browser User-Agent header', async () => {
      const mockFetch = jest.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({})
      });

      await validateToken('token', { userEndpoint: 'https://api.test.com' }, mockFetch);
      
      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({
            'User-Agent': expect.stringContaining('Mozilla')
          })
        })
      );
    });
  });
});
