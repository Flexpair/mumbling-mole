/**
 * Mock for knockout.js - returns Vue-compatible ref-like objects
 * Used during test migration from Knockout to Vue.js
 * This allows tests to use ko.observable() syntax but get Vue refs
 */

const observable = (initialValue) => {
  return {
    value: initialValue,
    // Mock subscribe for backward compatibility in tests
    subscribe: () => ({ dispose: () => {} })
  };
};

const observableArray = (initialArray) => {
  return {
    value: initialArray || [],
    subscribe: () => ({ dispose: () => {} })
  };
};

const computed = (fn) => {
  return {
    value: typeof fn === 'function' ? fn() : fn,
    subscribe: () => ({ dispose: () => {} })
  };
};

export default {
  observable,
  observableArray,
  computed,
  pureComputed: computed
};
