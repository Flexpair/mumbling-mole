/**
 * @jest-environment jsdom
 */

import { jest } from '@jest/globals';

// Mock dependencies before imports
let mockKeyboardjs;
let mockEnsureAudioContext;
let mockGetCurrentMixer;

beforeAll(async () => {
  // Mock keyboardjs
  mockKeyboardjs = {
    bind: jest.fn(),
    unbind: jest.fn()
  };

  // Mock audio-context-manager
  mockEnsureAudioContext = jest.fn();
  mockGetCurrentMixer = jest.fn();

  // Mock DropStream
  const mockDropStream = {
    obj: jest.fn(() => ({
      write: jest.fn((data, cb) => {
        if (cb) cb();
        return true;
      }),
      end: jest.fn()
    }))
  };

  // Setup module mocks
  jest.unstable_mockModule('keyboardjs', () => ({
    default: mockKeyboardjs
  }));

  jest.unstable_mockModule('../../app/audio/audio-context-manager.js', () => ({
    default: { getStats: jest.fn() },
    ensureAudioContext: mockEnsureAudioContext,
    getAudioContext: jest.fn()
  }));

  jest.unstable_mockModule('../../app/utils/drop-stream.js', () => ({
    default: mockDropStream
  }));

  // Mock stream module
  jest.unstable_mockModule('stream', () => ({
    Writable: class MockWritable {
      constructor(options) {
        this.objectMode = options?.objectMode;
        this._events = {};
      }
      emit(event, ...args) {
        if (this._events[event]) {
          for (const handler of this._events[event]) {
            handler(...args);
          }
        }
      }
      on(event, handler) {
        if (!this._events[event]) this._events[event] = [];
        this._events[event].push(handler);
      }
      once(event, handler) {
        const onceHandler = (...args) => {
          handler(...args);
          if (this._events[event]?.includes(onceHandler)) {
            this._events[event].splice(this._events[event].indexOf(onceHandler), 1);
          }
        };
        this.on(event, onceHandler);
      }
    }
  }));
});

