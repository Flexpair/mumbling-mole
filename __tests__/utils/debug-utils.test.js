/**
 * Debug Utils Tests
 */
import { jest, describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { debugLog } from '../../app/utils/debug-utils.js';

describe('debugLog', () => {
  let consoleLogSpy;
  let originalDebugFlag;

  beforeEach(() => {
    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    originalDebugFlag = globalThis.MUMBLE_DEBUG_AUDIO;
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
    globalThis.MUMBLE_DEBUG_AUDIO = originalDebugFlag;
  });

  it('should log when MUMBLE_DEBUG_AUDIO is true', () => {
    globalThis.MUMBLE_DEBUG_AUDIO = true;

    debugLog('[TEST]', 'message', { data: 123 });

    expect(consoleLogSpy).toHaveBeenCalledWith('[TEST]', 'message', { data: 123 });
  });

  it('should not log when MUMBLE_DEBUG_AUDIO is false', () => {
    globalThis.MUMBLE_DEBUG_AUDIO = false;

    debugLog('[TEST]', 'message');

    expect(consoleLogSpy).not.toHaveBeenCalled();
  });

  it('should not log when MUMBLE_DEBUG_AUDIO is undefined', () => {
    delete globalThis.MUMBLE_DEBUG_AUDIO;

    debugLog('[TEST]', 'message');

    expect(consoleLogSpy).not.toHaveBeenCalled();
  });

  it('should handle multiple arguments', () => {
    globalThis.MUMBLE_DEBUG_AUDIO = true;

    debugLog('[TAG]', 'arg1', 'arg2', 3, { key: 'value' }, [1, 2, 3]);

    expect(consoleLogSpy).toHaveBeenCalledWith('[TAG]', 'arg1', 'arg2', 3, { key: 'value' }, [1, 2, 3]);
  });

  it('should handle no additional arguments', () => {
    globalThis.MUMBLE_DEBUG_AUDIO = true;

    debugLog('[SOLO]');

    expect(consoleLogSpy).toHaveBeenCalledWith('[SOLO]');
  });
});
