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
    
    // Action data may contain credentials, so log metadata only.
    store.$onAction(({ name, after, onError }) => {
      const startTime = performance.now();
      console.log('[PINIA:%s] → %s', storeId, name);
      
      after(() => {
        const duration = (performance.now() - startTime).toFixed(1);
        console.log('[PINIA:%s] ✓ %s (%sms)', storeId, name, duration);
      });
      
      onError(() => {
        const duration = (performance.now() - startTime).toFixed(1);
        console.error('[PINIA:%s] ✗ %s failed (%sms)', storeId, name, duration);
      });
    });
  };
}
