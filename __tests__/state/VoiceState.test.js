/**
 * VoiceState unit tests
 * 
 * Tests voice handler lifecycle, loopback mode, and voice data routing.
 */

import { jest } from '@jest/globals';

// Mock dependencies BEFORE imports
jest.unstable_mockModule('knockout', () => ({
  default: {
    observable: jest.fn((val) => {
      let _value = val;
      const obs = jest.fn(function(newVal) {
        if (arguments.length > 0) {
          _value = newVal;
          return obs;
        }
        return _value;
      });
      obs.subscribe = jest.fn((callback) => ({
        dispose: jest.fn()
      }));
      obs.notifySubscribers = jest.fn();
      return obs;
    }),
  }
}));

// Mock voice.js module
let mockContinuousVoiceHandler;
let mockPushToTalkVoiceHandler;
let mockInitVoice;
let mockOnAudioMixerReady;

jest.unstable_mockModule('../../app/audio/voice', () => {
  mockContinuousVoiceHandler = jest.fn().mockImplementation(() => ({
    on: jest.fn(),
    setMute: jest.fn(),
    write: jest.fn(),
    end: jest.fn(),
  }));

  mockPushToTalkVoiceHandler = jest.fn().mockImplementation(() => ({
    on: jest.fn(),
    setMute: jest.fn(),
    write: jest.fn(),
    end: jest.fn(),
  }));

  mockInitVoice = jest.fn();
  mockOnAudioMixerReady = jest.fn();

  return {
    ContinuousVoiceHandler: mockContinuousVoiceHandler,
    PushToTalkVoiceHandler: mockPushToTalkVoiceHandler,
    initVoice: mockInitVoice,
    onAudioMixerReady: mockOnAudioMixerReady,
  };
});

jest.unstable_mockModule('../../app/localize', () => ({
  translate: jest.fn((key) => `translated:${key}`)
}));

// Now import after mocking
const ko = (await import('knockout')).default;
const VoiceState = (await import('../../app/state/VoiceState')).default;
const { translate } = await import('../../app/localize');

