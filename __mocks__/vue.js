/**
 * Vue 3 mock for Jest tests
 * 
 * Provides minimal Vue reactivity API for testing composables.
 * Real Vue integration is tested via component integration tests.
 */

// Simple ref implementation for tests
export function ref(value) {
  if (value && value.__v_isRef) {
    return value;
  }
  const r = {
    value,
    __v_isRef: true,
  };
  return r;
}

// Simple reactive implementation for tests
export function reactive(obj) {
  // Simple proxy to handle ref unwrapping for Pinia
  return new Proxy(obj, {
    get(target, prop, receiver) {
      if (prop === '__v_raw') return target;
      const val = Reflect.get(target, prop, receiver);
      // Auto-unwrap refs
      if (val && val.__v_isRef && !val.__v_isComputed) {
        return val.value;
      }
      return val;
    },
    set(target, prop, value, receiver) {
      const current = target[prop];
      if (current && current.__v_isRef) {
        if (value === current) {
          return true;
        }
        current.value = value;
        return true;
      }
      target[prop] = value;
      return true;
    }
  });
}

// markRaw implementation for tests - prevents reactivity
export function markRaw(obj) {
  return obj;
}

// toRaw implementation for tests
export function toRaw(obj) {
  return obj;
}

let currentScope = null;

// effectScope implementation for tests
export function effectScope(detached) {
  const scope = {
    active: true,
    effects: [],
    cleanups: [],
    run(fn) {
      const prev = currentScope;
      currentScope = this;
      try {
        return fn();
      } finally {
        currentScope = prev;
      }
    },
    stop() {
      this.active = false;
    }
  };
  return scope;
}

export function getCurrentScope() {
  return currentScope;
}

export function onScopeDispose(fn) {
  // no-op
}

export function getCurrentInstance() {
  return null;
}

export function hasInjectionContext() {
  return false;
}

// Simple computed implementation for tests
export function computed(getter) {
  return {
    value: getter(),
    __v_isRef: true,
    __v_isReadonly: true,
  };
}

// Watch implementation for tests
export function watch(source, callback, options) {
  // Return cleanup function
  return () => {};
}

// onWatcherCleanup for Vue 3.5+ - registers cleanup callback inside watch
// In tests, this is a no-op since watches don't actually run reactively
export function onWatcherCleanup(cleanupFn) {
  // No-op in tests - cleanup function is registered but not called
}

// WatchEffect implementation for tests
export function watchEffect(effect, options) {
  // Run effect once immediately
  effect();
  // Return cleanup function
  return () => {};
}

// Lifecycle hooks (no-ops in tests)
export function onMounted(hook) {}
export function onBeforeMount(hook) {}
export function onBeforeUnmount(hook) {}
export function onUnmounted(hook) {}
export function onUpdated(hook) {}
export function onBeforeUpdate(hook) {}

// Provide/inject for dependency injection
const injectMap = new Map();

export function provide(key, value) {
  injectMap.set(key, value);
}

export function inject(key, defaultValue) {
  return injectMap.has(key) ? injectMap.get(key) : defaultValue;
}

// Component creation
export function createApp(rootComponent) {
  return {
    provide(key, value) {
      provide(key, value);
      return this;
    },
    mount(selector) {
      return {};
    },
    unmount() {},
  };
}

// nextTick for async updates
export function nextTick(callback) {
  return Promise.resolve().then(callback);
}

// isRef helper
export function isRef(r) {
  return r?.__v_isRef === true;
}

// toRef helper
export function toRef(object, key) {
  const wrapper = {
    __v_isRef: true,
    get value() {
      return object[key];
    },
    set value(newVal) {
      object[key] = newVal;
    }
  };
  return wrapper;
}

// toRefs helper
export function toRefs(object) {
  const ret = {};
  for (const key in object) {
    ret[key] = toRef(object, key);
  }
  return ret;
}

// unref helper
export function unref(ref) {
  return isRef(ref) ? ref.value : ref;
}

// isReactive helper
export function isReactive(obj) {
  return obj && obj.__v_isReactive === true;
}

// shallowRef helper
export function shallowRef(value) {
  return ref(value);
}

// useTemplateRef for Vue 3.5+ - returns a ref that will be filled with template element
export function useTemplateRef(key) {
  return ref(null);
}

// Default export
export default {
  ref,
  reactive,
  computed,
  watch,
  onWatcherCleanup,
  watchEffect,
  onMounted,
  onBeforeMount,
  onBeforeUnmount,
  onUnmounted,
  onUpdated,
  onBeforeUpdate,
  provide,
  inject,
  createApp,
  nextTick,
  isRef,
  toRef,
  toRefs,
  unref,
  markRaw,
  toRaw,
  effectScope,
  getCurrentScope,
  onScopeDispose,
  getCurrentInstance,
  hasInjectionContext,
  isReactive,
  shallowRef,
  useTemplateRef,
};
