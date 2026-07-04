/**
 * audio-context-manager.js - Comprehensive Tests
 */

import { jest } from '@jest/globals';

describe('AudioContextManager', () => {
  let audioContextManager, getAudioContext, ensureAudioContext;
  let mockAudioContext;

  beforeEach(async () => {
    jest.resetModules();
    jest.clearAllMocks();

    // Create comprehensive mock AudioContext
    mockAudioContext = {
      state: 'suspended',
      sampleRate: 48000,
      currentTime: 0,
      baseLatency: 0.005,
      outputLatency: 0.01,
      _stateChangeListeners: [],
      _resumeCount: 0,
      _shouldFailResume: false,
      
      resume: jest.fn(async function() {
        this._resumeCount++;
        if (this._shouldFailResume) {
          throw new Error('Resume failed');
        }
        if (this.state === 'suspended') {
          this.state = 'running';
          for (const listener of this._stateChangeListeners) {
            listener();
          }
        }
      }),
      
      suspend: jest.fn(async function() {
        if (this.state === 'running') {
          this.state = 'suspended';
          for (const listener of this._stateChangeListeners) {
            listener();
          }
        }
      }),
      
      close: jest.fn(async function() {
        this.state = 'closed';
        for (const listener of this._stateChangeListeners) {
          listener();
        }
      }),
      
      addEventListener: jest.fn(function(event, handler) {
        if (event === 'statechange') {
          this._stateChangeListeners.push(handler);
        }
      })
    };

    globalThis.AudioContext = jest.fn(() => mockAudioContext);
    globalThis.webkitAudioContext = jest.fn(() => mockAudioContext);

    const module = await import('../../app/audio/audio-context-manager.js');
    audioContextManager = module.default;
    getAudioContext = module.getAudioContext;
    ensureAudioContext = module.ensureAudioContext;
    
    // Reset manager state
    audioContextManager.audioContext = null;
    audioContextManager.isInitialized = false;
    audioContextManager.userInteractionDetected = false;
    audioContextManager.resumeAttempts = 0;
    audioContextManager.onReadyCallbacks = [];
    audioContextManager.onSuspendCallbacks = [];
    audioContextManager.onResumeCallbacks = [];
  });

  afterEach(() => {
    delete globalThis.AudioContext;
    delete globalThis.webkitAudioContext;
  });

  test('creates AudioContext', async () => {
    const context = await getAudioContext();
    expect(globalThis.AudioContext).toHaveBeenCalled();
    expect(context).toBe(mockAudioContext);
  });

  test('returns singleton instance', async () => {
    const ctx1 = await getAudioContext();
    const ctx2 = await getAudioContext();
    expect(ctx1).toBe(ctx2);
    expect(globalThis.AudioContext).toHaveBeenCalledTimes(1);
  });

  test('suspends context', async () => {
    const context = await audioContextManager.getAudioContext();
    // Resume first so we can test suspending
    await context.resume();
    
    await audioContextManager.suspendAudioContext();
    expect(mockAudioContext.suspend).toHaveBeenCalled();
    expect(context.state).toBe('suspended');
  });

  test('closes context', async () => {
    await audioContextManager.getAudioContext();
    await audioContextManager.closeAudioContext();
    expect(mockAudioContext.close).toHaveBeenCalled();
    expect(audioContextManager.audioContext).toBeNull();
  });

  test('onReady callback fires', async () => {
    const callback = jest.fn();
    audioContextManager.onReady(callback);
    await getAudioContext();
    expect(callback).toHaveBeenCalledWith(mockAudioContext);
  });

  test('getStats returns data', () => {
    const stats = audioContextManager.getStats();
    expect(stats).toHaveProperty('isInitialized');
    expect(stats).toHaveProperty('state');
  });

  test('should resume suspended context', async () => {
    const context = await audioContextManager.getAudioContext();
    expect(context.state).toBe('suspended');
    
    await audioContextManager.resumeAudioContext();
    
    expect(context.state).toBe('running');
    expect(audioContextManager.resumeAttempts).toBe(0);
  });

  test('should auto-resume on ensureAudioContext', async () => {
    const context = await ensureAudioContext({ sampleRate: 48000 });
    
    expect(context.state).toBe('running');
  });

  test('should detect user interaction and auto-resume', async () => {
    const context = await audioContextManager.getAudioContext();
    expect(context.state).toBe('suspended');
    
    // Simulate click event
    const clickEvent = new MouseEvent('click');
    document.dispatchEvent(clickEvent);
    
    // Wait for auto-resume
    await new Promise(resolve => setTimeout(resolve, 10));
    
    expect(audioContextManager.userInteractionDetected).toBe(true);
    expect(context.state).toBe('running');
  });

  test('should force user interaction detection', () => {
    expect(audioContextManager.userInteractionDetected).toBe(false);
    
    audioContextManager.forceUserInteraction();
    
    expect(audioContextManager.userInteractionDetected).toBe(true);
  });

  test('should handle resume failures with retry', async () => {
    const consoleWarn = jest.spyOn(console, 'warn').mockImplementation();
    const consoleError = jest.spyOn(console, 'error').mockImplementation();
    
    const context = await audioContextManager.getAudioContext();
    
    // Force resume failure
    context._shouldFailResume = true;
    
    try {
      await audioContextManager.resumeAudioContext();
    } catch (error) {
      expect(error.message).toBe('Resume failed');
    }
    
    expect(consoleWarn).toHaveBeenCalled();
    expect(consoleError).toHaveBeenCalledWith('Max resume attempts reached');
    
    consoleWarn.mockRestore();
    consoleError.mockRestore();
  });

  test('should call onSuspend callbacks', async () => {
    const callback = jest.fn();
    const context = await audioContextManager.getAudioContext();
    await context.resume();
    
    audioContextManager.onSuspend(callback);
    await audioContextManager.suspendAudioContext();
    
    expect(callback).toHaveBeenCalledWith(context);
  });

  test('should call onResume callbacks', async () => {
    const callback = jest.fn();
    const context = await audioContextManager.getAudioContext();
    
    audioContextManager.onResume(callback);
    await audioContextManager.resumeAudioContext();
    
    expect(callback).toHaveBeenCalledWith(context);
  });

  test('should handle errors in callbacks', async () => {
    const consoleError = jest.spyOn(console, 'error').mockImplementation();
    const errorCallback = jest.fn(() => {
      throw new Error('Callback error');
    });
    
    audioContextManager.onReady(errorCallback);
    await getAudioContext();
    
    expect(errorCallback).toHaveBeenCalled();
    expect(consoleError).toHaveBeenCalled();
    
    consoleError.mockRestore();
  });

  test('should recreate context if closed', async () => {
    const consoleWarn = jest.spyOn(console, 'warn').mockImplementation();
    const context1 = await audioContextManager.getAudioContext();
    
    // Close context (this will trigger statechange and clear the reference)
    await context1.close();
    
    // Clear the mock to prepare for new context creation
    globalThis.AudioContext.mockClear();
    
    // Mock a new context for recreation
    const mockAudioContext2 = { ...mockAudioContext, state: 'suspended', _stateChangeListeners: [] };
    globalThis.AudioContext.mockImplementation(() => mockAudioContext2);
    
    // This should detect closed state and recreate
    const context2 = await audioContextManager.getAudioContext();
    
    // Should warn about recreation
    expect(consoleWarn).toHaveBeenCalled();
    expect(globalThis.AudioContext).toHaveBeenCalled();
    expect(context2).toBe(mockAudioContext2);
    
    consoleWarn.mockRestore();
  });

  test('should check isAudioReady', async () => {
    // Ensure clean state
    audioContextManager.audioContext = null;
    audioContextManager.isInitialized = false;
    
    expect(audioContextManager.isReady()).toBeFalsy();
    
    const context = await getAudioContext();
    expect(audioContextManager.isReady()).toBeFalsy(); // suspended
    
    await context.resume();
    expect(audioContextManager.isReady()).toBe(true);
  });

  test('should check canPlayAudio with user interaction', () => {
    // Ensure clean state
    audioContextManager.audioContext = null;
    audioContextManager.userInteractionDetected = false;
    
    expect(audioContextManager.canPlayAudio()).toBeFalsy();
    
    audioContextManager.forceUserInteraction();
    expect(audioContextManager.canPlayAudio()).toBe(true);
  });

  test('should check canPlayAudio with running context', async () => {
    const context = await getAudioContext();
    await context.resume();
    
    expect(audioContextManager.canPlayAudio()).toBe(true);
  });

  test('should accept custom config options', async () => {
    await getAudioContext({ 
      sampleRate: 44100,
      latencyHint: 'playback'
    });
    
    expect(globalThis.AudioContext).toHaveBeenCalledWith(
      expect.objectContaining({
        sampleRate: 44100,
        latencyHint: 'playback'
      })
    );
  });

  test('should remove undefined sampleRate from config', async () => {
    await getAudioContext({ sampleRate: undefined });
    
    const callArgs = globalThis.AudioContext.mock.calls[0][0];
    expect(callArgs).not.toHaveProperty('sampleRate');
  });

  test('should handle browser without AudioContext', async () => {
    delete globalThis.AudioContext;
    delete globalThis.webkitAudioContext;
    
    // Reset manager
    audioContextManager.audioContext = null;
    audioContextManager.isInitialized = false;
    
    await expect(audioContextManager.createAudioContext()).rejects.toThrow(
      'AudioContext is not supported in this browser'
    );
    
    expect(audioContextManager.isInitialized).toBe(false);
  });

  test('should use webkitAudioContext as fallback', async () => {
    delete globalThis.AudioContext;
    
    await getAudioContext();
    
    expect(globalThis.webkitAudioContext).toHaveBeenCalled();
  });

  test('should expose manager on window', () => {
    expect(globalThis.audioContextManager).toBe(audioContextManager);
  });
});
