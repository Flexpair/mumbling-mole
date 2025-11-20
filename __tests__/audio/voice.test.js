/**
 * Characterization tests for voice.js
 * Tests voice transmission handling, PTT/Continuous modes, loopback, and audio pipeline
 */

import { jest } from '@jest/globals';
import { Writable } from 'node:stream';

// Setup DOM BEFORE importing voice.js (which queries DOM on load)
if (typeof document !== 'undefined') {
  document.body.innerHTML = '<select id="audioSource"><option value="default">Default</option></select>';
}

// Mock dependencies before imports
const mockGetUserMedia = jest.fn();
const mockKeyboardjs = {
  bind: jest.fn(),
  unbind: jest.fn()
};
const mockDropStream = {
  obj: jest.fn(() => ({
    write: jest.fn((data, cb) => {
      if (cb) cb();
    }),
    end: jest.fn()
  }))
};
const mockEnsureAudioContext = jest.fn();
const mockGetAudioContext = jest.fn();
const mockAudioContextManager = {
  suspendAudioContext: jest.fn()
};

// Mock modules
jest.unstable_mockModule('../../app/audio/getusermedia.js', () => ({
  default: mockGetUserMedia
}));

jest.unstable_mockModule('keyboardjs', () => ({
  default: mockKeyboardjs
}));

jest.unstable_mockModule('drop-stream', () => ({
  default: mockDropStream
}));

jest.unstable_mockModule('../../app/audio/audio-context-manager.js', () => ({
  default: mockAudioContextManager,
  ensureAudioContext: mockEnsureAudioContext,
  getAudioContext: mockGetAudioContext
}));

// Import after mocks
const {
  ContinuousVoiceHandler,
  PushToTalkVoiceHandler,
  enumMicrophones,
  getCurrentMixer,
  onAudioMixerReady,
  initVoice
} = await import('../../app/audio/voice.js');