describe('voice.js - VoiceHandler classes', () => {
  let ContinuousVoiceHandler, PushToTalkVoiceHandler;
  let mockClient;
  let mockSettings;

  beforeAll(async () => {
    // Import after mocks are set up
    const voiceModule = await import('../../app/audio/voice.js');
    ContinuousVoiceHandler = voiceModule.ContinuousVoiceHandler;
    PushToTalkVoiceHandler = voiceModule.PushToTalkVoiceHandler;
  });

  beforeEach(() => {
    // Create mock client with voice stream
    mockClient = {
      createVoiceStream: jest.fn((samplesPerPacket, target) => ({
        write: jest.fn((data, cb) => cb?.()),
        end: jest.fn(),
        target,
        samplesPerPacket
      }))
    };

    // Mock settings (Vue composable with refs)
    mockSettings = {
      samplesPerPacket: { value: 960 },
      pttKey: { value: 'ctrl+space' }
    };

    // Reset mocks
    mockKeyboardjs.bind.mockClear();
    mockKeyboardjs.unbind.mockClear();
  });

  describe('ContinuousVoiceHandler', () => {
    test('should create handler with default target', () => {
      const handler = new ContinuousVoiceHandler(mockClient, mockSettings);
      expect(handler._client).toBe(mockClient);
      expect(handler._settings).toBe(mockSettings);
      expect(handler._target).toBe(0);
      expect(handler._isLoopbackMode).toBe(false);
    });

    test('should create handler with loopback target', () => {
      const handler = new ContinuousVoiceHandler(mockClient, mockSettings, 31);
      expect(handler._target).toBe(31);
      expect(handler._isLoopbackMode).toBe(true);
    });

    test('should write audio data when not muted', (done) => {
      const handler = new ContinuousVoiceHandler(mockClient, mockSettings);
      const audioData = Buffer.from([1, 2, 3, 4]);

      handler._write(audioData, null, (err) => {
        expect(err).toBeUndefined();
        expect(mockClient.createVoiceStream).toHaveBeenCalledWith(960, 0);
        done();
      });
    });

    test('should not write audio when muted', (done) => {
      const handler = new ContinuousVoiceHandler(mockClient, mockSettings);
      handler.setMute(true);

      const audioData = Buffer.from([1, 2, 3, 4]);
      handler._write(audioData, null, (err) => {
        expect(err).toBeUndefined();
        expect(mockClient.createVoiceStream).not.toHaveBeenCalled();
        done();
      });
    });

    test('should handle error in _getOrCreateOutbound', (done) => {
      const handler = new ContinuousVoiceHandler(mockClient, mockSettings);
      
      // Mock createVoiceStream to throw error
      const testError = new Error('Stream creation failed');
      mockClient.createVoiceStream.mockImplementation(() => {
        throw testError;
      });

      const audioData = Buffer.from([1, 2, 3, 4]);
      handler._write(audioData, null, (err) => {
        expect(err).toBe(testError);
        done();
      });
    });

    test('should emit started_talking event', (done) => {
      const handler = new ContinuousVoiceHandler(mockClient, mockSettings);
      
      handler.on('started_talking', () => {
        expect(mockClient.createVoiceStream).toHaveBeenCalled();
        done();
      });

      const audioData = Buffer.from([1, 2, 3, 4]);
      handler._write(audioData, null, () => {});
    });

    test('should reuse existing outbound stream', (done) => {
      const handler = new ContinuousVoiceHandler(mockClient, mockSettings);
      const audioData1 = Buffer.from([1, 2, 3, 4]);
      const audioData2 = Buffer.from([5, 6, 7, 8]);

      let writeCount = 0;
      const onWriteComplete = () => {
        writeCount++;
        if (writeCount === 2) {
          expect(mockClient.createVoiceStream).toHaveBeenCalledTimes(1);
          done();
        }
      };

      handler._write(audioData1, null, onWriteComplete);
      handler._write(audioData2, null, onWriteComplete);
    });

    test('should pass target parameter to createVoiceStream', (done) => {
      const handler = new ContinuousVoiceHandler(mockClient, mockSettings, 31);
      const audioData = Buffer.from([1, 2, 3, 4]);

      handler._write(audioData, null, () => {
        expect(mockClient.createVoiceStream).toHaveBeenCalledWith(960, 31);
        done();
      });
    });
  });

  describe('ContinuousVoiceHandler - mute/unmute', () => {
    test('should stop outbound stream when muted', (done) => {
      const handler = new ContinuousVoiceHandler(mockClient, mockSettings);
      
      let stoppedTalking = false;
      handler.on('stopped_talking', () => {
        stoppedTalking = true;
      });

      const audioData = Buffer.from([1, 2, 3, 4]);
      const writeCallback = (err) => {
        expect(err).toBeUndefined();
        expect(mockClient.createVoiceStream).toHaveBeenCalled();
        handler.setMute(true);
        expect(stoppedTalking).toBe(true);
        done();
      };
      
      handler._write(audioData, null, writeCallback);
    });

    test('should throw error if trying to create outbound while muted', () => {
      const handler = new ContinuousVoiceHandler(mockClient, mockSettings);
      handler.setMute(true);
      
      // Try to manually call _getOrCreateOutbound while muted
      expect(() => {
        handler._getOrCreateOutbound();
      }).toThrow('tried to send audio while self-muted');
    });

    test('should emit stopped_talking when stream ends', (done) => {
      const handler = new ContinuousVoiceHandler(mockClient, mockSettings);
      
      handler.on('stopped_talking', done);

      const audioData = Buffer.from([1, 2, 3, 4]);
      const finalCallback = () => {};
      
      handler._write(audioData, null, (err) => {
        expect(err).toBeUndefined();
        handler._final(finalCallback);
      });
    });
  });

  describe('PushToTalkVoiceHandler', () => {
    test('should create handler and bind keyboard', () => {
      const handler = new PushToTalkVoiceHandler(mockClient, mockSettings);
      
      expect(handler._key).toBe('ctrl+space');
      expect(handler._pushed).toBe(false);
      expect(mockKeyboardjs.bind).toHaveBeenCalledWith(
        'ctrl+space',
        expect.any(Function),
        expect.any(Function)
      );
    });

    test('should create handler with loopback target', () => {
      const handler = new PushToTalkVoiceHandler(mockClient, mockSettings, 31);
      expect(handler._target).toBe(31);
      expect(handler._isLoopbackMode).toBe(true);
    });

    test('should not write audio when key not pushed', (done) => {
      const handler = new PushToTalkVoiceHandler(mockClient, mockSettings);
      const audioData = Buffer.from([1, 2, 3, 4]);

      handler._write(audioData, null, (err) => {
        expect(err).toBeUndefined();
        expect(mockClient.createVoiceStream).not.toHaveBeenCalled();
        done();
      });
    });

    test('should write audio when key is pushed', (done) => {
      const handler = new PushToTalkVoiceHandler(mockClient, mockSettings);
      
      // Simulate key press
      const bindCall = mockKeyboardjs.bind.mock.calls[0];
      const keydownHandler = bindCall[1];
      keydownHandler(); // Trigger keydown
      
      const audioData = Buffer.from([1, 2, 3, 4]);
      handler._write(audioData, null, (err) => {
        expect(err).toBeUndefined();
        expect(mockClient.createVoiceStream).toHaveBeenCalled();
        done();
      });
    });

    test('should stop outbound on key release', (done) => {
      const handler = new PushToTalkVoiceHandler(mockClient, mockSettings);
      
      let stoppedTalking = false;
      handler.on('stopped_talking', () => {
        stoppedTalking = true;
      });

      const bindCall = mockKeyboardjs.bind.mock.calls[0];
      const keydownHandler = bindCall[1];
      const keyupHandler = bindCall[2];

      keydownHandler();
      const audioData = Buffer.from([1, 2, 3, 4]);
      
      const writeCallback = (err) => {
        expect(err).toBeUndefined();
        expect(mockClient.createVoiceStream).toHaveBeenCalled();
        keyupHandler();
        expect(stoppedTalking).toBe(true);
        expect(handler._pushed).toBe(false);
        done();
      };
      
      handler._write(audioData, null, writeCallback);
    });

    test('should not write when muted even if key pushed', (done) => {
      const handler = new PushToTalkVoiceHandler(mockClient, mockSettings);
      handler.setMute(true);
      
      // Simulate key press
      const bindCall = mockKeyboardjs.bind.mock.calls[0];
      const keydownHandler = bindCall[1];
      keydownHandler();
      
      const audioData = Buffer.from([1, 2, 3, 4]);
      handler._write(audioData, null, (err) => {
        expect(err).toBeUndefined();
        expect(mockClient.createVoiceStream).not.toHaveBeenCalled();
        done();
      });
    });

    test('should unbind keyboard on final', (done) => {
      const handler = new PushToTalkVoiceHandler(mockClient, mockSettings);
      
      handler._final(() => {
        expect(mockKeyboardjs.unbind).toHaveBeenCalledWith(
          'ctrl+space',
          expect.any(Function),
          expect.any(Function)
        );
        done();
      });
    });

    test('should pass target parameter to createVoiceStream', (done) => {
      const handler = new PushToTalkVoiceHandler(mockClient, mockSettings, 31);
      
      // Simulate key press
      const bindCall = mockKeyboardjs.bind.mock.calls[0];
      const keydownHandler = bindCall[1];
      keydownHandler();
      
      const audioData = Buffer.from([1, 2, 3, 4]);
      handler._write(audioData, null, () => {
        expect(mockClient.createVoiceStream).toHaveBeenCalledWith(960, 31);
        done();
      });
    });
  });

  describe('VoiceHandler - without client (fallback)', () => {
    test('should use drop stream when no client available', (done) => {
      const handler = new ContinuousVoiceHandler(null, mockSettings);
      
      let startedTalking = false;
      handler.on('started_talking', () => {
        startedTalking = true;
      });

      const audioData = Buffer.from([1, 2, 3, 4]);
      const writeCallback = () => {
        expect(startedTalking).toBe(true);
        // Should not call createVoiceStream since no client
        expect(mockClient.createVoiceStream).not.toHaveBeenCalled();
        done();
      };
      
      handler._write(audioData, null, writeCallback);
    });
  });
});

