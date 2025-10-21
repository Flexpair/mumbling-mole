/**
 * @jest-environment jsdom
 */

import { jest } from '@jest/globals';
import getUserMedia from '../../app/audio/getusermedia.js';

describe('getusermedia', () => {
  let mockGetUserMedia;

  beforeEach(() => {
    // Create mock getUserMedia
    mockGetUserMedia = jest.fn();
    
    // Always ensure navigator.mediaDevices exists
    if (!global.navigator) {
      global.navigator = {};
    }
    if (!global.navigator.mediaDevices) {
      global.navigator.mediaDevices = {};
    }
    global.navigator.mediaDevices.getUserMedia = mockGetUserMedia;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Argument handling', () => {
    test('should use default constraints when only callback provided', (done) => {
      mockGetUserMedia.mockResolvedValue({ id: 'mock-stream' });

      getUserMedia((err, stream) => {
        expect(err).toBeNull();
        expect(stream).toEqual({ id: 'mock-stream' });
        expect(mockGetUserMedia).toHaveBeenCalledWith({ video: true, audio: true });
        done();
      });
    });

    test('should use provided constraints when both arguments given', (done) => {
      const constraints = { video: false, audio: { echoCancellation: true } };
      mockGetUserMedia.mockResolvedValue({ id: 'mock-stream' });

      getUserMedia(constraints, (err, stream) => {
        expect(err).toBeNull();
        expect(stream).toEqual({ id: 'mock-stream' });
        expect(mockGetUserMedia).toHaveBeenCalledWith(constraints);
        done();
      });
    });
  });

  describe('Success cases', () => {
    test('should return stream on success with both audio and video', (done) => {
      const mockStream = { 
        id: 'stream-1',
        getTracks: () => [{ kind: 'audio' }, { kind: 'video' }]
      };
      mockGetUserMedia.mockResolvedValue(mockStream);

      getUserMedia({ video: true, audio: true }, (err, stream) => {
        expect(err).toBeNull();
        expect(stream).toBe(mockStream);
        done();
      });
    });

    test('should return stream on success with audio only', (done) => {
      const mockStream = { 
        id: 'stream-audio',
        getTracks: () => [{ kind: 'audio' }]
      };
      mockGetUserMedia.mockResolvedValue(mockStream);

      getUserMedia({ video: false, audio: true }, (err, stream) => {
        expect(err).toBeNull();
        expect(stream).toBe(mockStream);
        done();
      });
    });

    test('should return stream on success with video only', (done) => {
      const mockStream = { 
        id: 'stream-video',
        getTracks: () => [{ kind: 'video' }]
      };
      mockGetUserMedia.mockResolvedValue(mockStream);

      getUserMedia({ video: true, audio: false }, (err, stream) => {
        expect(err).toBeNull();
        expect(stream).toBe(mockStream);
        done();
      });
    });
  });

  describe('Error handling - Permission denied', () => {
    test('should handle string error "PermissionDeniedError"', (done) => {
      mockGetUserMedia.mockRejectedValue('PermissionDeniedError');

      getUserMedia({ video: true, audio: true }, (err, stream) => {
        expect(stream).toBeUndefined();
        expect(err).toBeInstanceOf(Error);
        expect(err.name).toBe('PermissionDeniedError');
        expect(err.message).toBe('MediaStreamError');
        done();
      });
    });

    test('should handle string error "PERMISSION_DENIED"', (done) => {
      mockGetUserMedia.mockRejectedValue('PERMISSION_DENIED');

      getUserMedia({ video: true, audio: true }, (err, stream) => {
        expect(stream).toBeUndefined();
        expect(err).toBeInstanceOf(Error);
        expect(err.name).toBe('PermissionDeniedError');
        expect(err.message).toBe('MediaStreamError');
        done();
      });
    });

    test('should handle error object with PermissionDeniedError property (Chrome style)', (done) => {
      // Create error-like object with PermissionDeniedError property but no name
      const chromeError = {
        message: 'Permission denied',
        PermissionDeniedError: true,
        toString: () => 'Error: Permission denied'
      };

      mockGetUserMedia.mockRejectedValue(chromeError);

      getUserMedia({ video: true, audio: true }, (err, stream) => {
        expect(stream).toBeUndefined();
        expect(err.name).toBe('PermissionDeniedError');
        done();
      });
    });

    test('should handle error object with PermissionDeniedError name', (done) => {
      const error = new Error('User denied permission');
      error.name = 'PermissionDeniedError';

      mockGetUserMedia.mockRejectedValue(error);

      getUserMedia({ video: true, audio: true }, (err, stream) => {
        expect(stream).toBeUndefined();
        expect(err).toBe(error);
        expect(err.name).toBe('PermissionDeniedError');
        done();
      });
    });
  });

  describe('Error handling - Constraint not satisfied', () => {
    test('should handle string error as ConstraintNotSatisfiedError (not denied)', (done) => {
      mockGetUserMedia.mockRejectedValue('SomeOtherError');

      getUserMedia({ video: true, audio: true }, (err, stream) => {
        expect(stream).toBeUndefined();
        expect(err).toBeInstanceOf(Error);
        expect(err.name).toBe('ConstraintNotSatisfiedError');
        expect(err.message).toBe('MediaStreamError');
        done();
      });
    });

    test('should handle error object without name as ConstraintNotSatisfiedError', (done) => {
      // Create error-like object without name property
      const error = {
        message: 'Constraint error',
        toString: () => 'Error: Constraint error'
      };

      mockGetUserMedia.mockRejectedValue(error);

      getUserMedia({ video: true, audio: true }, (err, stream) => {
        expect(stream).toBeUndefined();
        expect(err.name).toBe('ConstraintNotSatisfiedError');
        done();
      });
    });

    test('should preserve error object with existing name', (done) => {
      const error = new Error('Constraint error');
      error.name = 'OverconstrainedError';

      mockGetUserMedia.mockRejectedValue(error);

      getUserMedia({ video: true, audio: true }, (err, stream) => {
        expect(stream).toBeUndefined();
        expect(err).toBe(error);
        expect(err.name).toBe('OverconstrainedError');
        done();
      });
    });
  });

  describe('Browser support validation', () => {
    test('should return NotSupportedError when navigator is undefined', (done) => {
      // Save and clear navigator
      const savedNavigator = global.navigator;
      delete global.navigator;

      getUserMedia({ video: true, audio: true }, (err, stream) => {
        expect(stream).toBeUndefined();
        expect(err).toBeInstanceOf(Error);
        expect(err.name).toBe('NotSupportedError');
        expect(err.message).toBe('MediaStreamError');
        
        // Restore navigator
        global.navigator = savedNavigator;
        done();
      });
    });

    test('should call callback asynchronously for NotSupportedError', (done) => {
      // Save and clear navigator
      const savedNavigator = global.navigator;
      delete global.navigator;
      
      let callbackCalled = false;

      getUserMedia({ video: true, audio: true }, (err) => {
        callbackCalled = true;
        expect(err.name).toBe('NotSupportedError');
        
        // Restore navigator
        global.navigator = savedNavigator;
        done();
      });

      // Callback should not be called synchronously
      expect(callbackCalled).toBe(false);
    });
  });

  describe('Constraint validation', () => {
    test('should return NoMediaRequestedError when no media types requested', (done) => {
      getUserMedia({ video: false, audio: false }, (err, stream) => {
        expect(stream).toBeUndefined();
        expect(err).toBeInstanceOf(Error);
        expect(err.name).toBe('NoMediaRequestedError');
        expect(err.message).toBe('MediaStreamError');
        done();
      });
    });

    test('should call callback asynchronously for NoMediaRequestedError', (done) => {
      let callbackCalled = false;

      getUserMedia({ video: false, audio: false }, (err) => {
        callbackCalled = true;
        expect(err.name).toBe('NoMediaRequestedError');
        done();
      });

      // Callback should not be called synchronously
      expect(callbackCalled).toBe(false);
    });
  });

  describe('Edge cases', () => {
    test('should handle complex audio constraints', (done) => {
      const constraints = {
        video: false,
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: false,
          sampleRate: 48000,
          channelCount: 1
        }
      };
      mockGetUserMedia.mockResolvedValue({ id: 'complex-audio-stream' });

      getUserMedia(constraints, (err, stream) => {
        expect(err).toBeNull();
        expect(stream).toEqual({ id: 'complex-audio-stream' });
        expect(mockGetUserMedia).toHaveBeenCalledWith(constraints);
        done();
      });
    });

    test('should handle complex video constraints', (done) => {
      const constraints = {
        video: {
          width: { ideal: 1920 },
          height: { ideal: 1080 },
          facingMode: 'user'
        },
        audio: false
      };
      mockGetUserMedia.mockResolvedValue({ id: 'complex-video-stream' });

      getUserMedia(constraints, (err, stream) => {
        expect(err).toBeNull();
        expect(stream).toEqual({ id: 'complex-video-stream' });
        expect(mockGetUserMedia).toHaveBeenCalledWith(constraints);
        done();
      });
    });

    test('should handle rejection with undefined error', (done) => {
      const undefinedError = new Error('Unknown error');
      mockGetUserMedia.mockRejectedValue(undefinedError);

      getUserMedia({ video: true, audio: true }, (err, stream) => {
        expect(stream).toBeUndefined();
        expect(err).toBeInstanceOf(Error);
        done();
      });
    });
  });

  describe('Callback behavior', () => {
    test('should call callback with stream after promise resolves', (done) => {
      mockGetUserMedia.mockResolvedValue({ id: 'async-stream' });

      getUserMedia({ video: true, audio: true }, (err, stream) => {
        expect(err).toBeNull();
        expect(stream).toEqual({ id: 'async-stream' });
        done();
      });
    });

    test('should call callback with error after promise rejects', (done) => {
      mockGetUserMedia.mockRejectedValue('PermissionDeniedError');

      getUserMedia({ video: true, audio: true }, (err) => {
        expect(err).not.toBeNull();
        expect(err.name).toBe('PermissionDeniedError');
        done();
      });
    });
  });
});