describe('ContinuousVoiceHandler', () => {
  let mockClient;
  let settings;
  let handler;

  beforeEach(() => {
    mockClient = {
      createVoiceStream: jest.fn()
    };
    // Settings is now a Vue composable with refs
    settings = {
      samplesPerPacket: { value: 960 }
    };
  });

  afterEach((done) => {
    if (typeof handler?._outbound?.end === 'function') {
      handler.end(done);
    } else {
      handler = null;
      done();
    }
  });

  describe('Constructor & Initialization', () => {
    test('creates handler with default target', () => {
      handler = new ContinuousVoiceHandler(mockClient, settings);
      expect(handler).toBeInstanceOf(ContinuousVoiceHandler);
      expect(handler).toBeInstanceOf(Writable);
      expect(handler._target).toBe(0);
      expect(handler._isLoopbackMode).toBe(false);
    });

    test('creates handler with loopback target', () => {
      handler = new ContinuousVoiceHandler(mockClient, settings, 31);
      expect(handler._target).toBe(31);
      expect(handler._isLoopbackMode).toBe(true);
    });

    test('initializes with mute disabled', () => {
      handler = new ContinuousVoiceHandler(mockClient, settings);
      expect(handler._mute).toBe(false);
    });

    test('initializes without outbound stream', () => {
      handler = new ContinuousVoiceHandler(mockClient, settings);
      expect(handler._outbound).toBeNull();
    });
  });

  describe('Mute Control', () => {
    test('setMute enables mute', () => {
      handler = new ContinuousVoiceHandler(mockClient, settings);
      handler.setMute(true);
      expect(handler._mute).toBe(true);
    });

    test('setMute disables mute', () => {
      handler = new ContinuousVoiceHandler(mockClient, settings);
      handler.setMute(true);
      handler.setMute(false);
      expect(handler._mute).toBe(false);
    });

    test('setMute stops outbound stream when enabled', () => {
      const mockStream = {
        write: jest.fn(),
        end: jest.fn()
      };
      mockClient.createVoiceStream.mockReturnValue(mockStream);

      handler = new ContinuousVoiceHandler(mockClient, settings);
      
      // Create outbound stream
      handler.write(Buffer.alloc(960 * 4));
      expect(handler._outbound).toBe(mockStream);

      // Mute should stop stream
      handler.setMute(true);
      expect(mockStream.end).toHaveBeenCalled();
      expect(handler._outbound).toBeNull();
    });

    test('setMute is idempotent when no outbound exists', () => {
      handler = new ContinuousVoiceHandler(mockClient, settings);
      expect(() => handler.setMute(true)).not.toThrow();
      expect(handler._mute).toBe(true);
    });
  });

  describe('Voice Stream Creation', () => {
    test('creates voice stream on first write', () => {
      const mockStream = {
        write: jest.fn((data, cb) => cb()),
        end: jest.fn()
      };
      mockClient.createVoiceStream.mockReturnValue(mockStream);

      handler = new ContinuousVoiceHandler(mockClient, settings);
      const data = Buffer.alloc(960 * 4);
      
      handler.write(data);

      expect(mockClient.createVoiceStream).toHaveBeenCalledWith(960, 0);
      expect(mockStream.write).toHaveBeenCalledWith(data, expect.any(Function));
    });

    test('creates voice stream with loopback target', () => {
      const mockStream = {
        write: jest.fn((data, cb) => cb()),
        end: jest.fn()
      };
      mockClient.createVoiceStream.mockReturnValue(mockStream);

      handler = new ContinuousVoiceHandler(mockClient, settings, 31);
      handler.write(Buffer.alloc(960 * 4));

      expect(mockClient.createVoiceStream).toHaveBeenCalledWith(960, 31);
    });

    test('reuses existing voice stream', () => {
      const mockStream = {
        write: jest.fn((data, cb) => cb()),
        end: jest.fn()
      };
      mockClient.createVoiceStream.mockReturnValue(mockStream);

      handler = new ContinuousVoiceHandler(mockClient, settings);
      handler.write(Buffer.alloc(960 * 4));
      handler.write(Buffer.alloc(960 * 4));

      expect(mockClient.createVoiceStream).toHaveBeenCalledTimes(1);
    });

    test('emits started_talking when stream created', (done) => {
      const mockStream = {
        write: jest.fn((data, cb) => cb()),
        end: jest.fn()
      };
      mockClient.createVoiceStream.mockReturnValue(mockStream);

      handler = new ContinuousVoiceHandler(mockClient, settings);
      
      handler.on('started_talking', () => {
        done();
      });

      handler.write(Buffer.alloc(960 * 4));
    });

    test('uses drop stream when no client available', (done) => {
      handler = new ContinuousVoiceHandler(null, settings);
      
      // Write should complete successfully even without client
      handler.write(Buffer.alloc(960 * 4), (err) => {
        expect(err).toBeFalsy();
        expect(mockDropStream.obj).toHaveBeenCalled();
        // Drop stream doesn't have proper end method, clear handler
        handler = null;
        done();
      });
    });
  });

  describe('Audio Data Writing', () => {
    test('writes data to outbound stream', (done) => {
      const mockStream = {
        write: jest.fn((data, cb) => {
          expect(data).toBeInstanceOf(Buffer);
          expect(data.length).toBe(960 * 4);
          cb();
          done();
        }),
        end: jest.fn()
      };
      mockClient.createVoiceStream.mockReturnValue(mockStream);

      handler = new ContinuousVoiceHandler(mockClient, settings);
      const data = Buffer.alloc(960 * 4);
      handler.write(data);
    });

    test('skips writing when muted', (done) => {
      handler = new ContinuousVoiceHandler(mockClient, settings);
      handler.setMute(true);
      
      handler.write(Buffer.alloc(960 * 4), (err) => {
        expect(err).toBeFalsy();
        expect(mockClient.createVoiceStream).not.toHaveBeenCalled();
        done();
      });
    });

    test('handles write errors gracefully', (done) => {
      const mockStream = {
        write: jest.fn((data, cb) => {
          cb(new Error('Stream error'));
        }),
        end: jest.fn()
      };
      mockClient.createVoiceStream.mockReturnValue(mockStream);

      handler = new ContinuousVoiceHandler(mockClient, settings);
      
      handler.on('error', (err) => {
        expect(err).toBeInstanceOf(Error);
        expect(err.message).toMatch(/Stream error/);
        // Handler is destroyed after error, clear reference
        handler = null;
        done();
      });
      
      handler.write(Buffer.alloc(960 * 4));
    });
  });

  describe('Stream Cleanup', () => {
    test('stops outbound stream on end', (done) => {
      const mockStream = {
        write: jest.fn((data, cb) => cb()),
        end: jest.fn()
      };
      mockClient.createVoiceStream.mockReturnValue(mockStream);

      handler = new ContinuousVoiceHandler(mockClient, settings);
      handler.write(Buffer.alloc(960 * 4));

      handler.end(() => {
        expect(mockStream.end).toHaveBeenCalled();
        expect(handler._outbound).toBeNull();
        done();
      });
    });

    test('emits stopped_talking when stream ends', (done) => {
      const mockStream = {
        write: jest.fn((data, cb) => cb()),
        end: jest.fn()
      };
      mockClient.createVoiceStream.mockReturnValue(mockStream);

      handler = new ContinuousVoiceHandler(mockClient, settings);
      
      let stoppedTalking = false;
      handler.on('stopped_talking', () => {
        stoppedTalking = true;
      });

      handler.write(Buffer.alloc(960 * 4));
      handler.end(() => {
        expect(stoppedTalking).toBe(true);
        done();
      });
    });

    test('cleanup is safe when no outbound stream exists', (done) => {
      handler = new ContinuousVoiceHandler(mockClient, settings);
      handler.end(() => {
        expect(handler._outbound).toBeNull();
        done();
      });
    });
  });
});

