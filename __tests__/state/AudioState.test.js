/**
 * Characterization tests for AudioState.js
 * Tests AudioContext management, beeper functionality, and audio lock state
 */

import { jest } from '@jest/globals';
import ko from 'knockout';

// Mock dependencies
const mockEnsureAudioContext = jest.fn();
const mockGetCurrentMixer = jest.fn();
const mockAudioContextManager = {
  getAudioContext: jest.fn(),
  onSuspend: jest.fn(),
  onResume: jest.fn(),
  suspendAudioContext: jest.fn(),
  resumeAudioContext: jest.fn()
};

// Mock modules
jest.unstable_mockModule('../../app/audio/audio-context-manager.js', () => ({
  default: mockAudioContextManager,
  ensureAudioContext: mockEnsureAudioContext
}));

jest.unstable_mockModule('../../app/audio/voice.js', () => ({
  getCurrentMixer: mockGetCurrentMixer
}));

// Import after mocks
const AudioState = (await import('../../app/state/AudioState.js')).default;

describe('AudioState', () => {
  let audioState;
  let mockAudioContext;
  let mockOscillator;
  let mockGainNode;
  
  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();
    
    // Mock navigator.mediaDevices
    globalThis.navigator = globalThis.navigator || {};
    globalThis.navigator.mediaDevices = globalThis.navigator.mediaDevices || {};
    
    // Create mock AudioContext
    mockOscillator = {
      connect: jest.fn(),
      start: jest.fn(),
      stop: jest.fn(),
      frequency: {
        setValueAtTime: jest.fn()
      },
      type: 'sine'
    };
    
    mockGainNode = {
      connect: jest.fn(),
      gain: {
        value: 0,
        setValueAtTime: jest.fn(),
        linearRampToValueAtTime: jest.fn(),
        exponentialRampToValueAtTime: jest.fn(),
        cancelScheduledValues: jest.fn()
      },
      context: {
        state: 'running',
        currentTime: 0,
        resume: jest.fn().mockResolvedValue()
      }
    };
    
    mockAudioContext = {
      state: 'running',
      currentTime: 0,
      sampleRate: 48000,
      destination: { connect: jest.fn() },
      createOscillator: jest.fn(() => mockOscillator),
      createGain: jest.fn(() => mockGainNode),
      resume: jest.fn().mockResolvedValue(),
      suspend: jest.fn().mockResolvedValue(),
      close: jest.fn().mockResolvedValue(),
      audioWorklet: {
        addModule: jest.fn().mockResolvedValue()
      }
    };
    
    // Mock global audioContextManager
    globalThis.window = globalThis.window || {};
    globalThis.window.audioContextManager = mockAudioContextManager;
    globalThis.window.AudioContext = jest.fn(() => mockAudioContext);
    
    mockEnsureAudioContext.mockResolvedValue(mockAudioContext);
    mockAudioContextManager.getAudioContext.mockResolvedValue(mockAudioContext);
  });
  
  afterEach(() => {
    if (audioState) {
      audioState = null;
    }
  });

  describe('Constructor & Initialization', () => {
    test('creates AudioState with default values', () => {
      audioState = new AudioState();
      
      expect(audioState.audioContext).toBeNull();
      expect(audioState.audioLockActive()).toBe(false);
      expect(audioState.audioLockReason()).toBeNull();
      expect(audioState.audioLockDetails()).toBeNull();
      expect(audioState.micPermissionDenied()).toBe(false);
      expect(audioState.micPermissionErrorMessage()).toBe("");
      expect(audioState.isBeeping()).toBe(false);
      expect(audioState.beeperReady()).toBe(false);
    });

    test('initializes observables', () => {
      audioState = new AudioState();
      
      expect(ko.isObservable(audioState.audioLockActive)).toBe(true);
      expect(ko.isObservable(audioState.audioLockReason)).toBe(true);
      expect(ko.isObservable(audioState.audioLockDetails)).toBe(true);
      expect(ko.isObservable(audioState.micPermissionDenied)).toBe(true);
      expect(ko.isObservable(audioState.micPermissionErrorMessage)).toBe(true);
      expect(ko.isObservable(audioState.isBeeping)).toBe(true);
      expect(ko.isObservable(audioState.beeperReady)).toBe(true);
    });

    test('does not auto-initialize AudioContext on construction', () => {
      audioState = new AudioState();
      
      // Constructor should not trigger initialization
      expect(mockEnsureAudioContext).not.toHaveBeenCalled();
      expect(audioState.audioContext).toBeNull();
    });

    test('initializes AudioContext when explicitly called', async () => {
      audioState = new AudioState();
      
      await audioState.initializeAudioContext();
      
      expect(mockEnsureAudioContext).toHaveBeenCalled();
      expect(mockAudioContextManager.onSuspend).toHaveBeenCalled();
      expect(mockAudioContextManager.onResume).toHaveBeenCalled();
    });
  });

  describe('AudioContext Initialization', () => {
    test('initializeAudioContext creates AudioContext', async () => {
      audioState = new AudioState();
      
      await audioState.initializeAudioContext();
      
      expect(audioState.audioContext).toBe(mockAudioContext);
      expect(mockEnsureAudioContext).toHaveBeenCalledWith({
        latencyHint: 'interactive'
      });
    });

    test('initializeAudioContext is idempotent', async () => {
      audioState = new AudioState();
      
      await audioState.initializeAudioContext();
      await audioState.initializeAudioContext();
      await audioState.initializeAudioContext();
      
      // Should only call once
      expect(mockEnsureAudioContext).toHaveBeenCalledTimes(1);
    });

    test('initializeAudioContext handles concurrent calls', async () => {
      audioState = new AudioState();
      
      // Make multiple concurrent calls
      const promises = [
        audioState.initializeAudioContext(),
        audioState.initializeAudioContext(),
        audioState.initializeAudioContext()
      ];
      
      await Promise.all(promises);
      
      // Should still only initialize once
      expect(mockEnsureAudioContext).toHaveBeenCalledTimes(1);
    });

    test('initializeAudioContext handles errors gracefully', async () => {
      mockEnsureAudioContext.mockRejectedValueOnce(new Error('Init failed'));
      
      audioState = new AudioState();
      
      await audioState.initializeAudioContext();
      
      // Should not throw, but log error
      // AudioContext might fall back to legacy
    });

    test('initializeAudioContext falls back to legacy AudioContext', async () => {
      mockEnsureAudioContext.mockRejectedValueOnce(new Error('Init failed'));
      
      const mockLegacyContext = { ...mockAudioContext };
      globalThis.window.AudioContext = jest.fn(() => mockLegacyContext);
      
      audioState = new AudioState();
      await audioState.initializeAudioContext();
      
      expect(globalThis.window.AudioContext).toHaveBeenCalled();
    });
  });

  describe('AudioContext Resume', () => {
    test('resumeAudioContext resumes suspended context', async () => {
      audioState = new AudioState();
      await audioState.initializeAudioContext();
      
      audioState.audioContext.state = 'suspended';
      
      await audioState.resumeAudioContext();
      
      expect(mockAudioContext.resume).toHaveBeenCalled();
    });

    test('resumeAudioContext initializes if no context exists', async () => {
      audioState = new AudioState();
      audioState.audioContext = null;
      
      await audioState.resumeAudioContext();
      
      expect(mockEnsureAudioContext).toHaveBeenCalled();
    });

    test('resumeAudioContext does nothing if already running', async () => {
      audioState = new AudioState();
      await audioState.initializeAudioContext();
      
      mockAudioContext.state = 'running';
      mockAudioContext.resume.mockClear();
      
      await audioState.resumeAudioContext();
      
      expect(mockAudioContext.resume).not.toHaveBeenCalled();
    });
  });

  describe('AudioWorklet Module Loading', () => {
    test('loadAudioWorkletModule loads module', async () => {
      audioState = new AudioState();
      await audioState.initializeAudioContext();
      
      await audioState.loadAudioWorkletModule('test-processor.js');
      
      expect(mockAudioContext.audioWorklet.addModule).toHaveBeenCalledWith('test-processor.js');
    });

    test('loadAudioWorkletModule is idempotent', async () => {
      audioState = new AudioState();
      await audioState.initializeAudioContext();
      
      await audioState.loadAudioWorkletModule('test-processor.js');
      await audioState.loadAudioWorkletModule('test-processor.js');
      
      expect(mockAudioContext.audioWorklet.addModule).toHaveBeenCalledTimes(1);
    });

    test('loadAudioWorkletModule handles InvalidStateError', async () => {
      audioState = new AudioState();
      await audioState.initializeAudioContext();
      
      const error = new Error('Already loaded');
      error.name = 'InvalidStateError';
      mockAudioContext.audioWorklet.addModule.mockRejectedValueOnce(error);
      
      // Should not throw
      await audioState.loadAudioWorkletModule('test-processor.js');
      
      // Second call should be idempotent
      mockAudioContext.audioWorklet.addModule.mockClear();
      await audioState.loadAudioWorkletModule('test-processor.js');
      expect(mockAudioContext.audioWorklet.addModule).not.toHaveBeenCalled();
    });

    test('loadAudioWorkletModule throws on other errors', async () => {
      audioState = new AudioState();
      await audioState.initializeAudioContext();
      
      const error = new Error('Network error');
      error.name = 'NetworkError';
      mockAudioContext.audioWorklet.addModule.mockRejectedValueOnce(error);
      
      await expect(audioState.loadAudioWorkletModule('test-processor.js')).rejects.toThrow('Network error');
    });

    test('loadAudioWorkletModule requires initialized context', async () => {
      audioState = new AudioState();
      audioState.audioContext = null;
      
      await expect(audioState.loadAudioWorkletModule('test.js')).rejects.toThrow('AudioContext not initialized');
    });
  });

  describe('Audio Lock Management', () => {
    test('activateAudioLock sets lock state', () => {
      audioState = new AudioState();
      
      audioState.activateAudioLock('sample-rate', { sampleRate: 44100 });
      
      expect(audioState.audioLockActive()).toBe(true);
      expect(audioState.audioLockReason()).toBe('sample-rate');
      expect(audioState.audioLockDetails()).toEqual({ sampleRate: 44100 });
    });

    test('activateAudioLock works without details', () => {
      audioState = new AudioState();
      
      audioState.activateAudioLock('test-reason');
      
      expect(audioState.audioLockActive()).toBe(true);
      expect(audioState.audioLockReason()).toBe('test-reason');
      expect(audioState.audioLockDetails()).toEqual({});
    });

    test('clearAudioLock clears lock state', () => {
      audioState = new AudioState();
      
      audioState.activateAudioLock('test', { data: 123 });
      audioState.clearAudioLock();
      
      expect(audioState.audioLockActive()).toBe(false);
      expect(audioState.audioLockReason()).toBeNull();
      expect(audioState.audioLockDetails()).toBeNull();
    });

    test('clearAudioLock works with options', () => {
      audioState = new AudioState();
      
      audioState.activateAudioLock('test');
      audioState.clearAudioLock({ resetStates: true });
      
      expect(audioState.audioLockActive()).toBe(false);
    });
  });

  describe('Microphone Permission Handling', () => {
    let mockGetUserMedia;
    
    beforeEach(() => {
      mockGetUserMedia = jest.fn();
      globalThis.navigator.mediaDevices = {
        getUserMedia: mockGetUserMedia
      };
    });

    test('attemptMicrophonePermission calls getUserMedia', () => {
      const mockStream = {
        getTracks: jest.fn(() => [{
          stop: jest.fn()
        }])
      };
      mockGetUserMedia.mockResolvedValue(mockStream);
      
      audioState = new AudioState();
      audioState.attemptMicrophonePermission();
      
      expect(mockGetUserMedia).toHaveBeenCalledWith({ audio: true });
    });

    test('attemptMicrophonePermission handles success', async () => {
      const mockTrack = { stop: jest.fn() };
      const mockStream = {
        getTracks: jest.fn(() => [mockTrack])
      };
      mockGetUserMedia.mockResolvedValue(mockStream);
      
      audioState = new AudioState();
      audioState.micPermissionRetryCount = 2;
      
      // Call and wait for promise
      audioState.attemptMicrophonePermission();
      await new Promise(resolve => setTimeout(resolve, 50));
      
      expect(mockTrack.stop).toHaveBeenCalled();
      expect(audioState.micPermissionRetryCount).toBe(0);
      expect(audioState.micPermissionDenied()).toBe(false);
    });

    test('attemptMicrophonePermission handles NotAllowedError', async () => {
      const error = new Error('Permission denied');
      error.name = 'NotAllowedError';
      mockGetUserMedia.mockRejectedValue(error);
      
      audioState = new AudioState();
      audioState.attemptMicrophonePermission();
      
      await new Promise(resolve => setTimeout(resolve, 50));
      
      expect(audioState.micPermissionRetryCount).toBe(1);
      expect(audioState.micPermissionErrorMessage()).toContain('blocked');
    });

    test('attemptMicrophonePermission does nothing without getUserMedia', () => {
      const originalGetUserMedia = globalThis.navigator.mediaDevices.getUserMedia;
      delete globalThis.navigator.mediaDevices.getUserMedia;
      
      audioState = new AudioState();
      audioState.attemptMicrophonePermission();
      
      // Should not throw and not change retry count
      expect(audioState.micPermissionRetryCount).toBe(0);
      
      // Restore
      globalThis.navigator.mediaDevices.getUserMedia = originalGetUserMedia;
    });

    test('retryMicrophonePermission resets counter', () => {
      audioState = new AudioState();
      audioState.micPermissionRetryCount = 5;
      audioState.micPermissionErrorMessage("Some error");
      
      const mockStream = {
        getTracks: jest.fn(() => [{ stop: jest.fn() }])
      };
      mockGetUserMedia.mockResolvedValue(mockStream);
      
      audioState.retryMicrophonePermission();
      
      expect(audioState.micPermissionRetryCount).toBe(0);
      expect(audioState.micPermissionErrorMessage()).toBe("");
      expect(mockGetUserMedia).toHaveBeenCalled();
    });
  });

  describe('Beeper Initialization', () => {
    test('initializePersistentBeeper creates beeper when mixer available', async () => {
      const mockMixer = { connect: jest.fn() };
      mockGetCurrentMixer.mockReturnValue(mockMixer);
      
      audioState = new AudioState();
      await audioState.initializeAudioContext();
      
      await audioState.initializePersistentBeeper();
      
      expect(mockAudioContext.createOscillator).toHaveBeenCalled();
      expect(mockAudioContext.createGain).toHaveBeenCalled();
      expect(mockOscillator.start).toHaveBeenCalled();
      expect(audioState.beeperReady()).toBe(true);
    });

    test('initializePersistentBeeper returns early if mixer not available', async () => {
      mockGetCurrentMixer.mockReturnValue(null);
      
      audioState = new AudioState();
      await audioState.initializeAudioContext();
      
      await audioState.initializePersistentBeeper();
      
      expect(mockAudioContext.createOscillator).not.toHaveBeenCalled();
      expect(audioState.beeperReady()).toBe(false);
    });

    test('initializePersistentBeeper is idempotent', async () => {
      const mockMixer = { connect: jest.fn() };
      mockGetCurrentMixer.mockReturnValue(mockMixer);
      
      audioState = new AudioState();
      await audioState.initializeAudioContext();
      
      await audioState.initializePersistentBeeper();
      await audioState.initializePersistentBeeper();
      
      expect(mockAudioContext.createOscillator).toHaveBeenCalledTimes(1);
    });

    test('initializePersistentBeeper handles concurrent calls', async () => {
      const mockMixer = { connect: jest.fn() };
      mockGetCurrentMixer.mockReturnValue(mockMixer);
      
      audioState = new AudioState();
      await audioState.initializeAudioContext();
      
      const promises = [
        audioState.initializePersistentBeeper(),
        audioState.initializePersistentBeeper(),
        audioState.initializePersistentBeeper()
      ];
      
      await Promise.all(promises);
      
      expect(mockAudioContext.createOscillator).toHaveBeenCalledTimes(1);
    });

    test('initializePersistentBeeper allows suspended AudioContext', async () => {
      const mockMixer = { connect: jest.fn() };
      mockGetCurrentMixer.mockReturnValue(mockMixer);
      mockAudioContext.state = 'suspended';
      
      audioState = new AudioState();
      await audioState.initializeAudioContext();
      
      await audioState.initializePersistentBeeper();
      
      expect(audioState.beeperReady()).toBe(true);
    });

    test('initializePersistentBeeper blocks when AudioContext closed', async () => {
      const mockMixer = { connect: jest.fn() };
      mockGetCurrentMixer.mockReturnValue(mockMixer);
      mockAudioContext.state = 'closed';
      
      audioState = new AudioState();
      await audioState.initializeAudioContext();
      
      await audioState.initializePersistentBeeper();
      
      expect(audioState.beeperReady()).toBe(false);
    });

    test('initializePersistentBeeper handles errors gracefully', async () => {
      const mockMixer = { connect: jest.fn() };
      mockGetCurrentMixer.mockReturnValue(mockMixer);
      mockAudioContext.createOscillator.mockImplementation(() => {
        throw new Error('Oscillator error');
      });
      
      audioState = new AudioState();
      await audioState.initializeAudioContext();
      
      await audioState.initializePersistentBeeper();
      
      expect(audioState.beeperReady()).toBe(false);
    });
  });

  describe('Beeper Start/Stop', () => {
    beforeEach(async () => {
      const mockMixer = { connect: jest.fn() };
      mockGetCurrentMixer.mockReturnValue(mockMixer);
    });

    test('startBeep activates beeper', async () => {
      audioState = new AudioState();
      await audioState.initializeAudioContext();
      await audioState.initializePersistentBeeper();
      
      await audioState.startBeep();
      
      expect(audioState.isBeeping()).toBe(true);
      expect(mockGainNode.gain.linearRampToValueAtTime).toHaveBeenCalled();
    });

    test('startBeep resumes suspended AudioContext', async () => {
      audioState = new AudioState();
      await audioState.initializeAudioContext();
      await audioState.initializePersistentBeeper();
      
      mockGainNode.context.state = 'suspended';
      
      await audioState.startBeep();
      
      expect(mockGainNode.context.resume).toHaveBeenCalled();
    });

    test('startBeep initializes beeper if not ready', (done) => {
      const mockMixer = { connect: jest.fn() };
      mockGetCurrentMixer.mockReturnValue(mockMixer);
      
      audioState = new AudioState();
      audioState.initializeAudioContext().then(() => {
        // Start without initializing first
        audioState.startBeep().then(() => {
          // Beeper should be created
          expect(mockAudioContext.createOscillator).toHaveBeenCalled();
          done();
        });
      });
    });

    test('stopBeep deactivates beeper', async () => {
      audioState = new AudioState();
      await audioState.initializeAudioContext();
      await audioState.initializePersistentBeeper();
      await audioState.startBeep();
      
      audioState.stopBeep();
      
      expect(audioState.isBeeping()).toBe(false);
      expect(mockGainNode.gain.exponentialRampToValueAtTime).toHaveBeenCalled();
    });

    test('stopBeep is safe when not playing', async () => {
      audioState = new AudioState();
      await audioState.initializeAudioContext();
      await audioState.initializePersistentBeeper();
      
      // Stop without starting
      audioState.stopBeep();
      
      expect(audioState.isBeeping()).toBe(false);
    });

    test('stopBeep is safe when beeper not initialized', () => {
      audioState = new AudioState();
      
      // Should not throw
      audioState.stopBeep();
      
      expect(audioState.isBeeping()).toBe(false);
    });

    test('resetBeeper stops beeper and clears ready state', async () => {
      audioState = new AudioState();
      await audioState.initializeAudioContext();
      await audioState.initializePersistentBeeper();
      await audioState.startBeep();
      
      audioState.resetBeeper();
      
      expect(audioState.isBeeping()).toBe(false);
      expect(audioState.beeperReady()).toBe(false);
    });
  });
});
