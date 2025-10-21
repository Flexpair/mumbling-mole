/**
 * audio-context-manager.js - Basic Tests
 */

import { jest } from '@jest/globals';

describe('AudioContextManager', () => {
  let audioContextManager, getAudioContext, mockAudioContext;

  beforeEach(async () => {
    jest.resetModules();
    jest.clearAllMocks();

    mockAudioContext = {
      state: 'running',
      sampleRate: 48000,
      currentTime: 0,
      resume: jest.fn().mockResolvedValue(undefined),
      suspend: jest.fn().mockResolvedValue(undefined),
      close: jest.fn().mockResolvedValue(undefined),
      addEventListener: jest.fn()
    };

    global.AudioContext = jest.fn(() => mockAudioContext);

    const module = await import('../../app/audio/audio-context-manager.js');
    audioContextManager = module.default;
    getAudioContext = module.getAudioContext;
  });

  afterEach(() => {
    delete global.AudioContext;
  });

  test('creates AudioContext', async () => {
    const context = await getAudioContext();
    expect(global.AudioContext).toHaveBeenCalled();
    expect(context).toBe(mockAudioContext);
  });

  test('returns singleton instance', async () => {
    const ctx1 = await getAudioContext();
    const ctx2 = await getAudioContext();
    expect(ctx1).toBe(ctx2);
    expect(global.AudioContext).toHaveBeenCalledTimes(1);
  });

  test('suspends context', async () => {
    await audioContextManager.getAudioContext();
    await audioContextManager.suspendAudioContext();
    expect(mockAudioContext.suspend).toHaveBeenCalled();
  });

  test('closes context', async () => {
    await audioContextManager.getAudioContext();
    await audioContextManager.closeAudioContext();
    expect(mockAudioContext.close).toHaveBeenCalled();
    expect(audioContextManager.audioContext).toBe(null);
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
});
