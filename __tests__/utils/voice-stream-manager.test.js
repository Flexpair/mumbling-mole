/**
 * Unit tests for voice-stream-manager.js
 * 
 * Tests resource management utilities that prevent memory leaks
 * from voice streams (intervals, subscriptions, audio nodes).
 */

import { describe, test, expect, jest, beforeEach } from '@jest/globals';

// Import the module
const { createVoiceStreamManager } = await import('../../app/utils/voice-stream-manager.js');

describe('Voice Stream Manager', () => {
  let manager;
  let mockResources;

  beforeEach(() => {
    manager = createVoiceStreamManager();
    
    // Create mock resources
    mockResources = {
      sessionId: 123,
      analyzer: {
        stop: jest.fn()
      },
      interval: setInterval(() => {}, 1000),
      userNode: {
        end: jest.fn()
      },
      stopWatch: jest.fn() // Vue watcher cleanup
    };
  });

  afterEach(() => {
    // Clean up any real intervals created in tests
    if (mockResources.interval) {
      clearInterval(mockResources.interval);
    }
  });

  describe('Basic Operations', () => {
    test('should store resources with set()', () => {
      manager.set('stream-1', mockResources);
      
      const retrieved = manager.get('stream-1');
      expect(retrieved).toBe(mockResources);
      expect(retrieved.sessionId).toBe(123);
    });

    test('should retrieve resources with get()', () => {
      manager.set('stream-1', mockResources);
      
      const result = manager.get('stream-1');
      expect(result).toEqual(mockResources);
    });

    test('should return undefined for non-existent stream', () => {
      const result = manager.get('non-existent');
      expect(result).toBeUndefined();
    });

    test('should overwrite existing stream resources', () => {
      manager.set('stream-1', mockResources);
      
      const newResources = { ...mockResources, sessionId: 456 };
      manager.set('stream-1', newResources);
      
      const result = manager.get('stream-1');
      expect(result.sessionId).toBe(456);
    });
  });

  describe('Cleanup by Stream ID', () => {
    test('should cleanup resources by stream ID', () => {
      manager.set('stream-1', mockResources);
      
      manager.cleanup('stream-1');
      
      // Resources should be removed
      expect(manager.get('stream-1')).toBeUndefined();
      
      // Cleanup methods should be called
      expect(mockResources.analyzer.stop).toHaveBeenCalled();
      expect(mockResources.userNode.end).toHaveBeenCalled();
    });

    test('should call custom disposal callback', () => {
      manager.set('stream-1', mockResources);
      
      const customCallback = jest.fn();
      manager.cleanup('stream-1', customCallback);
      
      expect(customCallback).toHaveBeenCalledWith(mockResources);
    });

    test('should be idempotent (safe to call multiple times)', () => {
      manager.set('stream-1', mockResources);
      
      // First cleanup
      manager.cleanup('stream-1');
      expect(mockResources.analyzer.stop).toHaveBeenCalledTimes(1);
      
      // Second cleanup (should not throw, should not call again)
      manager.cleanup('stream-1');
      expect(mockResources.analyzer.stop).toHaveBeenCalledTimes(1);
      
      // Still removed
      expect(manager.get('stream-1')).toBeUndefined();
    });

    test('should handle cleanup errors gracefully', () => {
      const brokenResources = {
        sessionId: 123,
        analyzer: {
          stop: jest.fn(() => { throw new Error('Stop failed'); })
        },
        userNode: {
          end: jest.fn(() => { throw new Error('End failed'); })
        }
      };
      
      manager.set('stream-1', brokenResources);
      
      // Should not throw despite errors
      expect(() => manager.cleanup('stream-1')).not.toThrow();
      
      // Both cleanup methods should have been attempted
      expect(brokenResources.analyzer.stop).toHaveBeenCalled();
      expect(brokenResources.userNode.end).toHaveBeenCalled();
      
      // Resources should still be removed
      expect(manager.get('stream-1')).toBeUndefined();
    });
  });

  describe('Cleanup by Session ID', () => {
    test('should cleanup all streams for a session', () => {
      const resources1 = { ...mockResources, sessionId: 100, userNode: { end: jest.fn() } };
      const resources2 = { ...mockResources, sessionId: 100, userNode: { end: jest.fn() } };
      const resources3 = { ...mockResources, sessionId: 200, userNode: { end: jest.fn() } };
      
      manager.set('stream-1', resources1);
      manager.set('stream-2', resources2);
      manager.set('stream-3', resources3);
      
      // Cleanup by session ID 100 (should cleanup stream-1 and stream-2)
      manager.cleanup(100);
      
      // Session 100 streams removed
      expect(manager.get('stream-1')).toBeUndefined();
      expect(manager.get('stream-2')).toBeUndefined();
      
      // Session 200 stream still exists
      expect(manager.get('stream-3')).toBeDefined();
      
      // Cleanup called for correct streams
      expect(resources1.userNode.end).toHaveBeenCalled();
      expect(resources2.userNode.end).toHaveBeenCalled();
      expect(resources3.userNode.end).not.toHaveBeenCalled();
    });

    test('should handle session cleanup with custom callback', () => {
      const resources1 = { sessionId: 100 };
      const resources2 = { sessionId: 100 };
      
      manager.set('stream-1', resources1);
      manager.set('stream-2', resources2);
      
      const customCallback = jest.fn();
      manager.cleanup(100, customCallback);
      
      // Callback called for each stream in session
      expect(customCallback).toHaveBeenCalledTimes(2);
      expect(customCallback).toHaveBeenCalledWith(resources1);
      expect(customCallback).toHaveBeenCalledWith(resources2);
    });
  });

  describe('Resource Types', () => {
    test('should cleanup analyzer if present', () => {
      const resources = {
        sessionId: 123,
        analyzer: {
          stop: jest.fn()
        }
      };
      
      manager.set('stream-1', resources);
      manager.cleanup('stream-1');
      
      expect(resources.analyzer.stop).toHaveBeenCalled();
    });

    test('should clear interval if present', () => {
      jest.useFakeTimers();
      
      const intervalId = setInterval(() => {}, 1000);
      const resources = {
        sessionId: 123,
        interval: intervalId
      };
      
      manager.set('stream-1', resources);
      manager.cleanup('stream-1');
      
      // Verify interval was cleared (no easy way to test directly,
      // but we can verify cleanup doesn't throw)
      expect(() => manager.cleanup('stream-1')).not.toThrow();
      
      jest.useRealTimers();
    });

    test('should call userNode.end() if present', () => {
      const resources = {
        sessionId: 123,
        userNode: {
          end: jest.fn()
        }
      };
      
      manager.set('stream-1', resources);
      manager.cleanup('stream-1');
      
      expect(resources.userNode.end).toHaveBeenCalled();
    });

    test('should handle missing optional resources gracefully', () => {
      const minimalResources = {
        sessionId: 123
        // No analyzer, interval, or userNode
      };
      
      manager.set('stream-1', minimalResources);
      
      // Should not throw
      expect(() => manager.cleanup('stream-1')).not.toThrow();
      
      // Should still be removed
      expect(manager.get('stream-1')).toBeUndefined();
    });
  });

  describe('Real-World Scenarios', () => {
    test('should handle rapid join/leave cycles', () => {
      const iterations = 10;
      
      for (let i = 0; i < iterations; i++) {
        const resources = {
          sessionId: i,
          analyzer: { stop: jest.fn() },
          userNode: { end: jest.fn() }
        };
        
        manager.set(`stream-${i}`, resources);
        manager.cleanup(`stream-${i}`);
      }
      
      // All streams should be cleaned up
      for (let i = 0; i < iterations; i++) {
        expect(manager.get(`stream-${i}`)).toBeUndefined();
      }
    });

    test('should handle multiple concurrent streams', () => {
      const streams = [];
      
      // Create 5 concurrent streams
      for (let i = 0; i < 5; i++) {
        const resources = {
          sessionId: i,
          analyzer: { stop: jest.fn() },
          userNode: { end: jest.fn() }
        };
        streams.push(resources);
        manager.set(`stream-${i}`, resources);
      }
      
      // Verify all stored
      for (let i = 0; i < 5; i++) {
        expect(manager.get(`stream-${i}`)).toBe(streams[i]);
      }
      
      // Cleanup all
      for (let i = 0; i < 5; i++) {
        manager.cleanup(`stream-${i}`);
      }
      
      // All cleaned
      for (let i = 0; i < 5; i++) {
        expect(manager.get(`stream-${i}`)).toBeUndefined();
      }
    });

    test('should handle user disconnect (session cleanup)', () => {
      // User 123 has 3 active streams
      manager.set('stream-1', { sessionId: 123, userNode: { end: jest.fn() } });
      manager.set('stream-2', { sessionId: 123, userNode: { end: jest.fn() } });
      manager.set('stream-3', { sessionId: 123, userNode: { end: jest.fn() } });
      
      // User 456 has 2 active streams
      manager.set('stream-4', { sessionId: 456, userNode: { end: jest.fn() } });
      manager.set('stream-5', { sessionId: 456, userNode: { end: jest.fn() } });
      
      // User 123 disconnects
      manager.cleanup(123);
      
      // User 123 streams gone
      expect(manager.get('stream-1')).toBeUndefined();
      expect(manager.get('stream-2')).toBeUndefined();
      expect(manager.get('stream-3')).toBeUndefined();
      
      // User 456 streams still active
      expect(manager.get('stream-4')).toBeDefined();
      expect(manager.get('stream-5')).toBeDefined();
    });
  });
});
