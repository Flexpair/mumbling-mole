/**
 * Utilities for safe promise caching to prevent race conditions
 * during async initialization in Vue composables
 */

/**
 * Creates a race-safe cached initializer function
 * Ensures only one initialization runs at a time, subsequent calls wait for the same promise
 * 
 * @param {Function} initFn - Async initialization function
 * @returns {Function} Cached initialization function
 * 
 * @example
 * const initializeAudioContext = createCachedInit(async () => {
 *   if (audioContext) return;
 *   audioContext = await ensureAudioContext();
 * });
 */
export function createCachedInit(initFn) {
  let cachedValue = null;
  let pendingPromise = null;
  
  return async function(...args) {
    // Return if already initialized
    if (cachedValue !== null) {
      return cachedValue;
    }
    
    // Return pending promise if initialization is in progress
    if (pendingPromise) {
      return pendingPromise;
    }
    
    // Start new initialization
    pendingPromise = (async () => {
      try {
        cachedValue = await initFn(...args);
        return cachedValue;
      } finally {
        // Clear promise reference once complete (success or failure)
        pendingPromise = null;
      }
    })();
    
    return pendingPromise;
  };
}

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