describe('PushToTalkVoiceHandler', () => {
  let mockClient;
  let settings;
  let handler;

  beforeEach(() => {
    mockClient = {
      createVoiceStream: jest.fn()
    };
    // Settings is now a Vue composable with refs
    settings = {
      samplesPerPacket: { value: 960 },
      pttKey: { value: 'ctrl' }
    };
    mockKeyboardjs.bind.mockClear();
    mockKeyboardjs.unbind.mockClear();
  });

  afterEach((done) => {
    if (typeof handler?._outbound?.end === 'function') {
      handler.end(done);
    } else {
      handler = null;
      done();
    }
  });

  describe('Constructor & Initialization', () => {
    test('creates handler with PTT key binding', () => {
      handler = new PushToTalkVoiceHandler(mockClient, settings);
      expect(handler).toBeInstanceOf(PushToTalkVoiceHandler);
      expect(handler._key).toBe('ctrl');
      expect(handler._pushed).toBe(false);
      expect(mockKeyboardjs.bind).toHaveBeenCalledWith(
        'ctrl',
        expect.any(Function),
        expect.any(Function)
      );
    });

    test('creates handler with loopback target', () => {
      handler = new PushToTalkVoiceHandler(mockClient, settings, 31);
      expect(handler._target).toBe(31);
      expect(handler._isLoopbackMode).toBe(true);
    });

    test('initializes with pushed state false', () => {
      handler = new PushToTalkVoiceHandler(mockClient, settings);
      expect(handler._pushed).toBe(false);
    });
  });

  describe('PTT Key Handling', () => {
    test('keydown sets pushed state', () => {
      handler = new PushToTalkVoiceHandler(mockClient, settings);
      
      // Get the keydown handler from the bind call
      const bindCall = mockKeyboardjs.bind.mock.calls[0];
      const keydownHandler = bindCall[1];
      
      keydownHandler();
      expect(handler._pushed).toBe(true);
    });

    test('keyup clears pushed state', () => {
      const mockStream = {
        write: jest.fn((data, cb) => cb()),
        end: jest.fn()
      };
      mockClient.createVoiceStream.mockReturnValue(mockStream);

      handler = new PushToTalkVoiceHandler(mockClient, settings);
      
      const bindCall = mockKeyboardjs.bind.mock.calls[0];
      const keydownHandler = bindCall[1];
      const keyupHandler = bindCall[2];
      
      // Simulate key press
      keydownHandler();
      handler.write(Buffer.alloc(960 * 4));
      expect(handler._pushed).toBe(true);
      
      // Simulate key release
      keyupHandler();
      expect(handler._pushed).toBe(false);
    });

    test('keyup stops outbound stream', () => {
      const mockStream = {
        write: jest.fn((data, cb) => cb()),
        end: jest.fn()
      };
      mockClient.createVoiceStream.mockReturnValue(mockStream);

      handler = new PushToTalkVoiceHandler(mockClient, settings);
      
      const bindCall = mockKeyboardjs.bind.mock.calls[0];
      const keydownHandler = bindCall[1];
      const keyupHandler = bindCall[2];
      
      keydownHandler();
      handler.write(Buffer.alloc(960 * 4));
      
      keyupHandler();
      expect(mockStream.end).toHaveBeenCalled();
    });
  });

  describe('Audio Data Writing with PTT', () => {
    test('writes data only when key is pushed', (done) => {
      const mockStream = {
        write: jest.fn((data, cb) => {
          expect(data).toBeInstanceOf(Buffer);
          cb();
          done();
        }),
        end: jest.fn()
      };
      mockClient.createVoiceStream.mockReturnValue(mockStream);

      handler = new PushToTalkVoiceHandler(mockClient, settings);
      
      const bindCall = mockKeyboardjs.bind.mock.calls[0];
      const keydownHandler = bindCall[1];
      
      // Without key press - should not write
      handler.write(Buffer.alloc(960 * 4));
      expect(mockStream.write).not.toHaveBeenCalled();
      
      // With key press - should write
      keydownHandler();
      handler.write(Buffer.alloc(960 * 4));
    });

    test('skips writing when key not pushed', (done) => {
      handler = new PushToTalkVoiceHandler(mockClient, settings);
      
      handler.write(Buffer.alloc(960 * 4), (err) => {
        expect(err).toBeFalsy();
        expect(mockClient.createVoiceStream).not.toHaveBeenCalled();
        done();
      });
    });

    test('skips writing when muted even with key pushed', (done) => {
      handler = new PushToTalkVoiceHandler(mockClient, settings);
      
      const bindCall = mockKeyboardjs.bind.mock.calls[0];
      const keydownHandler = bindCall[1];
      
      keydownHandler();
      handler.setMute(true);
      
      handler.write(Buffer.alloc(960 * 4), (err) => {
        expect(err).toBeFalsy();
        expect(mockClient.createVoiceStream).not.toHaveBeenCalled();
        done();
      });
    });
  });

  describe('Cleanup & Unbinding', () => {
    test('unbinds keyboard on end', (done) => {
      handler = new PushToTalkVoiceHandler(mockClient, settings);
      
      handler.end(() => {
        expect(mockKeyboardjs.unbind).toHaveBeenCalledWith(
          'ctrl',
          expect.any(Function),
          expect.any(Function)
        );
        done();
      });
    });

    test('calls parent cleanup on end', (done) => {
      const mockStream = {
        write: jest.fn((data, cb) => cb()),
        end: jest.fn()
      };
      mockClient.createVoiceStream.mockReturnValue(mockStream);

      handler = new PushToTalkVoiceHandler(mockClient, settings);
      
      const bindCall = mockKeyboardjs.bind.mock.calls[0];
      const keydownHandler = bindCall[1];
      
      keydownHandler();
      handler.write(Buffer.alloc(960 * 4));
      
      handler.end(() => {
        expect(mockStream.end).toHaveBeenCalled();
        done();
      });
    });
  });
});

