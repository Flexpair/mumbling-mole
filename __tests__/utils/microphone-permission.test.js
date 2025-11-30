/**
 * Microphone Permission Tests
 * 
 * Tests for the microphone permission manager utility
 */
import { jest, describe, it, expect, beforeEach, afterEach } from '@jest/globals';

import { createMicrophonePermissionManager } from '../../app/utils/microphone-permission.js';

// Helper to flush promises with fake timers
async function flushPromises() {
  await jest.runAllTimersAsync();
}

describe('createMicrophonePermissionManager', () => {
  let mockGetUserMedia;
  let mockOnGranted;
  let mockOnDenied;
  let mockStream;
  let mockTrack;

  let originalMediaDevices;
  
  beforeEach(() => {
    jest.useFakeTimers();
    
    mockTrack = { stop: jest.fn() };
    mockStream = {
      getTracks: jest.fn(() => [mockTrack]),
    };
    
    mockGetUserMedia = jest.fn().mockResolvedValue(mockStream);
    mockOnGranted = jest.fn();
    mockOnDenied = jest.fn();
    
    // Store original and mock navigator.mediaDevices
    originalMediaDevices = navigator.mediaDevices;
    Object.defineProperty(navigator, 'mediaDevices', {
      value: {
        getUserMedia: mockGetUserMedia,
      },
      configurable: true,
    });
  });

  afterEach(() => {
    jest.useRealTimers();
    // Restore original mediaDevices
    Object.defineProperty(navigator, 'mediaDevices', {
      value: originalMediaDevices,
      configurable: true,
    });
  });

  describe('attemptPermission', () => {
    it('should request microphone permission', async () => {
      const manager = createMicrophonePermissionManager({
        onGranted: mockOnGranted,
        onDenied: mockOnDenied,
      });
      
      manager.attemptPermission();
      await flushPromises();
      
      expect(mockGetUserMedia).toHaveBeenCalledWith({ audio: true });
    });

    it('should call onGranted when permission is granted', async () => {
      const manager = createMicrophonePermissionManager({
        onGranted: mockOnGranted,
        onDenied: mockOnDenied,
      });
      
      manager.attemptPermission();
      await flushPromises();
      
      expect(mockOnGranted).toHaveBeenCalled();
    });

    it('should stop all tracks after permission granted', async () => {
      const manager = createMicrophonePermissionManager({
        onGranted: mockOnGranted,
        onDenied: mockOnDenied,
      });
      
      manager.attemptPermission();
      await flushPromises();
      
      expect(mockTrack.stop).toHaveBeenCalled();
    });

    it('should reset retry count on success', async () => {
      const manager = createMicrophonePermissionManager({
        onGranted: mockOnGranted,
        onDenied: mockOnDenied,
      });
      
      manager.attemptPermission();
      await flushPromises();
      
      expect(manager.getRetryCount()).toBe(0);
    });

    it('should call onDenied for NotAllowedError', async () => {
      mockGetUserMedia.mockRejectedValue({ name: 'NotAllowedError' });
      
      const manager = createMicrophonePermissionManager({
        onGranted: mockOnGranted,
        onDenied: mockOnDenied,
      });
      
      manager.attemptPermission();
      await flushPromises();
      
      expect(mockOnDenied).toHaveBeenCalledWith(
        expect.stringContaining('blocked by the browser')
      );
    });

    it('should call onDenied for SecurityError', async () => {
      mockGetUserMedia.mockRejectedValue({ name: 'SecurityError' });
      
      const manager = createMicrophonePermissionManager({
        onGranted: mockOnGranted,
        onDenied: mockOnDenied,
      });
      
      manager.attemptPermission();
      await flushPromises();
      
      expect(mockOnDenied).toHaveBeenCalled();
    });

    it('should call onDenied for error message containing "denied"', async () => {
      mockGetUserMedia.mockRejectedValue({ 
        name: 'OtherError',
        message: 'Permission denied by user' 
      });
      
      const manager = createMicrophonePermissionManager({
        onGranted: mockOnGranted,
        onDenied: mockOnDenied,
      });
      
      manager.attemptPermission();
      await flushPromises();
      
      expect(mockOnDenied).toHaveBeenCalled();
    });

    it('should handle retry scenario', async () => {
      mockGetUserMedia.mockRejectedValue({ name: 'NotReadableError' });
      
      const manager = createMicrophonePermissionManager({
        onGranted: mockOnGranted,
        onDenied: mockOnDenied,
        retryDelayMs: 1000,
        maxRetryCount: 3,
      });
      
      manager.attemptPermission();
      await flushPromises();
      
      // After flushPromises runs all timers, all 3 retries will have completed
      expect(mockGetUserMedia).toHaveBeenCalledTimes(3);
      expect(mockOnDenied).not.toHaveBeenCalled();
    });

    it('should track retry count', async () => {
      mockGetUserMedia.mockRejectedValue({ name: 'NotReadableError' });
      
      const manager = createMicrophonePermissionManager({
        onGranted: mockOnGranted,
        onDenied: mockOnDenied,
        maxRetryCount: 2,
        retryDelayMs: 100,
      });
      
      manager.attemptPermission();
      await flushPromises();
      
      // After running all timers, we should have reached maxRetryCount
      expect(manager.getRetryCount()).toBe(2);
    });

    it('should not retry for permission-blocked errors', async () => {
      mockGetUserMedia.mockRejectedValue({ name: 'NotAllowedError' });
      
      const manager = createMicrophonePermissionManager({
        onGranted: mockOnGranted,
        onDenied: mockOnDenied,
        retryDelayMs: 100,
      });
      
      manager.attemptPermission();
      await flushPromises();
      
      expect(mockGetUserMedia).toHaveBeenCalledTimes(1);
    });

    it('should handle missing mediaDevices gracefully', () => {
      delete globalThis.navigator.mediaDevices;
      
      const manager = createMicrophonePermissionManager({
        onGranted: mockOnGranted,
        onDenied: mockOnDenied,
      });
      
      expect(() => manager.attemptPermission()).not.toThrow();
      expect(mockOnGranted).not.toHaveBeenCalled();
      expect(mockOnDenied).not.toHaveBeenCalled();
    });

    it('should handle missing getUserMedia gracefully', () => {
      // Override mediaDevices using Object.defineProperty
      Object.defineProperty(navigator, 'mediaDevices', {
        value: {},
        configurable: true,
      });
      
      const manager = createMicrophonePermissionManager({
        onGranted: mockOnGranted,
        onDenied: mockOnDenied,
      });
      
      expect(() => manager.attemptPermission()).not.toThrow();
    });
  });

  describe('retryPermission', () => {
    it('should reset retry count and call onGranted', async () => {
      const manager = createMicrophonePermissionManager({
        onGranted: mockOnGranted,
        onDenied: mockOnDenied,
      });
      
      manager.retryPermission();
      
      expect(mockOnGranted).toHaveBeenCalled();
      
      await flushPromises();
      
      expect(manager.getRetryCount()).toBe(0);
    });

    it('should attempt permission after reset', async () => {
      const manager = createMicrophonePermissionManager({
        onGranted: mockOnGranted,
        onDenied: mockOnDenied,
      });
      
      manager.retryPermission();
      
      expect(mockGetUserMedia).toHaveBeenCalled();
    });
  });

  describe('getRetryCount', () => {
    it('should return 0 initially', () => {
      const manager = createMicrophonePermissionManager({
        onGranted: mockOnGranted,
        onDenied: mockOnDenied,
      });
      
      expect(manager.getRetryCount()).toBe(0);
    });
  });

  describe('Multiple tracks', () => {
    it('should stop all tracks in stream', async () => {
      const track1 = { stop: jest.fn() };
      const track2 = { stop: jest.fn() };
      mockStream.getTracks.mockReturnValue([track1, track2]);
      
      const manager = createMicrophonePermissionManager({
        onGranted: mockOnGranted,
        onDenied: mockOnDenied,
      });
      
      manager.attemptPermission();
      await flushPromises();
      
      expect(track1.stop).toHaveBeenCalled();
      expect(track2.stop).toHaveBeenCalled();
    });
  });
});
