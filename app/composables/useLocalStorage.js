/**
 * useLocalStorage - Vue Composable for localStorage Sync
 * 
 * Provides reactive localStorage access with automatic persistence.
 * Eliminates boilerplate code for reading/writing localStorage.
 * 
 * Features:
 * - Automatic type coercion (string, number, boolean, object/array via JSON)
 * - Lazy initialization (reads from localStorage only once)
 * - Auto-save on value change (via Vue watch)
 * - Optional key prefix for namespacing
 * 
 * @example
 * // Simple usage
 * const username = useLocalStorage('username', 'Guest');
 * username.value = 'Alice'; // Automatically saved to localStorage
 * 
 * @example
 * // With prefix
 * const volume = useLocalStorage('volume', 50, { prefix: 'mumble.' });
 * // Stored as 'mumble.volume' in localStorage
 * 
 * @example
 * // Object/Array storage (auto-serialized as JSON)
 * const settings = useLocalStorage('settings', { theme: 'dark', lang: 'en' });
 * settings.value.theme = 'light'; // Triggers save
 */

import { ref, watch } from 'vue';

/**
 * Create a reactive ref that syncs with localStorage
 * 
 * @param {string} key - localStorage key (will be prefixed if options.prefix is set)
 * @param {*} defaultValue - Default value if key doesn't exist in localStorage
 * @param {Object} options - Configuration options
 * @param {string} options.prefix - Key prefix for namespacing (default: '')
 * @param {boolean} options.writeDefaults - Write default value to localStorage if key missing (default: true)
 * @param {Function} options.serializer - Custom serializer (default: JSON.stringify for objects)
 * @param {Function} options.deserializer - Custom deserializer (default: JSON.parse for objects)
 * @returns {Ref} - Vue ref that auto-syncs with localStorage
 */
export function useLocalStorage(key, defaultValue, options = {}) {
  const {
    prefix = '',
    writeDefaults = true,
    serializer = null,
    deserializer = null,
  } = options;

  // Full key with prefix
  const storageKey = prefix + key;

  // Determine type-specific serialization
  const isObject = typeof defaultValue === 'object' && defaultValue !== null;
  const serialize = serializer || (isObject ? JSON.stringify : String);
  const deserialize = deserializer || (isObject ? JSON.parse : (val) => {
    // Type coercion based on defaultValue type
    if (typeof defaultValue === 'number') return Number(val);
    if (typeof defaultValue === 'boolean') return val === 'true';
    return val;
  });

  // Read initial value from localStorage
  const readValue = () => {
    try {
      const item = globalThis.localStorage.getItem(storageKey);
      
      if (item !== null) {
        // Deserialize stored value
        return deserialize(item);
      }
      
      // No stored value - use default and optionally write it
      if (writeDefaults) {
        globalThis.localStorage.setItem(storageKey, serialize(defaultValue));
      }
      return defaultValue;
      
    } catch (error) {
      console.warn(`[useLocalStorage] Failed to read key "${storageKey}":`, error);
      return defaultValue;
    }
  };

  // Create reactive ref with initial value from localStorage
  const storedValue = ref(readValue());

  // Watch for changes and sync to localStorage
  watch(storedValue, (newValue) => {
    try {
      globalThis.localStorage.setItem(storageKey, serialize(newValue));
    } catch (error) {
      console.error(`[useLocalStorage] Failed to write key "${storageKey}":`, error);
    }
  }, { deep: isObject }); // Deep watch for objects/arrays

  return storedValue;
}
