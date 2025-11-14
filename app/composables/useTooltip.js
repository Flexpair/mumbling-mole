/**
 * useTooltip - Vue Composable for Tooltip Management
 * 
 * Provides reactive tooltip state and positioning logic.
 * Can be used with v-tooltip custom directive.
 */

import { ref, reactive } from 'vue';

export function useTooltip() {
  const tooltipState = reactive({
    visible: false,
    text: '',
    x: 0,
    y: 0,
  });

  const show = (text, event) => {
    tooltipState.text = text;
    tooltipState.x = event.clientX;
    tooltipState.y = event.clientY;
    tooltipState.visible = true;
  };

  const hide = () => {
    tooltipState.visible = false;
  };

  return {
    tooltipState,
    show,
    hide,
  };
}

/**
 * v-tooltip Custom Directive
 * 
 * Usage: <button v-tooltip="'Click me!'">Button</button>
 * or: <button v-tooltip="{ text: 'Click me!', placement: 'top' }">Button</button>
 */
export const vTooltip = {
  mounted(el, binding) {
    const text = typeof binding.value === 'string' ? binding.value : binding.value?.text;
    
    if (!text) return;

    // Create tooltip element
    const tooltip = document.createElement('div');
    tooltip.className = 'vue-tooltip';
    tooltip.textContent = text;
    tooltip.style.cssText = `
      position: fixed;
      background: rgba(0, 0, 0, 0.85);
      color: white;
      padding: 6px 10px;
      border-radius: 4px;
      font-size: 12px;
      pointer-events: none;
      z-index: 9999;
      opacity: 0;
      transition: opacity 0.2s ease;
      white-space: nowrap;
    `;
    document.body.appendChild(tooltip);
    el._tooltip = tooltip;

    // Show handler
    const showTooltip = (e) => {
      const rect = el.getBoundingClientRect();
      tooltip.style.left = rect.left + rect.width / 2 - tooltip.offsetWidth / 2 + 'px';
      tooltip.style.top = rect.top - tooltip.offsetHeight - 8 + 'px';
      tooltip.style.opacity = '1';
    };

    // Hide handler
    const hideTooltip = () => {
      tooltip.style.opacity = '0';
    };

    el.addEventListener('mouseenter', showTooltip);
    el.addEventListener('mouseleave', hideTooltip);
    el._tooltipShowHandler = showTooltip;
    el._tooltipHideHandler = hideTooltip;
  },

  updated(el, binding) {
    const text = typeof binding.value === 'string' ? binding.value : binding.value?.text;
    if (el._tooltip) {
      el._tooltip.textContent = text || '';
    }
  },

  unmounted(el) {
    if (el._tooltip) {
      el._tooltip.remove();
    }
    if (el._tooltipShowHandler) {
      el.removeEventListener('mouseenter', el._tooltipShowHandler);
    }
    if (el._tooltipHideHandler) {
      el.removeEventListener('mouseleave', el._tooltipHideHandler);
    }
  }
};
