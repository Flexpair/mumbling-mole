/**
 * Knockout.js compatibility shim for tests
 * Returns Vue-compatible ref-like objects that also support Knockout syntax
 * This is ONLY for test backward compatibility
 */

const observable = (initialValue) => {
  let value = initialValue;
  
  // Function that acts as both getter and setter (Knockout style)
  const fn = function(newValue) {
    if (arguments.length === 0) {
      // Getter
      return value;
    } else {
      // Setter
      value = newValue;
      return value;
    }
  };
  
  // Add Vue-style .value property
  Object.defineProperty(fn, 'value', {
    get: () => value,
    set: (newValue) => { value = newValue; }
  });
  
  // Add subscribe mock
  fn.subscribe = () => ({ dispose: () => {} });
  
  return fn;
};

const observableArray = (initialArray) => {
  return observable(initialArray || []);
};

const computed = (fn) => {
  const value = typeof fn === 'function' ? fn() : fn;
  const getter = () => value;
  getter.value = value;
  getter.subscribe = () => ({ dispose: () => {} });
  return getter;
};

export default {
  observable,
  observableArray,
  computed,
  pureComputed: computed
};