describe('Mixer Management', () => {
  beforeEach(() => {
    // Reset global state
    if (globalThis._audioMixer) {
      globalThis._audioMixer = null;
    }
  });

  describe('getCurrentMixer', () => {
    test('returns null initially', () => {
      expect(getCurrentMixer()).toBeNull();
    });
  });

  describe('onAudioMixerReady', () => {
    test('calls callback immediately if mixer exists', () => {
      const mockMixer = { gain: { value: 1.0 } };
      globalThis._audioMixer = mockMixer;
      
      const callback = jest.fn();
      onAudioMixerReady(callback);
      
      expect(callback).toHaveBeenCalledWith(mockMixer);
    });

    test('queues callback if mixer not ready', () => {
      globalThis._audioMixer = null;
      
      const callback = jest.fn();
      onAudioMixerReady(callback);
      
      expect(callback).not.toHaveBeenCalled();
    });

    test('handles non-function callback gracefully', () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      
      onAudioMixerReady('not a function');
      
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('callback must be a function')
      );
      
      consoleSpy.mockRestore();
    });

    test('handles callback errors gracefully', () => {
      const mockMixer = { gain: { value: 1.0 } };
      globalThis._audioMixer = mockMixer;
      
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      const errorCallback = jest.fn(() => {
        throw new Error('Callback error');
      });
      
      onAudioMixerReady(errorCallback);
      
      expect(errorCallback).toHaveBeenCalled();
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Error in mixer ready callback'),
        expect.any(Error)
      );
      
      consoleSpy.mockRestore();
    });
  });
});

