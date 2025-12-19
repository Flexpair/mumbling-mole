/**
 * Pinia Debug Plugin Tests
 */
import { jest, describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { createPiniaDebugPlugin } from '../../app/plugins/pinia-debug.js';

describe('createPiniaDebugPlugin', () => {
  let originalDebugFlag;
  let consoleLogSpy;
  let consoleErrorSpy;
  let mockStore;
  let actionCallback;

  beforeEach(() => {
    originalDebugFlag = globalThis.MUMBLE_DEBUG_AUDIO;
    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    
    actionCallback = null;
    mockStore = {
      $id: 'testStore',
      $onAction: jest.fn((cb) => {
        actionCallback = cb;
      }),
    };
  });

  afterEach(() => {
    globalThis.MUMBLE_DEBUG_AUDIO = originalDebugFlag;
    consoleLogSpy.mockRestore();
    consoleErrorSpy.mockRestore();
  });

  it('should return a function', () => {
    const plugin = createPiniaDebugPlugin();
    expect(typeof plugin).toBe('function');
  });

  it('should not register action listener when debug is disabled', () => {
    globalThis.MUMBLE_DEBUG_AUDIO = false;

    const plugin = createPiniaDebugPlugin();
    plugin({ store: mockStore });

    expect(mockStore.$onAction).not.toHaveBeenCalled();
  });

  it('should register action listener when debug is enabled', () => {
    globalThis.MUMBLE_DEBUG_AUDIO = true;

    const plugin = createPiniaDebugPlugin();
    plugin({ store: mockStore });

    expect(mockStore.$onAction).toHaveBeenCalled();
  });

  it('should log action start with args', () => {
    globalThis.MUMBLE_DEBUG_AUDIO = true;

    const plugin = createPiniaDebugPlugin();
    plugin({ store: mockStore });

    // Simulate action call
    const mockAfter = jest.fn();
    const mockOnError = jest.fn();
    actionCallback({
      name: 'testAction',
      args: ['arg1', 'arg2'],
      after: mockAfter,
      onError: mockOnError,
    });

    expect(consoleLogSpy).toHaveBeenCalledWith(
      '[PINIA:%s] → %s',
      'testStore',
      'testAction',
      ['arg1', 'arg2']
    );
  });

  it('should log action start without args', () => {
    globalThis.MUMBLE_DEBUG_AUDIO = true;

    const plugin = createPiniaDebugPlugin();
    plugin({ store: mockStore });

    const mockAfter = jest.fn();
    const mockOnError = jest.fn();
    actionCallback({
      name: 'noArgsAction',
      args: [],
      after: mockAfter,
      onError: mockOnError,
    });

    expect(consoleLogSpy).toHaveBeenCalledWith(
      '[PINIA:%s] → %s',
      'testStore',
      'noArgsAction',
      ''
    );
  });

  it('should log action completion with result', () => {
    globalThis.MUMBLE_DEBUG_AUDIO = true;

    const plugin = createPiniaDebugPlugin();
    plugin({ store: mockStore });

    let afterCallback;
    actionCallback({
      name: 'actionWithResult',
      args: [],
      after: (cb) => { afterCallback = cb; },
      onError: jest.fn(),
    });

    // Simulate successful completion
    afterCallback({ result: 'success' });

    expect(consoleLogSpy).toHaveBeenCalledWith(
      expect.stringContaining('[PINIA:%s] ✓ %s (%sms)'),
      'testStore',
      'actionWithResult',
      expect.any(String),
      { result: 'success' }
    );
  });

  it('should log action completion without result', () => {
    globalThis.MUMBLE_DEBUG_AUDIO = true;

    const plugin = createPiniaDebugPlugin();
    plugin({ store: mockStore });

    let afterCallback;
    actionCallback({
      name: 'actionNoResult',
      args: [],
      after: (cb) => { afterCallback = cb; },
      onError: jest.fn(),
    });

    // Simulate successful completion with undefined result
    afterCallback(undefined);

    expect(consoleLogSpy).toHaveBeenCalledWith(
      expect.stringContaining('[PINIA:%s] ✓ %s (%sms)'),
      'testStore',
      'actionNoResult',
      expect.any(String)
    );
  });

  it('should log action error', () => {
    globalThis.MUMBLE_DEBUG_AUDIO = true;

    const plugin = createPiniaDebugPlugin();
    plugin({ store: mockStore });

    let onErrorCallback;
    actionCallback({
      name: 'failingAction',
      args: [],
      after: jest.fn(),
      onError: (cb) => { onErrorCallback = cb; },
    });

    const testError = new Error('Test error');
    onErrorCallback(testError);

    expect(consoleErrorSpy).toHaveBeenCalledWith(
      expect.stringContaining('[PINIA:%s] ✗ %s failed (%sms):'),
      'testStore',
      'failingAction',
      expect.any(String),
      testError
    );
  });
});
