/**
 * Pinia Debug Plugin
 * 
 * Logs all store actions when ?debug-audio URL parameter is present.
 * Useful for debugging audio pipeline state changes.
 * 
 * Usage:
 *   import { createPiniaDebugPlugin } from './plugins/pinia-debug';
 *   const pinia = createPinia();
 *   pinia.use(createPiniaDebugPlugin());
 */

/**
 * Creates a Pinia plugin that logs store actions for debugging
 * Only active when globalThis.MUMBLE_DEBUG_AUDIO is true
 * @returns {import('pinia').PiniaPlugin}
 */
export function createPiniaDebugPlugin() {
  return ({ store }) => {
    // Only enable in debug mode (set by ?debug-audio URL param)
    if (!globalThis.MUMBLE_DEBUG_AUDIO) return;
    
    const storeId = store.$id;
    
    // Log all actions with timing
    store.$onAction(({ name, args, after, onError }) => {
      const startTime = performance.now();
      console.log(`[PINIA:${storeId}] → ${name}`, args.length ? args : '');
      
      after((result) => {
        const duration = (performance.now() - startTime).toFixed(1);
        if (result !== undefined) {
          console.log(`[PINIA:${storeId}] ✓ ${name} (${duration}ms)`, result);
        } else {
          console.log(`[PINIA:${storeId}] ✓ ${name} (${duration}ms)`);
        }
      });
      
      onError((error) => {
        const duration = (performance.now() - startTime).toFixed(1);
        console.error(`[PINIA:${storeId}] ✗ ${name} failed (${duration}ms):`, error);
      });
    });
  };
}
