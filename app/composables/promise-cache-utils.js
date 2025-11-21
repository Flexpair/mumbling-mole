/**
 * Utilities for safe promise caching to prevent race conditions
 * during async initialization in Vue composables
 */

/**
 * Creates a race-safe cached initializer with custom cache check
 * Useful when initialization success depends on external state
 * 
 * @param {Function} checkCached - Function that returns cached value if exists, null otherwise
 * @param {Function} initFn - Async initialization function
 * @returns {Function} Cached initialization function
 * 
 * @example
 * const initBeeper = createCachedInitWithCheck(
 *   () => _persistentBeeper, // check function
 *   async () => { // init function
 *     _persistentBeeper = createBeeper();
 *     return _persistentBeeper;
 *   }
 * );
 */
export function createCachedInitWithCheck(checkCached, initFn) {
  let pendingPromise = null;
  
  return async function(...args) {
    // Check if already initialized
    const cached = checkCached();
    if (cached) {
      return cached;
    }
    
    // Return pending promise if initialization is in progress
    if (pendingPromise) {
      return pendingPromise;
    }
    
    // Start new initialization
    pendingPromise = (async () => {
      try {
        return await initFn(...args);
      } finally {
        // Clear promise reference once complete
        pendingPromise = null;
      }
    })();
    
    return pendingPromise;
  };
}