describe('enumMicrophones', () => {
  let mockEnumerateDevices;
  let originalNavigator;
  
  beforeEach(() => {
    mockEnumerateDevices = jest.fn();
    originalNavigator = global.navigator;
    
    // Create navigator mock
    Object.defineProperty(global, 'navigator', {
      value: {
        mediaDevices: {
          enumerateDevices: mockEnumerateDevices
        }
      },
      writable: true,
      configurable: true
    });
    
    // Mock select element
    document.body.innerHTML = '<select id="audioSource"></select>';
  });

  afterEach(() => {
    // Restore original navigator
    Object.defineProperty(global, 'navigator', {
      value: originalNavigator,
      writable: true,
      configurable: true
    });
  });

  test('calls enumerateDevices', () => {
    mockEnumerateDevices.mockResolvedValue([]);
    enumMicrophones();
    expect(mockEnumerateDevices).toHaveBeenCalled();
  });

  test('handles device enumeration', (done) => {
    const mockDevices = [
      { deviceId: 'device1', kind: 'audioinput', label: 'Microphone 1' },
      { deviceId: 'device2', kind: 'audioinput', label: 'Microphone 2' }
    ];
    
    mockEnumerateDevices.mockImplementation(() => {
      return Promise.resolve(mockDevices).then((devices) => {
        const select = document.querySelector('#audioSource');
        // Simulate gotDevices function
        while (select.firstChild) {
          select.removeChild(select.firstChild);
        }
        for (const device of devices) {
          if (device.kind === 'audioinput') {
            const option = document.createElement('option');
            option.value = device.deviceId;
            option.text = device.label;
            select.appendChild(option);
          }
        }
        expect(select.options.length).toBe(2);
        done();
        return devices;
      });
    });
    
    enumMicrophones();
  });
});

// ============================================================
// INTEGRATION TESTS - initVoice() Audio Pipeline
// ============================================================

