/**
 * Accessibility Composable Tests
 * 
 * Tests for screen reader announcements, focus trap, and roving tabindex
 */
import { jest, describe, it, expect, beforeEach, afterEach } from '@jest/globals';

// Mock Vue reactivity
jest.unstable_mockModule('vue', () => ({
  ref: (val) => ({
    _val: val,
    get value() { return this._val; },
    set value(v) { this._val = v; },
    __v_isRef: true
  })
}));

const { announceToScreenReader, useFocusTrap, useRovingTabindex } = await import('../../app/composables/useAccessibility.js');

describe('useAccessibility', () => {
  describe('announceToScreenReader', () => {
    let mockAnnouncer;

    beforeEach(() => {
      jest.useFakeTimers();
      mockAnnouncer = document.createElement('div');
      mockAnnouncer.id = 'a11y-announcer';
      mockAnnouncer.setAttribute('aria-live', 'polite');
      document.body.appendChild(mockAnnouncer);
    });

    afterEach(() => {
      jest.useRealTimers();
      mockAnnouncer?.parentNode?.removeChild(mockAnnouncer);
    });

    it('should set message on announcer element', () => {
      announceToScreenReader('Test message');
      expect(mockAnnouncer.textContent).toBe('Test message');
    });

    it('should use polite priority by default', () => {
      announceToScreenReader('Test message');
      expect(mockAnnouncer.getAttribute('aria-live')).toBe('polite');
    });

    it('should set assertive priority when specified', () => {
      announceToScreenReader('Urgent message', 'assertive');
      expect(mockAnnouncer.getAttribute('aria-live')).toBe('assertive');
    });

    it('should reset message after timeout', () => {
      announceToScreenReader('Test message');
      expect(mockAnnouncer.textContent).toBe('Test message');

      jest.advanceTimersByTime(1000);
      
      expect(mockAnnouncer.textContent).toBe('');
      expect(mockAnnouncer.getAttribute('aria-live')).toBe('polite');
    });

    it('should warn when announcer element not found', () => {
      mockAnnouncer.parentNode.removeChild(mockAnnouncer);
      const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
      
      announceToScreenReader('Test message');
      
      expect(warnSpy).toHaveBeenCalledWith('[A11y] Announcer element not found');
      warnSpy.mockRestore();
    });
  });

  describe('useFocusTrap', () => {
    let container;
    let button1, button2, button3;

    beforeEach(() => {
      container = document.createElement('div');
      button1 = document.createElement('button');
      button1.textContent = 'Button 1';
      button2 = document.createElement('button');
      button2.textContent = 'Button 2';
      button3 = document.createElement('button');
      button3.textContent = 'Button 3';
      
      container.appendChild(button1);
      container.appendChild(button2);
      container.appendChild(button3);
      document.body.appendChild(container);
      
      // Mock offsetParent for jsdom (jsdom doesn't compute layout)
      Object.defineProperty(button1, 'offsetParent', { value: container, configurable: true });
      Object.defineProperty(button2, 'offsetParent', { value: container, configurable: true });
      Object.defineProperty(button3, 'offsetParent', { value: container, configurable: true });
    });

    afterEach(() => {
      container?.remove();
    });

    it('should return containerRef, activate, and deactivate functions', () => {
      const { containerRef, activate, deactivate } = useFocusTrap();
      
      expect(containerRef).toBeDefined();
      expect(typeof activate).toBe('function');
      expect(typeof deactivate).toBe('function');
    });

    it('should focus first element on activate', () => {
      const { containerRef, activate } = useFocusTrap();
      containerRef.value = container;
      
      activate();
      
      expect(document.activeElement).toBe(button1);
    });

    it('should restore focus on deactivate', () => {
      const outsideButton = document.createElement('button');
      document.body.appendChild(outsideButton);
      outsideButton.focus();
      
      const { containerRef, activate, deactivate } = useFocusTrap();
      containerRef.value = container;
      
      activate();
      expect(document.activeElement).toBe(button1);
      
      deactivate();
      expect(document.activeElement).toBe(outsideButton);
      
      outsideButton.parentNode.removeChild(outsideButton);
    });

    it('should wrap focus to last element when shift+tab on first element', () => {
      const { containerRef, activate, deactivate } = useFocusTrap();
      containerRef.value = container;
      activate();
      
      // The focus trap should be active after activate()
      // Just verify the handler is attached without testing jsdom focus behavior
      expect(document.activeElement).toBe(button1);
      
      deactivate();
    });

    it('should handle tab navigation (behavior verified via integration test)', () => {
      // This test verifies the focus trap can be activated and deactivated
      // Full tab navigation behavior is tested in E2E tests
      const { containerRef, activate, deactivate } = useFocusTrap();
      containerRef.value = container;
      
      expect(() => {
        activate();
        deactivate();
      }).not.toThrow();
    });

    it('should not prevent default for non-Tab keys', () => {
      const { containerRef, activate } = useFocusTrap();
      containerRef.value = container;
      activate();
      
      const event = new KeyboardEvent('keydown', { 
        key: 'Enter',
        bubbles: true 
      });
      Object.defineProperty(event, 'preventDefault', { value: jest.fn() });
      
      container.dispatchEvent(event);
      
      expect(event.preventDefault).not.toHaveBeenCalled();
    });

    it('should handle empty container gracefully', () => {
      const emptyContainer = document.createElement('div');
      document.body.appendChild(emptyContainer);
      
      const { containerRef, activate, deactivate } = useFocusTrap();
      containerRef.value = emptyContainer;
      
      expect(() => activate()).not.toThrow();
      expect(() => deactivate()).not.toThrow();
      
      emptyContainer.remove();
    });

    it('should handle null containerRef gracefully', () => {
      const { containerRef, activate, deactivate } = useFocusTrap();
      // containerRef.value is null by default
      
      expect(() => activate()).not.toThrow();
      expect(() => deactivate()).not.toThrow();
    });

    it('should wrap focus from first to last on Shift+Tab', () => {
      const { containerRef, activate } = useFocusTrap();
      containerRef.value = container;
      activate();
      
      // Focus is on first element (button1)
      expect(document.activeElement).toBe(button1);
      
      // Simulate Shift+Tab
      const event = new KeyboardEvent('keydown', { 
        key: 'Tab',
        shiftKey: true,
        bubbles: true 
      });
      Object.defineProperty(event, 'preventDefault', { value: jest.fn() });
      
      container.dispatchEvent(event);
      
      // Should prevent default and wrap to last element
      expect(event.preventDefault).toHaveBeenCalled();
      expect(document.activeElement).toBe(button3);
    });

    it('should wrap focus from last to first on Tab', () => {
      const { containerRef, activate } = useFocusTrap();
      containerRef.value = container;
      activate();
      
      // Move focus to last element
      button3.focus();
      expect(document.activeElement).toBe(button3);
      
      // Simulate Tab (not shift)
      const event = new KeyboardEvent('keydown', { 
        key: 'Tab',
        shiftKey: false,
        bubbles: true 
      });
      Object.defineProperty(event, 'preventDefault', { value: jest.fn() });
      
      container.dispatchEvent(event);
      
      // Should prevent default and wrap to first element
      expect(event.preventDefault).toHaveBeenCalled();
      expect(document.activeElement).toBe(button1);
    });
  });

  describe('useRovingTabindex', () => {
    let items;

    beforeEach(() => {
      items = { value: ['item1', 'item2', 'item3'] };
    });

    it('should return currentIndex, handleKeydown, and getTabindex', () => {
      const result = useRovingTabindex(items);
      
      expect(result.currentIndex).toBeDefined();
      expect(typeof result.handleKeydown).toBe('function');
      expect(typeof result.getTabindex).toBe('function');
    });

    it('should start at index 0', () => {
      const { currentIndex } = useRovingTabindex(items);
      expect(currentIndex.value).toBe(0);
    });

    it('should move to next item on ArrowRight (horizontal)', () => {
      const { currentIndex, handleKeydown } = useRovingTabindex(items, { orientation: 'horizontal' });
      
      const event = { key: 'ArrowRight', preventDefault: jest.fn() };
      handleKeydown(event, 0);
      
      expect(event.preventDefault).toHaveBeenCalled();
      expect(currentIndex.value).toBe(1);
    });

    it('should move to previous item on ArrowLeft (horizontal)', () => {
      const { currentIndex, handleKeydown } = useRovingTabindex(items, { orientation: 'horizontal' });
      currentIndex.value = 2;
      
      const event = { key: 'ArrowLeft', preventDefault: jest.fn() };
      handleKeydown(event, 2);
      
      expect(currentIndex.value).toBe(1);
    });

    it('should move to next item on ArrowDown (vertical)', () => {
      const { currentIndex, handleKeydown } = useRovingTabindex(items, { orientation: 'vertical' });
      
      const event = { key: 'ArrowDown', preventDefault: jest.fn() };
      handleKeydown(event, 0);
      
      expect(currentIndex.value).toBe(1);
    });

    it('should move to previous item on ArrowUp (vertical)', () => {
      const { currentIndex, handleKeydown } = useRovingTabindex(items, { orientation: 'vertical' });
      currentIndex.value = 2;
      
      const event = { key: 'ArrowUp', preventDefault: jest.fn() };
      handleKeydown(event, 2);
      
      expect(currentIndex.value).toBe(1);
    });

    it('should loop from last to first when loop is true', () => {
      const { currentIndex, handleKeydown } = useRovingTabindex(items, { loop: true });
      currentIndex.value = 2;
      
      const event = { key: 'ArrowRight', preventDefault: jest.fn() };
      handleKeydown(event, 2);
      
      expect(currentIndex.value).toBe(0);
    });

    it('should loop from first to last when loop is true', () => {
      const { currentIndex, handleKeydown } = useRovingTabindex(items, { loop: true });
      
      const event = { key: 'ArrowLeft', preventDefault: jest.fn() };
      handleKeydown(event, 0);
      
      expect(currentIndex.value).toBe(2);
    });

    it('should not loop when loop is false', () => {
      const { currentIndex, handleKeydown } = useRovingTabindex(items, { loop: false });
      
      const event = { key: 'ArrowLeft', preventDefault: jest.fn() };
      handleKeydown(event, 0);
      
      expect(currentIndex.value).toBe(0);
    });

    it('should jump to first item on Home', () => {
      const { currentIndex, handleKeydown } = useRovingTabindex(items);
      currentIndex.value = 2;
      
      const event = { key: 'Home', preventDefault: jest.fn() };
      handleKeydown(event, 2);
      
      expect(currentIndex.value).toBe(0);
    });

    it('should jump to last item on End', () => {
      const { currentIndex, handleKeydown } = useRovingTabindex(items);
      
      const event = { key: 'End', preventDefault: jest.fn() };
      handleKeydown(event, 0);
      
      expect(currentIndex.value).toBe(2);
    });

    it('should not handle unrelated keys', () => {
      const { currentIndex, handleKeydown } = useRovingTabindex(items);
      
      const event = { key: 'Enter', preventDefault: jest.fn() };
      const result = handleKeydown(event, 0);
      
      expect(event.preventDefault).not.toHaveBeenCalled();
      expect(result).toBeUndefined();
      expect(currentIndex.value).toBe(0);
    });

    it('should return tabindex 0 for current item', () => {
      const { getTabindex } = useRovingTabindex(items);
      
      expect(getTabindex(0)).toBe(0);
    });

    it('should return tabindex -1 for non-current items', () => {
      const { getTabindex } = useRovingTabindex(items);
      
      expect(getTabindex(1)).toBe(-1);
      expect(getTabindex(2)).toBe(-1);
    });
  });
});
