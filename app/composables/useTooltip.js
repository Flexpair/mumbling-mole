/**
 * useTooltip - Vue Composable for Tooltip Management
 * 
 * Provides reactive tooltip state and positioning logic.
 * Can be used with v-tooltip custom directive.
 */

import { reactive } from 'vue';

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

    // Show handler with viewport boundary detection
    const showTooltip = (e) => {
      const rect = el.getBoundingClientRect();
      const tooltipWidth = tooltip.offsetWidth;
      const tooltipHeight = tooltip.offsetHeight;
      const spacing = 8;
      
      // Calculate horizontal position (centered, clamped to viewport)
      let left = rect.left + rect.width / 2 - tooltipWidth / 2;
      left = Math.max(4, Math.min(left, globalThis.innerWidth - tooltipWidth - 4));
      
      // Try to position above; if not enough space, position below
      let top = rect.top - tooltipHeight - spacing;
      if (top < 4) {
        // Not enough space above, position below
        top = rect.bottom + spacing;
        
        // If still offscreen at bottom, clamp to bottom edge
        if (top + tooltipHeight > globalThis.innerHeight - 4) {
          top = globalThis.innerHeight - tooltipHeight - 4;
        }
      }
      
      tooltip.style.left = left + 'px';
      tooltip.style.top = top + 'px';
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
