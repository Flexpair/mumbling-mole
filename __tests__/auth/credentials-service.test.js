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

const createMockResponse = (data, ok = true, status = 200) => ({
  ok,
  status,
  json: () => Promise.resolve(data)
});

const createErrorResponse = (status, error) => ({
  ok: false,
  status,
  json: () => Promise.resolve({ error })
});

const createJsonErrorResponse = (status) => ({
  ok: false,
  status,
  json: () => Promise.reject(new Error('Not JSON'))
});

describe('credentials-service', () => {
  const validCredentials = {
    mumblePassword: 'test-password',
    guacamoleUser: 'editor',
    guacamolePassword: 'guac-password'
  };

  beforeEach(() => {
    mockFetch.mockReset();
    clearCredentials();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('fetchCredentials', () => {

    it('should throw error when no token provided', async () => {
      await expect(fetchCredentials(null)).rejects.toThrow('No authentication token provided');
      await expect(fetchCredentials('')).rejects.toThrow('No authentication token provided');
      await expect(fetchCredentials(undefined)).rejects.toThrow('No authentication token provided');
    });

    it('should fetch credentials with valid token', async () => {
      mockFetch.mockResolvedValueOnce(createMockResponse(validCredentials));

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

    it.each([
      ['mumblePassword', { guacamoleUser: 'editor', guacamolePassword: 'guac-password' }],
      ['guacamoleUser', { mumblePassword: 'test-password', guacamolePassword: 'guac-password' }],
      ['guacamolePassword', { mumblePassword: 'test-password', guacamoleUser: 'editor' }],
    ])('should reject credentials missing %s', async (_field, credentials) => {
      mockFetch.mockResolvedValueOnce(createMockResponse(credentials));

      await expect(fetchCredentials('valid-jwt-token'))
        .rejects.toThrow('Credentials response is incomplete');
      expect(hasCredentials()).toBe(false);
    });

    it('should cache credentials after successful fetch', async () => {
      mockFetch.mockResolvedValueOnce(createMockResponse(validCredentials));

      await fetchCredentials('token');
      expect(hasCredentials()).toBe(true);
      expect(getCachedCredentials()).toEqual(validCredentials);

      const cachedResult = await fetchCredentials('token');
      expect(mockFetch).toHaveBeenCalledTimes(1);
      expect(cachedResult).toEqual(validCredentials);
    });

    it('should not reuse credentials for a different token', async () => {
      const firstCredentials = { ...validCredentials, guacamoleUser: 'first-user' };
      const secondCredentials = { ...validCredentials, guacamoleUser: 'second-user' };
      mockFetch
        .mockResolvedValueOnce(createMockResponse(firstCredentials))
        .mockResolvedValueOnce(createMockResponse(secondCredentials));

      await expect(fetchCredentials('token-a')).resolves.toEqual(firstCredentials);
      await expect(fetchCredentials('token-b')).resolves.toEqual(secondCredentials);

      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it('should not share a pending request between different tokens', async () => {
      let resolveFirst;
      const firstResponse = new Promise(resolve => { resolveFirst = resolve; });
      mockFetch
        .mockImplementationOnce(() => firstResponse.then(() => createMockResponse({
          ...validCredentials,
          guacamoleUser: 'first',
        })))
        .mockResolvedValueOnce(createMockResponse({
          ...validCredentials,
          guacamoleUser: 'second',
        }));

      const firstRequest = fetchCredentials('token-a');
      const secondRequest = fetchCredentials('token-b');

      await expect(secondRequest).resolves.toEqual({
        ...validCredentials,
        guacamoleUser: 'second',
      });
      resolveFirst();
      await expect(firstRequest).rejects.toMatchObject({
        code: 'CREDENTIALS_REQUEST_SUPERSEDED'
      });
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it('should mask a stale request failure after the auth token changes', async () => {
      let rejectFirst;
      mockFetch
        .mockImplementationOnce(() => new Promise((_resolve, reject) => {
          rejectFirst = reject;
        }))
        .mockResolvedValueOnce(createMockResponse(validCredentials));

      const firstRequest = fetchCredentials('token-a');
      await expect(fetchCredentials('token-b')).resolves.toEqual(validCredentials);
      rejectFirst(new Error('old request failed'));

      await expect(firstRequest).rejects.toMatchObject({
        code: 'CREDENTIALS_REQUEST_SUPERSEDED'
      });
    });

    it('should reject an in-flight request invalidated by clearCredentials', async () => {
      let resolveFetch;
      mockFetch.mockImplementationOnce(() => new Promise(resolve => {
        resolveFetch = resolve;
      }));

      const request = fetchCredentials('token');
      clearCredentials();
      resolveFetch(createMockResponse(validCredentials));

      await expect(request).rejects.toMatchObject({
        code: 'CREDENTIALS_REQUEST_SUPERSEDED'
      });
      expect(getCachedCredentials()).toBeNull();
    });

    it('should bypass cache when forceRefresh is true', async () => {
      mockFetch.mockResolvedValue(createMockResponse(validCredentials));

      await fetchCredentials('token');
      await fetchCredentials('token', { forceRefresh: true });

      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it('should prevent concurrent requests', async () => {
      let resolveFirst;
      const firstPromise = new Promise(resolve => { resolveFirst = resolve; });
      const delayedResponse = firstPromise.then(() => createMockResponse(validCredentials));
      mockFetch.mockImplementationOnce(() => delayedResponse);

      const request1 = fetchCredentials('token');
      const request2 = fetchCredentials('token');

      resolveFirst();

      const [result1, result2] = await Promise.all([request1, request2]);

      expect(mockFetch).toHaveBeenCalledTimes(1);
      expect(result1).toEqual(validCredentials);
      expect(result2).toEqual(validCredentials);
    });

    it('should throw error on 401 response', async () => {
      mockFetch.mockResolvedValueOnce(createErrorResponse(401, 'Invalid or expired token'));

      await expect(fetchCredentials('bad-token'))
        .rejects.toThrow('Invalid or expired token');
    });

    it('should throw error on 500 response', async () => {
      mockFetch.mockResolvedValueOnce(createErrorResponse(500, 'Auth provider misconfigured'));

      await expect(fetchCredentials('token'))
        .rejects.toThrow('Auth provider misconfigured');
    });

    it('should handle network errors', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      await expect(fetchCredentials('token'))
        .rejects.toThrow('Network error');
    });

    it('should handle non-JSON error responses', async () => {
      mockFetch.mockResolvedValueOnce(createJsonErrorResponse(503));

      await expect(fetchCredentials('token'))
        .rejects.toThrow('Failed to fetch credentials: 503');
    });
  });

  describe('clearCredentials', () => {
    it('should clear cached credentials', async () => {
      mockFetch.mockResolvedValueOnce(createMockResponse(validCredentials));

      await fetchCredentials('token');
      expect(hasCredentials()).toBe(true);

      clearCredentials();
      expect(hasCredentials()).toBe(false);
      expect(getCachedCredentials()).toBeNull();
    });

    it('should allow new fetch after clearing', async () => {
      const creds1 = { ...validCredentials, mumblePassword: 'first' };
      const creds2 = { ...validCredentials, mumblePassword: 'second' };

      mockFetch
        .mockResolvedValueOnce(createMockResponse(creds1))
        .mockResolvedValueOnce(createMockResponse(creds2));

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
      mockFetch.mockResolvedValueOnce(createMockResponse(validCredentials));

      await fetchCredentials('token');
      expect(hasCredentials()).toBe(true);
    });

    it('should return false after cache TTL expires', async () => {
      const originalDateNow = Date.now;
      let currentTime = 1000000;
      Date.now = jest.fn(() => currentTime);
      
      mockFetch.mockResolvedValueOnce(createMockResponse(validCredentials));

      await fetchCredentials('token');
      expect(hasCredentials()).toBe(true);

      // Advance time past 5 minute TTL
      currentTime += 6 * 60 * 1000;
      expect(hasCredentials()).toBe(false);

      Date.now = originalDateNow;
    });

    it('should refetch after cache expires', async () => {
      const originalDateNow = Date.now;
      let currentTime = 1000000;
      Date.now = jest.fn(() => currentTime);
      
      mockFetch.mockResolvedValue(createMockResponse(validCredentials));

      await fetchCredentials('token');
      expect(mockFetch).toHaveBeenCalledTimes(1);

      // Advance time past 5 minute TTL
      currentTime += 6 * 60 * 1000;
      await fetchCredentials('token');
      expect(mockFetch).toHaveBeenCalledTimes(2);

      Date.now = originalDateNow;
    });
  });

  describe('getCachedCredentials', () => {
    it('should return null initially', () => {
      expect(getCachedCredentials()).toBeNull();
    });

    it('should return credentials after fetch', async () => {
      const creds = { ...validCredentials, guacamoleUser: 'admin' };
      mockFetch.mockResolvedValueOnce(createMockResponse(creds));

      await fetchCredentials('token');
      expect(getCachedCredentials()).toEqual(creds);
    });
  });
});
