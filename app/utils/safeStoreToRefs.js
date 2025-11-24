import { toRaw, isRef, toRef } from 'vue';

/**
 * A safe version of storeToRefs that handles null values in the store
 * without crashing (which Pinia's storeToRefs does in some environments).
 * 
 * @param {object} store - The Pinia store
 * @returns {object} Object of refs
 */
export function safeStoreToRefs(store) {
  const refs = {};
  const raw = toRaw(store);
  
  for (const key in raw) {
    // Skip internal properties and functions (actions)
    if (key.startsWith('$') || key.startsWith('_')) continue;
    
    const value = raw[key];
    if (typeof value === 'function') continue;
    
    if (isRef(value)) {
      refs[key] = value;
    } else {
      refs[key] = toRef(store, key);
    }
  }
  
  return refs;
}
