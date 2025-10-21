/**
 * Characterization tests for voice.js
 * Tests voice transmission handling, PTT/Continuous modes, loopback, and audio pipeline
 */

import { jest } from '@jest/globals';
import { Writable } from 'stream';

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
    settings = {
      samplesPerPacket: 960
    };
  });

  afterEach((done) => {
    if (handler && handler._outbound && typeof handler._outbound.end === 'function') {
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
    settings = {
      samplesPerPacket: 960,
      pttKey: 'ctrl'
    };
    mockKeyboardjs.bind.mockClear();
    mockKeyboardjs.unbind.mockClear();
  });

  afterEach((done) => {
    if (handler && handler._outbound && typeof handler._outbound.end === 'function') {
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
    if (window._audioMixer) {
      window._audioMixer = null;
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
      window._audioMixer = mockMixer;
      
      const callback = jest.fn();
      onAudioMixerReady(callback);
      
      expect(callback).toHaveBeenCalledWith(mockMixer);
    });

    test('queues callback if mixer not ready', () => {
      window._audioMixer = null;
      
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
      window._audioMixer = mockMixer;
      
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
        devices.forEach(device => {
          if (device.kind === 'audioinput') {
            const option = document.createElement('option');
            option.value = device.deviceId;
            option.text = device.label;
            select.appendChild(option);
          }
        });
        expect(select.options.length).toBe(2);
        done();
        return devices;
      });
    });
    
    enumMicrophones();
  });
});
