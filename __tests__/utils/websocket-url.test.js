/**
 * Unit tests for websocket-url.js
 * 
 * Tests WebSocket URL construction for Mumble server connections.
 * Critical for preventing connection failures due to malformed URLs.
 */

import { describe, test, expect } from '@jest/globals';
import { buildWebSocketUrl } from '../../app/utils/websocket-url.js';

describe('buildWebSocketUrl', () => {
  describe('Standard Port Formats', () => {
    test.each([
      // [host, port, expected]
      ['mumble.example.com', '64738', 'ws://mumble.example.com:64738'],
      ['example.com', 64738, 'ws://example.com:64738'],
      ['secure.example.com', '443', 'wss://secure.example.com'],
      ['secure.example.com', 443, 'wss://secure.example.com'],
      ['example.com', '80', 'ws://example.com'],
      ['example.com', 80, 'ws://example.com'],
      ['localhost', '64738', 'ws://localhost:64738'],
      ['localhost', '443', 'wss://localhost'],
      ['localhost', 443, 'wss://localhost'],
      ['192.168.1.1', '64738', 'ws://192.168.1.1:64738'],
      ['10.0.0.1', '443', 'wss://10.0.0.1'],
    ])('should build URL: %s:%s → %s', (host, port, expected) => {
      expect(buildWebSocketUrl(host, port)).toBe(expected);
    });
  });

  describe('Port with Path Format', () => {
    test.each([
      // [host, port, expected]
      ['example.com', '443/murmur', 'wss://example.com/murmur'],
      ['example.com', '443/ws/path', 'wss://example.com/ws/path'],
      ['example.com', '80/murmur', 'ws://example.com/murmur'],
      ['example.com', '8080/murmur', 'ws://example.com:8080/murmur'],
      ['example.com', '8443/murmur', 'ws://example.com:8443/murmur'],
      ['example.com', '443/api/v1/mumble', 'wss://example.com/api/v1/mumble'],
      ['example.com', '8080/ws/mumble/prod', 'ws://example.com:8080/ws/mumble/prod'],
      ['example.com', '443/path/', 'wss://example.com/path/'],
    ])('should build URL with path: %s:%s → %s', (host, port, expected) => {
      expect(buildWebSocketUrl(host, port)).toBe(expected);
    });
  });

  describe('Protocol Selection', () => {
    test.each([
      // [description, host, port, expectedProtocol]
      ['secure port 443', 'example.com', '443', 'wss://'],
      ['secure port 443 with path', 'example.com', '443/path', 'wss://'],
      ['non-standard port 64738', 'example.com', '64738', 'ws://'],
      ['non-standard port 8080', 'example.com', '8080', 'ws://'],
      ['port 80', 'example.com', '80', 'ws://'],
      ['port 80 with path', 'example.com', '80/path', 'ws://'],
    ])('should use correct protocol for %s', (desc, host, port, protocol) => {
      expect(buildWebSocketUrl(host, port)).toContain(protocol);
    });
  });

  describe('Input Type Handling', () => {
    test.each([
      // [description, host, port, expected]
      ['port as string', 'example.com', '64738', 'ws://example.com:64738'],
      ['port as number', 'example.com', 64738, 'ws://example.com:64738'],
      ['numeric port with path (string)', 'example.com', '443/path', 'wss://example.com/path'],
    ])('should accept %s', (desc, host, port, expected) => {
      expect(buildWebSocketUrl(host, port)).toBe(expected);
    });
  });

  describe('Edge Cases', () => {
    test.each([
      // [description, host, port, expected]
      ['empty path after port', 'example.com', '443/', 'wss://example.com/'],
      ['single character path', 'example.com', '443/w', 'wss://example.com/w'],
      ['subdomains', 'mumble.voice.example.com', '64738', 'ws://mumble.voice.example.com:64738'],
      ['long paths', 'example.com', '443/api/v2/websocket/mumble/production/region-us-east', 'wss://example.com/api/v2/websocket/mumble/production/region-us-east'],
      ['numeric hostnames', '123.456.789', '64738', 'ws://123.456.789:64738'],
    ])('should handle %s', (desc, host, port, expected) => {
      expect(buildWebSocketUrl(host, port)).toBe(expected);
    });
  });

  describe('Real-World Production Scenarios', () => {
    test.each([
      // [description, host, port, expected]
      ['default Mumble server (local)', 'localhost', '64738', 'ws://localhost:64738'],
      ['cloud Mumble behind reverse proxy', 'mumble.cloud.example.com', '443/murmur', 'wss://mumble.cloud.example.com/murmur'],
      ['Kubernetes ingress with path', 'k8s.example.com', '443/services/voice', 'wss://k8s.example.com/services/voice'],
      ['direct connection to Murmur', 'murmur.example.com', '64738', 'ws://murmur.example.com:64738'],
      ['development server', 'localhost', '3000', 'ws://localhost:3000'],
    ])('should handle %s', (desc, host, port, expected) => {
      expect(buildWebSocketUrl(host, port)).toBe(expected);
    });
  });

  describe('URL Safety (Injection Prevention)', () => {
    test.each([
      // [description, host, port, expected]
      ['ports with special characters', 'example.com', '64738?query=param', 'ws://example.com:64738?query=param'],
      ['hostnames with hyphens', 'mumble-server.example.com', '64738', 'ws://mumble-server.example.com:64738'],
      ['paths with URL-safe characters', 'example.com', '443/path-with-hyphens_and_underscores', 'wss://example.com/path-with-hyphens_and_underscores'],
    ])('should handle %s safely', (desc, host, port, expected) => {
      expect(buildWebSocketUrl(host, port)).toBe(expected);
    });
  });
});