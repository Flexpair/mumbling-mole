/**
 * useDebounce - Vue Composable for Debounced Values
 * 
 * Debounces a ref value - useful for search inputs, resize handlers, etc.
 * 
 * @example
 * const searchQuery = ref('');
 * const debouncedQuery = useDebounce(searchQuery, 300);
 * 
 * watch(debouncedQuery, (newVal) => {
 *   // This runs 300ms after user stops typing
 *   performSearch(newVal);
 * });
 */

import { ref, watch, unref } from 'vue';

export function useDebounce(value, delay = 300) {
  const debouncedValue = ref(unref(value));
  let timeoutId = null;

  watch(
    () => unref(value),
    (newVal) => {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
      timeoutId = setTimeout(() => {
        debouncedValue.value = newVal;
      }, delay);
    }
  );

  // Cleanup on unmount
  const stopDebounce = () => {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
  };

  return { debouncedValue, stopDebounce };
}

/**
 * useThrottle - Vue Composable for Throttled Values
 * 
 * Throttles a ref value - limits update frequency.
 * 
 * @example
 * const scrollPosition = ref(0);
 * const throttledScroll = useThrottle(scrollPosition, 100);
 */

export function useThrottle(value, delay = 300) {
  const throttledValue = ref(unref(value));
  let lastUpdate = 0;
  let timeoutId = null;

  watch(
    () => unref(value),
    (newVal) => {
      const now = Date.now();
      
      if (now - lastUpdate >= delay) {
        // Immediate update if enough time has passed
        throttledValue.value = newVal;
        lastUpdate = now;
      } else {
        // Schedule update for later
        if (timeoutId) {
          clearTimeout(timeoutId);
        }
        timeoutId = setTimeout(() => {
          throttledValue.value = newVal;
          lastUpdate = Date.now();
        }, delay - (now - lastUpdate));
      }
    }
  );

  const stopThrottle = () => {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
  };

  return { throttledValue, stopThrottle };
}
