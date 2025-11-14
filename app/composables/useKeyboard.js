/**
 * useKeyboard - Vue Composable for Keyboard Event Handling
 * 
 * Provides reactive keyboard shortcut handling with automatic cleanup.
 * 
 * @example
 * const { isPressed, onKey } = useKeyboard();
 * 
 * onKey('ctrl+s', (e) => {
 *   e.preventDefault();
 *   save();
 * });
 * 
 * // Check if key is currently pressed
 * watch(() => isPressed('Shift'), (pressed) => {
 *   console.log('Shift pressed:', pressed);
 * });
 */

import { ref, onMounted, onBeforeUnmount } from 'vue';

export function useKeyboard() {
  const pressedKeys = ref(new Set());
  const handlers = new Map();

  const handleKeyDown = (e) => {
    pressedKeys.value.add(e.key);
    
    // Check registered handlers
    for (const [combo, callback] of handlers) {
      if (matchesCombo(e, combo)) {
        callback(e);
      }
    }
  };

  const handleKeyUp = (e) => {
    pressedKeys.value.delete(e.key);
  };

  const matchesCombo = (e, combo) => {
    const parts = combo.toLowerCase().split('+').map(s => s.trim());
    
    let requiresCtrl = parts.includes('ctrl') || parts.includes('control');
    let requiresShift = parts.includes('shift');
    let requiresAlt = parts.includes('alt');
    let requiresMeta = parts.includes('meta') || parts.includes('cmd');
    
    const key = parts.find(p => !['ctrl', 'control', 'shift', 'alt', 'meta', 'cmd'].includes(p));
    
    return (
      (requiresCtrl === e.ctrlKey || requiresMeta === e.metaKey) &&
      requiresShift === e.shiftKey &&
      requiresAlt === e.altKey &&
      (!key || e.key.toLowerCase() === key)
    );
  };

  const onKey = (combo, callback) => {
    handlers.set(combo, callback);
  };

  const offKey = (combo) => {
    handlers.delete(combo);
  };

  const isPressed = (key) => {
    return pressedKeys.value.has(key);
  };

  onMounted(() => {
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
  });

  onBeforeUnmount(() => {
    window.removeEventListener('keydown', handleKeyDown);
    window.removeEventListener('keyup', handleKeyUp);
    handlers.clear();
  });

  return {
    pressedKeys,
    isPressed,
    onKey,
    offKey,
  };
}
