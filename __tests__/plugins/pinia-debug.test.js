/**
 * Pinia Debug Plugin Tests
 */
import { jest, describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import vue from 'vue/dist/vue.cjs.js';
import { createPiniaDebugPlugin } from '../../app/plugins/pinia-debug.js';

jest.unstable_mockModule('vue', () => vue);
const { createPinia, defineStore } = await import('pinia');

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

  it('logs only metadata for real store actions with sensitive data', async () => {
    globalThis.MUMBLE_DEBUG_AUDIO = true;

    const password = 'synthetic-password';
    const credentials = { nested: { token: 'synthetic-nested-token' } };
    const result = { value: 'synthetic-return-value' };
    const error = Object.assign(new Error('synthetic-error-secret'), {
      nested: { token: 'synthetic-error-token' },
    });
    const pinia = createPinia();
    pinia.use(createPiniaDebugPlugin());
    vue.createApp({}).use(pinia);
    const useStore = defineStore('secureStore', {
      actions: {
        succeed() { return result; },
        async succeedAsync() { return result; },
        fail() { throw error; },
        async failAsync() { throw error; },
      },
    });
    const store = useStore(pinia);

    expect(store.succeed(password, credentials)).toBe(result);
    await expect(store.succeedAsync(password, credentials)).resolves.toBe(result);
    expect(() => store.fail(password, credentials)).toThrow(error);
    await expect(store.failAsync(password, credentials)).rejects.toBe(error);

    const duration = expect.stringMatching(/^\d+\.\d$/);
    expect({ log: consoleLogSpy.mock.calls, error: consoleErrorSpy.mock.calls }).toEqual({
      log: [
        ['[PINIA:%s] → %s', 'secureStore', 'succeed'],
        ['[PINIA:%s] ✓ %s (%sms)', 'secureStore', 'succeed', duration],
        ['[PINIA:%s] → %s', 'secureStore', 'succeedAsync'],
        ['[PINIA:%s] ✓ %s (%sms)', 'secureStore', 'succeedAsync', duration],
        ['[PINIA:%s] → %s', 'secureStore', 'fail'],
        ['[PINIA:%s] → %s', 'secureStore', 'failAsync'],
      ],
      error: [
        ['[PINIA:%s] ✗ %s failed (%sms)', 'secureStore', 'fail', duration],
        ['[PINIA:%s] ✗ %s failed (%sms)', 'secureStore', 'failAsync', duration],
      ],
    });
  });

  it('should log action start without argument values', () => {
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
      'testAction'
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
      'noArgsAction'
    );
  });

  it('should log action completion without the result value', () => {
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
      expect.any(String)
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

  it('should log action failure without the error object', () => {
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
      expect.stringContaining('[PINIA:%s] ✗ %s failed (%sms)'),
      'testStore',
      'failingAction',
      expect.any(String)
    );
  });
});