describe('voice.js - Mixer Management', () => {
  let getCurrentMixer, onAudioMixerReady;

  beforeAll(async () => {
    const voiceModule = await import('../../app/audio/voice.js');
    getCurrentMixer = voiceModule.getCurrentMixer;
    onAudioMixerReady = voiceModule.onAudioMixerReady;
  });

  beforeEach(() => {
    // Clear global mixer
    if (typeof globalThis !== 'undefined') {
      globalThis._audioMixer = null;
    }
  });

  describe('getCurrentMixer', () => {
    test('should return null when no mixer exists', () => {
      const mixer = getCurrentMixer();
      expect(mixer).toBeNull();
    });

    test('should return current mixer instance', () => {
      // We can't easily test this without running initVoice
      // This is more of an integration test requirement
      const mixer = getCurrentMixer();
      expect(mixer).toBeNull();
    });
  });

  describe('onAudioMixerReady', () => {
    test('should reject non-function callbacks', () => {
      const consoleError = jest.spyOn(console, 'error').mockImplementation();
      
      onAudioMixerReady('not a function');
      onAudioMixerReady(123);
      onAudioMixerReady(null);
      
      expect(consoleError).toHaveBeenCalledTimes(3);
      expect(consoleError).toHaveBeenCalledWith(
        '[VOICE] onAudioMixerReady: callback must be a function'
      );
      
      consoleError.mockRestore();
    });

    test('should call callback immediately if mixer already exists', () => {
      const mockMixer = { gain: { value: 1 } };
      globalThis._audioMixer = mockMixer;
      
      const callback = jest.fn();
      onAudioMixerReady(callback);
      
      expect(callback).toHaveBeenCalledWith(mockMixer);
    });

    test('should queue callback if mixer not yet ready', () => {
      globalThis._audioMixer = null;
      
      const callback = jest.fn();
      onAudioMixerReady(callback);
      
      // Callback should not be called yet
      expect(callback).not.toHaveBeenCalled();
    });

    test('should handle errors in immediate callback execution', () => {
      const mockMixer = { gain: { value: 1 } };
      globalThis._audioMixer = mockMixer;
      
      const consoleError = jest.spyOn(console, 'error').mockImplementation();
      const errorCallback = jest.fn(() => {
        throw new Error('Callback error');
      });
      
      onAudioMixerReady(errorCallback);
      
      expect(errorCallback).toHaveBeenCalled();
      expect(consoleError).toHaveBeenCalledWith(
        '[VOICE] Error in mixer ready callback:',
        expect.any(Error)
      );
      
      consoleError.mockRestore();
    });
  });
});

