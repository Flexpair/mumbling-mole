/**
 * Vue 3 mock for Jest tests
 * 
 * Provides minimal Vue reactivity API for testing composables.
 * Real Vue integration is tested via component integration tests.
 */

// Simple ref implementation for tests
export function ref(value) {
  const r = {
    value,
    __v_isRef: true,
  };
  return r;
}

// Simple reactive implementation for tests
export function reactive(obj) {
  return obj;
}

// markRaw implementation for tests - prevents reactivity
export function markRaw(obj) {
  return obj;
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
  return !!(r && r.__v_isRef === true);
}

// toRef helper
export function toRef(object, key) {
  return {
    get value() {
      return object[key];
    },
    set value(val) {
      object[key] = val;
    },
    __v_isRef: true,
  };
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

// Default export
export default {
  ref,
  reactive,
  computed,
  watch,
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
};
