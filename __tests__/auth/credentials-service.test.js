/**
 * @jest-environment jsdom
 * 
 * Tests for credentials-service.js
 * Validates the frontend service that fetches server credentials after auth
 */

import { jest } from '@jest/globals';

// Mock fetch before importing the module
const mockFetch = jest.fn();
global.fetch = mockFetch;

// Import after setting up global.fetch
import {
  fetchCredentials,
  clearCredentials,
  hasCredentials,
  getCachedCredentials
} from '../../app/auth/credentials-service.js';

describe('credentials-service', () => {

  beforeEach(() => {
    mockFetch.mockReset();
    clearCredentials();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('fetchCredentials', () => {
    const validCredentials = {
      mumblePassword: 'test-password',
      guacamoleUser: 'editor',
      guacamolePassword: 'guac-password'
    };

    it('should throw error when no token provided', async () => {
      await expect(fetchCredentials(null)).rejects.toThrow('No authentication token provided');
      await expect(fetchCredentials('')).rejects.toThrow('No authentication token provided');
      await expect(fetchCredentials(undefined)).rejects.toThrow('No authentication token provided');
    });

    it('should fetch credentials with valid token', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(validCredentials)
      });

      const result = await fetchCredentials('valid-jwt-token');

      expect(mockFetch).toHaveBeenCalledWith('/api/credentials', {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer valid-jwt-token',
          'Content-Type': 'application/json'
        }
      });
      expect(result).toEqual(validCredentials);
    });

    it('should cache credentials after successful fetch', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(validCredentials)
      });

      await fetchCredentials('token');
      expect(hasCredentials()).toBe(true);
      expect(getCachedCredentials()).toEqual(validCredentials);

      const cachedResult = await fetchCredentials('token');
      expect(mockFetch).toHaveBeenCalledTimes(1);
      expect(cachedResult).toEqual(validCredentials);
    });

    it('should bypass cache when forceRefresh is true', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(validCredentials)
      });

      await fetchCredentials('token');
      await fetchCredentials('token', { forceRefresh: true });

      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it('should prevent concurrent requests', async () => {
      let resolveFirst;
      const firstPromise = new Promise(resolve => { resolveFirst = resolve; });
      
      mockFetch.mockImplementationOnce(() => 
        firstPromise.then(() => ({
          ok: true,
          json: () => Promise.resolve(validCredentials)
        }))
      );

      const request1 = fetchCredentials('token');
      const request2 = fetchCredentials('token');

      resolveFirst();

      const [result1, result2] = await Promise.all([request1, request2]);

      expect(mockFetch).toHaveBeenCalledTimes(1);
      expect(result1).toEqual(validCredentials);
      expect(result2).toEqual(validCredentials);
    });

    it('should throw error on 401 response', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: () => Promise.resolve({ error: 'Invalid or expired token' })
      });

      await expect(fetchCredentials('bad-token'))
        .rejects.toThrow('Invalid or expired token');
    });

    it('should throw error on 500 response', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: () => Promise.resolve({ error: 'Auth provider misconfigured' })
      });

      await expect(fetchCredentials('token'))
        .rejects.toThrow('Auth provider misconfigured');
    });

    it('should handle network errors', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      await expect(fetchCredentials('token'))
        .rejects.toThrow('Network error');
    });

    it('should handle non-JSON error responses', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 503,
        json: () => Promise.reject(new Error('Not JSON'))
      });

      await expect(fetchCredentials('token'))
        .rejects.toThrow('Failed to fetch credentials: 503');
    });
  });

  describe('clearCredentials', () => {
    it('should clear cached credentials', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ mumblePassword: 'test' })
      });

      await fetchCredentials('token');
      expect(hasCredentials()).toBe(true);

      clearCredentials();
      expect(hasCredentials()).toBe(false);
      expect(getCachedCredentials()).toBeNull();
    });

    it('should allow new fetch after clearing', async () => {
      const creds1 = { mumblePassword: 'first' };
      const creds2 = { mumblePassword: 'second' };

      mockFetch
        .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(creds1) })
        .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(creds2) });

      await fetchCredentials('token');
      expect(getCachedCredentials()).toEqual(creds1);

      clearCredentials();
      await fetchCredentials('token');
      expect(getCachedCredentials()).toEqual(creds2);
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });
  });

  describe('hasCredentials', () => {
    it('should return false initially', () => {
      expect(hasCredentials()).toBe(false);
    });

    it('should return true after successful fetch', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ mumblePassword: 'test' })
      });

      await fetchCredentials('token');
      expect(hasCredentials()).toBe(true);
    });
  });

  describe('getCachedCredentials', () => {
    it('should return null initially', () => {
      expect(getCachedCredentials()).toBeNull();
    });

    it('should return credentials after fetch', async () => {
      const creds = { mumblePassword: 'test', guacamoleUser: 'admin' };
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(creds)
      });

      await fetchCredentials('token');
      expect(getCachedCredentials()).toEqual(creds);
    });
  });
});