describe('VoiceState', () => {
  let voiceState;
  let mockClient;
  let mockSettings;

  beforeEach(() => {
    jest.clearAllMocks();
    voiceState = new VoiceState();
    
    mockClient = {
      id: 'test-client-123'
    };
    
    mockSettings = {
      voiceMode: 'cont',
      audioBitrate: 40000,
    };
  });

  describe('Constructor & Initialization', () => {
    test('creates instance with null voice handler', () => {
      expect(voiceState.voiceHandler).toBeNull();
    });

    test('initializes loopback mode as false', () => {
      expect(voiceState.isLoopbackMode()).toBe(false);
    });

    test('initializes voice handler ready as false', () => {
      expect(voiceState.voiceHandlerReady()).toBe(false);
    });

    test('initializes loopback frequency as 0', () => {
      expect(voiceState.loopbackDominantFrequency()).toBe(0);
    });

    test('creates observables', () => {
      expect(ko.observable).toHaveBeenCalledTimes(3);
    });
  });

  describe('initVoiceInput', () => {
    test('calls initVoice with callbacks', () => {
      const onData = jest.fn();
      const onError = jest.fn();

      voiceState.initVoiceInput(onData, onError);

      expect(mockInitVoice).toHaveBeenCalledWith(onData, onError);
    });

    test('registers mixer ready callback when provided', () => {
      const onData = jest.fn();
      const onError = jest.fn();
      const onMixerReady = jest.fn();

      voiceState.initVoiceInput(onData, onError, onMixerReady);

      expect(mockOnAudioMixerReady).toHaveBeenCalledWith(onMixerReady);
    });

    test('skips mixer ready registration when not provided', () => {
      const onData = jest.fn();
      const onError = jest.fn();

      voiceState.initVoiceInput(onData, onError);

      expect(mockOnAudioMixerReady).not.toHaveBeenCalled();
    });
  });

  describe('updateVoiceHandler', () => {
    test('does nothing when no client provided', () => {
      voiceState.updateVoiceHandler(null, mockSettings, jest.fn(), jest.fn());

      expect(mockContinuousVoiceHandler).not.toHaveBeenCalled();
      expect(mockPushToTalkVoiceHandler).not.toHaveBeenCalled();
    });

    test('creates ContinuousVoiceHandler in continuous mode', () => {
      mockSettings.voiceMode = 'cont';

      voiceState.updateVoiceHandler(mockClient, mockSettings, jest.fn(), jest.fn());

      expect(mockContinuousVoiceHandler).toHaveBeenCalledWith(mockClient, mockSettings, 0);
      expect(voiceState.voiceHandler).not.toBeNull();
    });

    test('creates PushToTalkVoiceHandler in PTT mode', () => {
      mockSettings.voiceMode = 'ptt';

      voiceState.updateVoiceHandler(mockClient, mockSettings, jest.fn(), jest.fn());

      expect(mockPushToTalkVoiceHandler).toHaveBeenCalledWith(mockClient, mockSettings, 0);
      expect(voiceState.voiceHandler).not.toBeNull();
    });

    test('uses loopback target (31) when in loopback mode', () => {
      voiceState.isLoopbackMode(true);

      voiceState.updateVoiceHandler(mockClient, mockSettings, jest.fn(), jest.fn());

      expect(mockContinuousVoiceHandler).toHaveBeenCalledWith(mockClient, mockSettings, 31);
    });

    test('uses normal target (0) when not in loopback mode', () => {
      voiceState.isLoopbackMode(false);

      voiceState.updateVoiceHandler(mockClient, mockSettings, jest.fn(), jest.fn());

      expect(mockContinuousVoiceHandler).toHaveBeenCalledWith(mockClient, mockSettings, 0);
    });

    test('logs error for unknown voice mode', () => {
      mockSettings.voiceMode = 'invalid-mode';
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

      voiceState.updateVoiceHandler(mockClient, mockSettings, jest.fn(), jest.fn());

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('translated:'),
        'invalid-mode'
      );
      expect(voiceState.voiceHandler).toBeNull();

      consoleErrorSpy.mockRestore();
    });

    test('attaches started_talking event handler', () => {
      const onStartedTalking = jest.fn();

      voiceState.updateVoiceHandler(mockClient, mockSettings, onStartedTalking, jest.fn());

      expect(voiceState.voiceHandler.on).toHaveBeenCalledWith('started_talking', onStartedTalking);
    });

    test('attaches stopped_talking event handler', () => {
      const onStoppedTalking = jest.fn();

      voiceState.updateVoiceHandler(mockClient, mockSettings, jest.fn(), onStoppedTalking);

      expect(voiceState.voiceHandler.on).toHaveBeenCalledWith('stopped_talking', onStoppedTalking);
    });

    test('handles missing event callbacks gracefully', () => {
      voiceState.updateVoiceHandler(mockClient, mockSettings);

      expect(voiceState.voiceHandler).not.toBeNull();
      expect(voiceState.voiceHandler.on).not.toHaveBeenCalled();
    });

    test('sets voice handler ready to true after creation', () => {
      voiceState.updateVoiceHandler(mockClient, mockSettings, jest.fn(), jest.fn());

      expect(voiceState.voiceHandlerReady()).toBe(true);
    });

    test('resets voice handler ready to false before recreation', () => {
      // Create initial handler
      voiceState.updateVoiceHandler(mockClient, mockSettings, jest.fn(), jest.fn());
      expect(voiceState.voiceHandlerReady()).toBe(true);

      // Update should reset ready state temporarily
      const readyCalls = voiceState.voiceHandlerReady.mock.calls;
      voiceState.updateVoiceHandler(mockClient, mockSettings, jest.fn(), jest.fn());

      // Should have been called with false during update
      expect(readyCalls.some(call => call[0] === false)).toBe(true);
    });
  });

  describe('Voice Handler Cleanup', () => {
    beforeEach(() => {
      // Create a voice handler first
      voiceState.updateVoiceHandler(mockClient, mockSettings, jest.fn(), jest.fn());
    });

    test('cleans up existing handler before creating new one', () => {
      const oldHandler = voiceState.voiceHandler;

      voiceState.updateVoiceHandler(mockClient, mockSettings, jest.fn(), jest.fn());

      expect(oldHandler.end).toHaveBeenCalled();
      expect(voiceState.voiceHandler).not.toBe(oldHandler);
    });

    test('handles cleanup errors gracefully', () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
      voiceState.voiceHandler.end.mockImplementation(() => {
        throw new Error('Cleanup error');
      });

      voiceState.updateVoiceHandler(mockClient, mockSettings, jest.fn(), jest.fn());

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('[VOICE-HANDLER]'),
        expect.any(Error)
      );
      // Should still create new handler despite cleanup error
      expect(voiceState.voiceHandler).not.toBeNull();

      consoleErrorSpy.mockRestore();
    });

    test('sets handler to null after cleanup', () => {
      voiceState.updateVoiceHandler(mockClient, mockSettings, jest.fn(), jest.fn());
      const oldHandler = voiceState.voiceHandler;

      voiceState.updateVoiceHandler(mockClient, mockSettings, jest.fn(), jest.fn());

      // Old handler should have been cleaned up
      expect(oldHandler.end).toHaveBeenCalled();
    });
  });

  describe('updateLoopbackFrequency', () => {
    test('updates frequency when in loopback mode', () => {
      voiceState.isLoopbackMode(true);

      voiceState.updateLoopbackFrequency(440.567);

      expect(voiceState.loopbackDominantFrequency()).toBe(440.6);
    });

    test('rounds frequency to 1 decimal place', () => {
      voiceState.isLoopbackMode(true);

      voiceState.updateLoopbackFrequency(123.456);

      expect(voiceState.loopbackDominantFrequency()).toBe(123.5);
    });

    test('does not update frequency when not in loopback mode', () => {
      voiceState.isLoopbackMode(false);
      voiceState.loopbackDominantFrequency(999);

      voiceState.updateLoopbackFrequency(440);

      expect(voiceState.loopbackDominantFrequency()).toBe(999);
    });

    test('handles zero frequency', () => {
      voiceState.isLoopbackMode(true);

      voiceState.updateLoopbackFrequency(0);

      expect(voiceState.loopbackDominantFrequency()).toBe(0);
    });

    test('handles negative frequency', () => {
      voiceState.isLoopbackMode(true);

      voiceState.updateLoopbackFrequency(-100.5);

      expect(voiceState.loopbackDominantFrequency()).toBe(-100.5);
    });
  });

  describe('setMute', () => {
    test('calls setMute on voice handler when handler exists', () => {
      voiceState.updateVoiceHandler(mockClient, mockSettings, jest.fn(), jest.fn());

      voiceState.setMute(true);

      expect(voiceState.voiceHandler.setMute).toHaveBeenCalledWith(true);
    });

    test('handles unmute', () => {
      voiceState.updateVoiceHandler(mockClient, mockSettings, jest.fn(), jest.fn());

      voiceState.setMute(false);

      expect(voiceState.voiceHandler.setMute).toHaveBeenCalledWith(false);
    });

    test('does nothing when no voice handler exists', () => {
      voiceState.setMute(true);

      // Should not throw
      expect(true).toBe(true);
    });
  });

  describe('writeVoiceData', () => {
    test('writes data to voice handler when handler exists', () => {
      voiceState.updateVoiceHandler(mockClient, mockSettings, jest.fn(), jest.fn());
      const mockData = new ArrayBuffer(8);

      voiceState.writeVoiceData(mockData);

      expect(voiceState.voiceHandler.write).toHaveBeenCalledWith(mockData);
    });

    test('does nothing when no voice handler exists', () => {
      const mockData = new ArrayBuffer(8);

      voiceState.writeVoiceData(mockData);

      // Should not throw
      expect(true).toBe(true);
    });
  });

  describe('endVoiceHandler', () => {
    test('ends voice handler when handler exists', () => {
      voiceState.updateVoiceHandler(mockClient, mockSettings, jest.fn(), jest.fn());

      voiceState.endVoiceHandler();

      expect(voiceState.voiceHandler).toBeNull();
    });

    test('sets voice handler ready to false', () => {
      voiceState.updateVoiceHandler(mockClient, mockSettings, jest.fn(), jest.fn());

      voiceState.endVoiceHandler();

      expect(voiceState.voiceHandlerReady()).toBe(false);
    });

    test('does nothing when no handler exists', () => {
      voiceState.endVoiceHandler();

      expect(voiceState.voiceHandler).toBeNull();
      expect(voiceState.voiceHandlerReady()).toBe(false);
    });

    test('calls end on handler before nulling', () => {
      voiceState.updateVoiceHandler(mockClient, mockSettings, jest.fn(), jest.fn());
      const handler = voiceState.voiceHandler;

      voiceState.endVoiceHandler();

      expect(handler.end).toHaveBeenCalled();
    });
  });

  describe('reset', () => {
    test('ends voice handler', () => {
      voiceState.updateVoiceHandler(mockClient, mockSettings, jest.fn(), jest.fn());

      voiceState.reset();

      expect(voiceState.voiceHandler).toBeNull();
    });

    test('disables loopback mode', () => {
      voiceState.isLoopbackMode(true);

      voiceState.reset();

      expect(voiceState.isLoopbackMode()).toBe(false);
    });

    test('sets voice handler ready to false', () => {
      voiceState.updateVoiceHandler(mockClient, mockSettings, jest.fn(), jest.fn());

      voiceState.reset();

      expect(voiceState.voiceHandlerReady()).toBe(false);
    });

    test('does not reset loopback frequency (current behavior)', () => {
      voiceState.isLoopbackMode(true);
      voiceState.updateLoopbackFrequency(440);

      voiceState.reset();

      // Note: reset() does not currently reset loopback frequency
      // It only resets: handler, loopback mode, and ready state
      expect(voiceState.loopbackDominantFrequency()).toBe(440);
    });

    test('handles reset when no handler exists', () => {
      voiceState.reset();

      expect(voiceState.voiceHandler).toBeNull();
      expect(voiceState.isLoopbackMode()).toBe(false);
      expect(voiceState.voiceHandlerReady()).toBe(false);
    });
  });

  describe('Loopback Mode Integration', () => {
    test('continuous mode with loopback uses target 31', () => {
      mockSettings.voiceMode = 'cont';
      voiceState.isLoopbackMode(true);

      voiceState.updateVoiceHandler(mockClient, mockSettings, jest.fn(), jest.fn());

      expect(mockContinuousVoiceHandler).toHaveBeenCalledWith(
        mockClient,
        mockSettings,
        31
      );
    });

    test('PTT mode with loopback uses target 31', () => {
      mockSettings.voiceMode = 'ptt';
      voiceState.isLoopbackMode(true);

      voiceState.updateVoiceHandler(mockClient, mockSettings, jest.fn(), jest.fn());

      expect(mockPushToTalkVoiceHandler).toHaveBeenCalledWith(
        mockClient,
        mockSettings,
        31
      );
    });

    test('switching loopback mode recreates handler with new target', () => {
      // Create handler in normal mode
      voiceState.isLoopbackMode(false);
      voiceState.updateVoiceHandler(mockClient, mockSettings, jest.fn(), jest.fn());
      expect(mockContinuousVoiceHandler).toHaveBeenCalledWith(mockClient, mockSettings, 0);

      // Switch to loopback and recreate
      voiceState.isLoopbackMode(true);
      voiceState.updateVoiceHandler(mockClient, mockSettings, jest.fn(), jest.fn());
      expect(mockContinuousVoiceHandler).toHaveBeenCalledWith(mockClient, mockSettings, 31);
    });
  });

  describe('Voice Mode Switching', () => {
    test('switches from continuous to PTT', () => {
      mockSettings.voiceMode = 'cont';
      voiceState.updateVoiceHandler(mockClient, mockSettings, jest.fn(), jest.fn());
      const oldHandler = voiceState.voiceHandler;

      mockSettings.voiceMode = 'ptt';
      voiceState.updateVoiceHandler(mockClient, mockSettings, jest.fn(), jest.fn());

      expect(oldHandler.end).toHaveBeenCalled();
      expect(mockPushToTalkVoiceHandler).toHaveBeenCalled();
    });

    test('switches from PTT to continuous', () => {
      mockSettings.voiceMode = 'ptt';
      voiceState.updateVoiceHandler(mockClient, mockSettings, jest.fn(), jest.fn());
      const oldHandler = voiceState.voiceHandler;

      mockSettings.voiceMode = 'cont';
      voiceState.updateVoiceHandler(mockClient, mockSettings, jest.fn(), jest.fn());

      expect(oldHandler.end).toHaveBeenCalled();
      expect(mockContinuousVoiceHandler).toHaveBeenCalled();
    });
  });

  describe('Event Handler Registration', () => {
    test('only registers provided event handlers', () => {
      const onStartedTalking = jest.fn();

      voiceState.updateVoiceHandler(mockClient, mockSettings, onStartedTalking, null);

      expect(voiceState.voiceHandler.on).toHaveBeenCalledWith('started_talking', onStartedTalking);
      expect(voiceState.voiceHandler.on).toHaveBeenCalledTimes(1);
    });

    test('registers both event handlers when provided', () => {
      const onStartedTalking = jest.fn();
      const onStoppedTalking = jest.fn();

      voiceState.updateVoiceHandler(mockClient, mockSettings, onStartedTalking, onStoppedTalking);

      expect(voiceState.voiceHandler.on).toHaveBeenCalledTimes(2);
      expect(voiceState.voiceHandler.on).toHaveBeenCalledWith('started_talking', onStartedTalking);
      expect(voiceState.voiceHandler.on).toHaveBeenCalledWith('stopped_talking', onStoppedTalking);
    });
  });
});
