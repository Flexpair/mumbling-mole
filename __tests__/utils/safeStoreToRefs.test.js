/**
 * Tests for safeStoreToRefs utility
 */

import { jest } from '@jest/globals';

// Mock Vue
const mockRef = (val) => ({
  value: val,
  __v_isRef: true
});

jest.unstable_mockModule('vue', () => ({
  isRef: (v) => v?.__v_isRef === true,
  toRef: (obj, key) => mockRef(obj[key]),
  toRaw: (v) => v
}));

const { safeStoreToRefs } = await import('../../app/utils/safeStoreToRefs.js');

describe('safeStoreToRefs', () => {
  test('should return refs for ref values', () => {
    const store = {
      count: mockRef(5),
      name: mockRef('test')
    };
    
    const refs = safeStoreToRefs(store);
    
    expect(refs.count).toBe(store.count);
    expect(refs.name).toBe(store.name);
  });

  test('should convert non-ref values to refs', () => {
    const store = {
      plainValue: 42,
      plainString: 'hello'
    };
    
    const refs = safeStoreToRefs(store);
    
    expect(refs.plainValue.__v_isRef).toBe(true);
    expect(refs.plainValue.value).toBe(42);
    expect(refs.plainString.__v_isRef).toBe(true);
    expect(refs.plainString.value).toBe('hello');
  });

  test('should skip functions', () => {
    const store = {
      value: mockRef(1),
      action: () => {},
      method: function() {}
    };
    
    const refs = safeStoreToRefs(store);
    
    expect(refs.value).toBeDefined();
    expect(refs.action).toBeUndefined();
    expect(refs.method).toBeUndefined();
  });

  test('should skip internal properties starting with $', () => {
    const store = {
      value: mockRef(1),
      $id: 'storeId',
      $state: {}
    };
    
    const refs = safeStoreToRefs(store);
    
    expect(refs.value).toBeDefined();
    expect(refs.$id).toBeUndefined();
    expect(refs.$state).toBeUndefined();
  });

  test('should skip private properties starting with _', () => {
    const store = {
      value: mockRef(1),
      _internal: 'private',
      _cache: {}
    };
    
    const refs = safeStoreToRefs(store);
    
    expect(refs.value).toBeDefined();
    expect(refs._internal).toBeUndefined();
    expect(refs._cache).toBeUndefined();
  });
});
