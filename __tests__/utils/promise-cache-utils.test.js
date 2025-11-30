/**
 * Promise Cache Utils Tests
 * 
 * Tests for race-safe promise caching utilities
 */
import { jest, describe, it, expect, beforeEach } from '@jest/globals';

import { createCachedInitWithCheck } from '../../app/utils/promise-cache-utils.js';

describe('createCachedInitWithCheck', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should call init function when cache is empty', async () => {
    const initFn = jest.fn().mockResolvedValue('result');
    const checkCached = jest.fn().mockReturnValue(null);
    
    const cachedInit = createCachedInitWithCheck(checkCached, initFn);
    
    const result = await cachedInit();
    
    expect(initFn).toHaveBeenCalledTimes(1);
    expect(result).toBe('result');
  });

  it('should return cached value without calling init', async () => {
    const initFn = jest.fn().mockResolvedValue('new result');
    const checkCached = jest.fn().mockReturnValue('cached value');
    
    const cachedInit = createCachedInitWithCheck(checkCached, initFn);
    
    const result = await cachedInit();
    
    expect(initFn).not.toHaveBeenCalled();
    expect(result).toBe('cached value');
  });

  it('should deduplicate concurrent calls', async () => {
    let resolveInit;
    const initPromise = new Promise(resolve => { resolveInit = resolve; });
    const initFn = jest.fn().mockReturnValue(initPromise);
    const checkCached = jest.fn().mockReturnValue(null);
    
    const cachedInit = createCachedInitWithCheck(checkCached, initFn);
    
    // Start multiple concurrent calls
    const promise1 = cachedInit();
    const promise2 = cachedInit();
    const promise3 = cachedInit();
    
    // Init should only be called once
    expect(initFn).toHaveBeenCalledTimes(1);
    
    // Resolve
    resolveInit('result');
    
    // All promises should resolve to same value
    const [r1, r2, r3] = await Promise.all([promise1, promise2, promise3]);
    expect(r1).toBe('result');
    expect(r2).toBe('result');
    expect(r3).toBe('result');
  });

  it('should clear pending promise after completion', async () => {
    let callCount = 0;
    const initFn = jest.fn().mockImplementation(async () => {
      callCount++;
      return `result-${callCount}`;
    });
    
    let cached = null;
    const checkCached = jest.fn().mockImplementation(() => cached);
    
    const cachedInit = createCachedInitWithCheck(checkCached, initFn);
    
    // First call
    const result1 = await cachedInit();
    expect(result1).toBe('result-1');
    
    // Second call (cache still empty, should call init again)
    const result2 = await cachedInit();
    expect(result2).toBe('result-2');
    expect(initFn).toHaveBeenCalledTimes(2);
  });

  it('should handle init function errors', async () => {
    const error = new Error('Init failed');
    const initFn = jest.fn().mockRejectedValue(error);
    const checkCached = jest.fn().mockReturnValue(null);
    
    const cachedInit = createCachedInitWithCheck(checkCached, initFn);
    
    await expect(cachedInit()).rejects.toThrow('Init failed');
    
    // Should allow retry after error
    initFn.mockResolvedValueOnce('success');
    const result = await cachedInit();
    expect(result).toBe('success');
  });

  it('should pass arguments to init function', async () => {
    const initFn = jest.fn().mockImplementation(async (a, b) => a + b);
    const checkCached = jest.fn().mockReturnValue(null);
    
    const cachedInit = createCachedInitWithCheck(checkCached, initFn);
    
    const result = await cachedInit(1, 2);
    
    expect(initFn).toHaveBeenCalledWith(1, 2);
    expect(result).toBe(3);
  });

  it('should work with synchronous init function', async () => {
    const initFn = jest.fn().mockReturnValue('sync result');
    const checkCached = jest.fn().mockReturnValue(null);
    
    const cachedInit = createCachedInitWithCheck(checkCached, initFn);
    
    const result = await cachedInit();
    
    expect(result).toBe('sync result');
  });

  it('should handle cache check returning falsy values correctly', async () => {
    const initFn = jest.fn().mockResolvedValue('new value');
    
    // Test with various falsy values that should trigger init
    for (const falsyValue of [null, undefined, false, 0, '']) {
      const checkCached = jest.fn().mockReturnValue(falsyValue);
      const cachedInit = createCachedInitWithCheck(checkCached, initFn);
      
      await cachedInit();
    }
    
    // Init should be called for each falsy value
    expect(initFn).toHaveBeenCalledTimes(5);
  });

  it('should preserve cache across multiple non-concurrent calls', async () => {
    let cached = null;
    const initFn = jest.fn().mockImplementation(async () => {
      cached = 'initialized';
      return cached;
    });
    const checkCached = jest.fn().mockImplementation(() => cached);
    
    const cachedInit = createCachedInitWithCheck(checkCached, initFn);
    
    // First call initializes
    await cachedInit();
    expect(initFn).toHaveBeenCalledTimes(1);
    
    // Subsequent calls use cache
    await cachedInit();
    await cachedInit();
    expect(initFn).toHaveBeenCalledTimes(1);
  });
});
