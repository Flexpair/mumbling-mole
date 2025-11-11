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
    test('should build URL with custom port', () => {
      expect(buildWebSocketUrl('mumble.example.com', '64738'))
        .toBe('ws://mumble.example.com:64738');
      
      expect(buildWebSocketUrl('example.com', 64738))
        .toBe('ws://example.com:64738');
    });

    test('should use wss:// protocol for port 443', () => {
      expect(buildWebSocketUrl('secure.example.com', '443'))
        .toBe('wss://secure.example.com');
      
      expect(buildWebSocketUrl('secure.example.com', 443))
        .toBe('wss://secure.example.com');
    });

    test('should use ws:// protocol for port 80', () => {
      expect(buildWebSocketUrl('example.com', '80'))
        .toBe('ws://example.com');
      
      expect(buildWebSocketUrl('example.com', 80))
        .toBe('ws://example.com');
    });

    test('should omit standard ports (443, 80)', () => {
      // Port 443 is standard for wss
      expect(buildWebSocketUrl('secure.example.com', '443'))
        .toBe('wss://secure.example.com');
      
      // Port 80 is standard for ws
      expect(buildWebSocketUrl('plain.example.com', '80'))
        .toBe('ws://plain.example.com');
    });

    test('should handle localhost', () => {
      expect(buildWebSocketUrl('localhost', '64738'))
        .toBe('ws://localhost:64738');
      
      expect(buildWebSocketUrl('localhost', '443'))
        .toBe('wss://localhost');
      
      expect(buildWebSocketUrl('localhost', 443))
        .toBe('wss://localhost');
    });

    test('should handle IP addresses', () => {
      expect(buildWebSocketUrl('192.168.1.1', '64738'))
        .toBe('ws://192.168.1.1:64738');
      
      expect(buildWebSocketUrl('10.0.0.1', '443'))
        .toBe('wss://10.0.0.1');
    });
  });

  describe('Port with Path Format', () => {
    test('should handle port 443 with path', () => {
      expect(buildWebSocketUrl('example.com', '443/murmur'))
        .toBe('wss://example.com/murmur');
      
      expect(buildWebSocketUrl('example.com', '443/ws/path'))
        .toBe('wss://example.com/ws/path');
    });

    test('should handle port 80 with path', () => {
      expect(buildWebSocketUrl('example.com', '80/murmur'))
        .toBe('ws://example.com/murmur');
    });

    test('should handle custom port with path', () => {
      expect(buildWebSocketUrl('example.com', '8080/murmur'))
        .toBe('ws://example.com:8080/murmur');
      
      expect(buildWebSocketUrl('example.com', '8443/murmur'))
        .toBe('ws://example.com:8443/murmur');
    });

    test('should handle multi-segment paths', () => {
      expect(buildWebSocketUrl('example.com', '443/api/v1/mumble'))
        .toBe('wss://example.com/api/v1/mumble');
      
      expect(buildWebSocketUrl('example.com', '8080/ws/mumble/prod'))
        .toBe('ws://example.com:8080/ws/mumble/prod');
    });

    test('should handle paths with trailing slashes', () => {
      // buildWebSocketUrl adds one slash, path contains rest
      expect(buildWebSocketUrl('example.com', '443/path/'))
        .toBe('wss://example.com/path/');
    });
  });

  describe('Protocol Selection', () => {
    test('should use wss:// for secure ports (443)', () => {
      expect(buildWebSocketUrl('example.com', '443')).toContain('wss://');
      expect(buildWebSocketUrl('example.com', '443/path')).toContain('wss://');
    });

    test('should use ws:// for non-standard ports', () => {
      expect(buildWebSocketUrl('example.com', '64738')).toContain('ws://');
      expect(buildWebSocketUrl('example.com', '8080')).toContain('ws://');
    });

    test('should use ws:// for port 80', () => {
      expect(buildWebSocketUrl('example.com', '80')).toContain('ws://');
      expect(buildWebSocketUrl('example.com', '80/path')).toContain('ws://');
    });
  });

  describe('Input Type Handling', () => {
    test('should accept port as string', () => {
      expect(buildWebSocketUrl('example.com', '64738'))
        .toBe('ws://example.com:64738');
    });

    test('should accept port as number', () => {
      expect(buildWebSocketUrl('example.com', 64738))
        .toBe('ws://example.com:64738');
    });

    test('should handle numeric port with path (string only)', () => {
      expect(buildWebSocketUrl('example.com', '443/path'))
        .toBe('wss://example.com/path');
    });
  });

  describe('Edge Cases', () => {
    test('should handle empty path after port', () => {
      // "443/" → wss://example.com/
      expect(buildWebSocketUrl('example.com', '443/'))
        .toBe('wss://example.com/');
    });

    test('should handle single character path', () => {
      expect(buildWebSocketUrl('example.com', '443/w'))
        .toBe('wss://example.com/w');
    });

    test('should handle subdomains', () => {
      expect(buildWebSocketUrl('mumble.voice.example.com', '64738'))
        .toBe('ws://mumble.voice.example.com:64738');
    });

    test('should handle long paths', () => {
      const longPath = 'api/v2/websocket/mumble/production/region-us-east';
      expect(buildWebSocketUrl('example.com', `443/${longPath}`))
        .toBe(`wss://example.com/${longPath}`);
    });

    test('should handle numeric hostnames', () => {
      // Rare but valid
      expect(buildWebSocketUrl('123.456.789', '64738'))
        .toBe('ws://123.456.789:64738');
    });
  });

  describe('Real-World Production Scenarios', () => {
    test('should handle default Mumble server (local)', () => {
      expect(buildWebSocketUrl('localhost', '64738'))
        .toBe('ws://localhost:64738');
    });

    test('should handle cloud Mumble behind reverse proxy', () => {
      // Reverse proxy on 443 with path
      expect(buildWebSocketUrl('mumble.cloud.example.com', '443/murmur'))
        .toBe('wss://mumble.cloud.example.com/murmur');
    });

    test('should handle Kubernetes ingress with path', () => {
      expect(buildWebSocketUrl('k8s.example.com', '443/services/voice'))
        .toBe('wss://k8s.example.com/services/voice');
    });

    test('should handle direct connection to Murmur', () => {
      expect(buildWebSocketUrl('murmur.example.com', '64738'))
        .toBe('ws://murmur.example.com:64738');
    });

    test('should handle development server', () => {
      expect(buildWebSocketUrl('localhost', '3000'))
        .toBe('ws://localhost:3000');
    });
  });

  describe('URL Safety (Injection Prevention)', () => {
    test('should handle ports with special characters safely', () => {
      // These are invalid ports but shouldn't break URL construction
      // (validation should happen at connection layer, not URL builder)
      expect(buildWebSocketUrl('example.com', '64738?query=param'))
        .toBe('ws://example.com:64738?query=param');
    });

    test('should handle hostnames with hyphens', () => {
      expect(buildWebSocketUrl('mumble-server.example.com', '64738'))
        .toBe('ws://mumble-server.example.com:64738');
    });

    test('should handle paths with URL-safe characters', () => {
      expect(buildWebSocketUrl('example.com', '443/path-with-hyphens_and_underscores'))
        .toBe('wss://example.com/path-with-hyphens_and_underscores');
    });
  });
});