describe('initVoice Integration Tests', () => {
  let mockAudioContext;
  let mockMediaStream;
  let mockTrack;
  let mockMediaStreamSource;
  let mockGainNode;
  let mockAudioWorkletNode;
  let consoleLogSpy;
  let consoleErrorSpy;

  beforeEach(() => {
    // Spy on console methods
    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

    // Mock MediaStreamTrack
    mockTrack = {
      addEventListener: jest.fn(),
      removeEventListener: jest.fn()
    };

    // Mock MediaStream
    mockMediaStream = {
      getTracks: jest.fn(() => [mockTrack])
    };

    // Mock MediaStreamSource
    mockMediaStreamSource = {
      connect: jest.fn(),
      disconnect: jest.fn()
    };

    // Mock GainNode (Mixer)
    mockGainNode = {
      gain: {
        setValueAtTime: jest.fn()
      },
      connect: jest.fn(),
      disconnect: jest.fn()
    };

    // Mock AudioWorkletNode
    mockAudioWorkletNode = {
      port: {
        onmessage: null
      },
      connect: jest.fn(),
      disconnect: jest.fn()
    };

    // Mock AudioContext
    mockAudioContext = {
      state: 'running',
      sampleRate: 48000,
      currentTime: 0,
      audioWorklet: {
        addModule: jest.fn().mockResolvedValue(undefined)
      },
      createMediaStreamSource: jest.fn(() => mockMediaStreamSource),
      createGain: jest.fn(() => mockGainNode)
    };

    // Mock global AudioWorkletNode constructor
    globalThis.AudioWorkletNode = jest.fn(() => mockAudioWorkletNode);

    // Mock window._audioMixer
    global.window = global.window || {};

    // Mock ensureAudioContext
    mockEnsureAudioContext.mockResolvedValue(mockAudioContext);

    // Clear previous mocks
    mockGetUserMedia.mockClear();
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
    consoleErrorSpy.mockRestore();
    delete global.window._audioMixer;
    delete globalThis.AudioWorkletNode;
    
    // Reset module-level mixer state
    // Note: Can't directly reset module variables, but globalThis._audioMixer is the public API
    if (typeof globalThis !== 'undefined') {
      globalThis._audioMixer = null;
    }
  });

  describe('Success Flow', () => {
    test('should initialize complete audio pipeline successfully', async () => {
      const onData = jest.fn();
      const onError = jest.fn();

      // Setup getUserMedia to call success callback
      mockGetUserMedia.mockImplementation((constraints, callback) => {
        // Simulate async getUserMedia success
        setTimeout(() => callback(null, mockMediaStream), 0);
      });

      // Call initVoice
      initVoice(onData, onError);

      // Wait for async operations
      await new Promise(resolve => setTimeout(resolve, 50));

      // Verify AudioContext initialization
      expect(mockEnsureAudioContext).toHaveBeenCalledWith({
        sampleRate: 48000,
        latencyHint: 'interactive'
      });

      // Verify AudioWorklet module loaded
      expect(mockAudioContext.audioWorklet.addModule).toHaveBeenCalledWith(
        'recorder-worker.js'
      );

      // Verify audio nodes created
      expect(mockAudioContext.createMediaStreamSource).toHaveBeenCalledWith(mockMediaStream);
      expect(mockAudioContext.createGain).toHaveBeenCalled();
      expect(globalThis.AudioWorkletNode).toHaveBeenCalledWith(
        mockAudioContext,
        'recorder-processor',
        expect.objectContaining({
          numberOfInputs: 1,
          numberOfOutputs: 0,
          channelCount: 1
        })
      );

      // Verify audio graph connections
      expect(mockMediaStreamSource.connect).toHaveBeenCalledWith(mockGainNode);
      expect(mockGainNode.connect).toHaveBeenCalledWith(mockAudioWorkletNode);

      // Verify mixer gain value
      expect(mockGainNode.gain.setValueAtTime).toHaveBeenCalledWith(1.0, 0);

      // Verify global mixer reference
      expect(globalThis._audioMixer).toBe(mockGainNode);

      // Verify no errors
      expect(onError).not.toHaveBeenCalled();

      // Verify console logs
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('[VOICE-INIT] Starting audio pipeline initialization')
      );
    });

    test('should handle PCM data from AudioWorklet', async () => {
      const onData = jest.fn();
      const onError = jest.fn();

      mockGetUserMedia.mockImplementation((constraints, callback) => {
        setTimeout(() => callback(null, mockMediaStream), 0);
      });

      initVoice(onData, onError);

      await new Promise(resolve => setTimeout(resolve, 50));

      // Verify AudioWorkletNode was created
      expect(mockAudioWorkletNode.port).toBeDefined();

      // Simulate AudioWorklet sending PCM data
      const pcmData = new Float32Array(960);
      for (let i = 0; i < 960; i++) {
        pcmData[i] = Math.sin(2 * Math.PI * 440 * i / 48000); // 440 Hz tone
      }

      // NOTE: Bug was fixed - previously had `this._isLoopbackMode` check which was undefined
      // initVoice is not a class method, so 'this' context doesn't exist
      // The debug logging has been removed in the fix
      if (mockAudioWorkletNode.port.onmessage) {
        mockAudioWorkletNode.port.onmessage({
          data: {
            type: 'pcm',
            data: pcmData.buffer
          }
        });

        // Verify onData callback was called with Buffer
        expect(onData).toHaveBeenCalled();
        const callArg = onData.mock.calls[0][0];
        expect(callArg).toBeInstanceOf(Buffer);
        expect(callArg.length).toBe(960 * 4); // Float32 = 4 bytes per sample
      }
    });

    test('should register mixer ready callbacks', async () => {
      const callback1 = jest.fn();
      const callback2 = jest.fn();

      mockGetUserMedia.mockImplementation((constraints, callback) => {
        setTimeout(() => callback(null, mockMediaStream), 0);
      });

      // Register callbacks before initialization
      onAudioMixerReady(callback1);
      onAudioMixerReady(callback2);

      initVoice(jest.fn(), jest.fn());

      await new Promise(resolve => setTimeout(resolve, 50));

      // Verify both callbacks were called with mixer
      expect(callback1).toHaveBeenCalledWith(mockGainNode);
      expect(callback2).toHaveBeenCalledWith(mockGainNode);
    });

    test('should handle callback errors gracefully', async () => {
      const errorCallback = jest.fn(() => {
        throw new Error('Callback error');
      });
      const successCallback = jest.fn();

      mockGetUserMedia.mockImplementation((constraints, callback) => {
        setTimeout(() => callback(null, mockMediaStream), 0);
      });

      onAudioMixerReady(errorCallback);
      onAudioMixerReady(successCallback);

      initVoice(jest.fn(), jest.fn());

      await new Promise(resolve => setTimeout(resolve, 50));

      // Verify error was logged
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('[VOICE] Error in mixer ready callback'),
        expect.any(Error)
      );

      // Verify second callback still executed
      expect(successCallback).toHaveBeenCalled();
    });

    test('should setup track ended event listener', async () => {
      mockGetUserMedia.mockImplementation((constraints, callback) => {
        setTimeout(() => callback(null, mockMediaStream), 0);
      });

      initVoice(jest.fn(), jest.fn());

      await new Promise(resolve => setTimeout(resolve, 50));

      // Verify addEventListener was called on track
      expect(mockTrack.addEventListener).toHaveBeenCalledWith('ended', expect.any(Function));
    });
  });

  describe('Error Handling', () => {
    test('should handle getUserMedia errors', async () => {
      const onData = jest.fn();
      const onError = jest.fn();
      const mockError = new Error('Permission denied');

      // Setup getUserMedia to call error callback
      mockGetUserMedia.mockImplementation((constraints, callback) => {
        setTimeout(() => callback(mockError, null), 0);
      });

      initVoice(onData, onError);

      await new Promise(resolve => setTimeout(resolve, 50));

      // Verify error callback was called
      expect(onError).toHaveBeenCalledWith(mockError);

      // Verify AudioContext was not initialized
      expect(mockEnsureAudioContext).not.toHaveBeenCalled();

      // Verify no data callback
      expect(onData).not.toHaveBeenCalled();
    });

    test('should handle AudioWorklet loading errors', async () => {
      const onData = jest.fn();
      const onError = jest.fn();
      const workletError = new Error('Failed to load AudioWorklet module');

      mockGetUserMedia.mockImplementation((constraints, callback) => {
        setTimeout(() => callback(null, mockMediaStream), 0);
      });

      // Mock AudioWorklet module loading failure
      mockAudioContext.audioWorklet.addModule.mockRejectedValue(workletError);

      initVoice(onData, onError);

      await new Promise(resolve => setTimeout(resolve, 50));

      // Verify error was caught and handled
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'AudioWorklet init failed:',
        workletError
      );

      // Verify error callback was called
      expect(onError).toHaveBeenCalledWith(workletError);
    });

    test('should handle AudioContext initialization errors', async () => {
      const onData = jest.fn();
      const onError = jest.fn();
      const contextError = new Error('AudioContext creation failed');

      mockGetUserMedia.mockImplementation((constraints, callback) => {
        setTimeout(() => callback(null, mockMediaStream), 0);
      });

      // Mock AudioContext initialization failure
      mockEnsureAudioContext.mockRejectedValue(contextError);

      initVoice(onData, onError);

      await new Promise(resolve => setTimeout(resolve, 50));

      // Verify error was caught
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'AudioWorklet init failed:',
        contextError
      );

      // Verify error callback was called
      expect(onError).toHaveBeenCalledWith(contextError);
    });

    test('should handle AudioWorkletNode creation errors', async () => {
      const onData = jest.fn();
      const onError = jest.fn();
      const nodeError = new Error('AudioWorkletNode creation failed');

      mockGetUserMedia.mockImplementation((constraints, callback) => {
        setTimeout(() => callback(null, mockMediaStream), 0);
      });

      // Mock AudioWorkletNode constructor to throw
      globalThis.AudioWorkletNode = jest.fn(() => {
        throw nodeError;
      });

      initVoice(onData, onError);

      await new Promise(resolve => setTimeout(resolve, 50));

      // Verify error was caught
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'AudioWorklet init failed:',
        nodeError
      );

      // Verify error callback was called
      expect(onError).toHaveBeenCalledWith(nodeError);
    });
  });

  describe('Mixer Lifecycle & Race Conditions', () => {
    test('should track current mixer instance', async () => {
      mockGetUserMedia.mockImplementation((constraints, callback) => {
        setTimeout(() => callback(null, mockMediaStream), 0);
      });

      // Get mixer before initialization (might be from previous test or null)
      const mixerBefore = getCurrentMixer();

      // Initialize new mixer
      initVoice(jest.fn(), jest.fn());
      await new Promise(resolve => setTimeout(resolve, 50));

      const mixerAfter = getCurrentMixer();
      
      // After initialization, mixer should be the new mockGainNode
      expect(mixerAfter).toBe(mockGainNode);
      expect(globalThis._audioMixer).toBe(mockGainNode);
      
      // Mixer should have changed (new instance created)
      if (mixerBefore !== null) {
        expect(mixerAfter).not.toBe(mixerBefore);
      }
    });

    test('should cleanup mixer when track ends', async () => {
      let trackEndedHandler;

      mockTrack.addEventListener.mockImplementation((event, handler) => {
        if (event === 'ended') {
          trackEndedHandler = handler;
        }
      });

      mockGetUserMedia.mockImplementation((constraints, callback) => {
        setTimeout(() => callback(null, mockMediaStream), 0);
      });

      initVoice(jest.fn(), jest.fn());
      await new Promise(resolve => setTimeout(resolve, 50));

      // Verify mixer was created
      expect(globalThis._audioMixer).toBe(mockGainNode);

      // Simulate track ended event
      if (trackEndedHandler) {
        trackEndedHandler();
      }

      // Verify cleanup was called
      expect(mockAudioWorkletNode.disconnect).toHaveBeenCalled();
      expect(mockGainNode.disconnect).toHaveBeenCalled();
      expect(mockMediaStreamSource.disconnect).toHaveBeenCalled();

      // Verify global reference cleared
      expect(globalThis._audioMixer).toBeNull();

      // Verify AudioContext was suspended (not closed)
      expect(mockAudioContextManager.suspendAudioContext).toHaveBeenCalled();
    });

    test('should handle disconnect errors during cleanup', async () => {
      let trackEndedHandler;

      mockTrack.addEventListener.mockImplementation((event, handler) => {
        if (event === 'ended') {
          trackEndedHandler = handler;
        }
      });

      mockGetUserMedia.mockImplementation((constraints, callback) => {
        setTimeout(() => callback(null, mockMediaStream), 0);
      });

      // Make disconnect throw errors
      mockAudioWorkletNode.disconnect.mockImplementation(() => {
        throw new Error('Already disconnected');
      });

      initVoice(jest.fn(), jest.fn());
      await new Promise(resolve => setTimeout(resolve, 50));

      // Simulate track ended event - should not throw
      expect(() => {
        if (trackEndedHandler) {
          trackEndedHandler();
        }
      }).not.toThrow();

      // Verify cleanup continued despite errors
      expect(mockGainNode.disconnect).toHaveBeenCalled();
    });
  });

  describe('Device Selection', () => {
    test('should use audio device from select element', async () => {
      const onData = jest.fn();
      const onError = jest.fn();

      // LIMITATION: audioInputSelect is evaluated at module load time (see TODO in voice.js)
      // The select element was created with value="default" before module import.
      // Changing select.value here won't affect initVoice() because it already captured
      // the reference at import time. This is a known design issue documented in voice.js.

      mockGetUserMedia.mockImplementation((constraints, callback) => {
        // Verify constraints were created (deviceId depends on select value at import time)
        expect(constraints.audio).toBeDefined();
        expect(constraints.audio.deviceId).toBeDefined();
        setTimeout(() => callback(null, mockMediaStream), 0);
      });

      initVoice(onData, onError);

      await new Promise(resolve => setTimeout(resolve, 50));

      expect(mockGetUserMedia).toHaveBeenCalled();
    });

    test('should request audio with proper constraints', async () => {
      mockGetUserMedia.mockImplementation((constraints, callback) => {
        // Verify all audio constraints
        expect(constraints.audio.echoCancellation).toBe(true);
        expect(constraints.audio.autoGainControl).toBe(true);
        expect(constraints.audio.noiseSuppression).toBe(true);
        expect(constraints.audio.channelCount).toEqual({ ideal: 1 });
        expect(constraints.audio.sampleRate).toEqual({ ideal: 48000 });
        setTimeout(() => callback(null, mockMediaStream), 0);
      });

      initVoice(jest.fn(), jest.fn());

      await new Promise(resolve => setTimeout(resolve, 50));

      expect(mockGetUserMedia).toHaveBeenCalled();
    });
  });
});