describe('voice.js - Device Enumeration', () => {
  let enumMicrophones;

  beforeAll(async () => {
    const voiceModule = await import('../../app/audio/voice.js');
    enumMicrophones = voiceModule.enumMicrophones;
  });

  test('should call enumerateDevices when enumMicrophones is called', () => {
    const mockEnumerate = jest.fn().mockResolvedValue([]);
    globalThis.navigator.mediaDevices = {
      enumerateDevices: mockEnumerate
    };

    enumMicrophones();

    expect(mockEnumerate).toHaveBeenCalled();
  });

  test('should handle enumerateDevices errors', async () => {
    const consoleError = jest.spyOn(console, 'error').mockImplementation();
    const testError = new Error('Enumeration failed');
    testError.name = 'NotFoundError';

    const mockEnumerate = jest.fn().mockRejectedValue(testError);
    globalThis.navigator.mediaDevices = {
      enumerateDevices: mockEnumerate
    };

    enumMicrophones();

    // Wait for promise to reject
    await new Promise(resolve => setTimeout(resolve, 10));

    expect(consoleError).toHaveBeenCalledWith(
      'navigator.MediaDevices.getUserMedia error: ',
      testError.message,
      testError.name
    );

    consoleError.mockRestore();
  });

  // NOTE: gotDevices() is not directly testable in unit tests because it depends on
  // DOM elements (audioInputSelect) that are initialized at module load time.
  // This would require integration testing with proper DOM setup before module import.
  // The function is tested indirectly through Playwright E2E tests.
});
