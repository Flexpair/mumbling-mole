/**
 * Composables Tests
 * 
 * Tests for Vue composables:
 * - useLocalStorage
 * - useClipboard
 * - useTooltip (vTooltip directive)
 */
import { jest, describe, it, expect, beforeEach, afterEach } from '@jest/globals';

// We test the logic directly, not through Vue reactivity
// since Jest environment doesn't have full Vue setup

describe('useLocalStorage', () => {
  let mockStorage;
  let useLocalStorage;

  beforeEach(async () => {
    mockStorage = {};
    globalThis.localStorage = {
      getItem: jest.fn((key) => mockStorage[key] ?? null),
      setItem: jest.fn((key, value) => { mockStorage[key] = value; }),
      removeItem: jest.fn((key) => { delete mockStorage[key]; }),
      clear: jest.fn(() => { mockStorage = {}; }),
    };
    
    // Import after setting up mocks
    const module = await import('../../app/composables/useLocalStorage.js');
    useLocalStorage = module.useLocalStorage;
  });

  afterEach(() => {
    delete globalThis.localStorage;
  });

  describe('Basic functionality', () => {
    it('should return default value when key not in storage', () => {
      const value = useLocalStorage('testKey', 'defaultValue');
      
      expect(value.value).toBe('defaultValue');
    });

    it('should read existing value from storage', () => {
      mockStorage['testKey'] = 'storedValue';
      
      const value = useLocalStorage('testKey', 'defaultValue');
      
      expect(value.value).toBe('storedValue');
    });

    it('should write default value to storage when key missing', () => {
      useLocalStorage('testKey', 'defaultValue');
      
      expect(globalThis.localStorage.setItem).toHaveBeenCalledWith('testKey', 'defaultValue');
    });

    it('should not write default when writeDefaults is false', () => {
      useLocalStorage('testKey', 'defaultValue', { writeDefaults: false });
      
      expect(globalThis.localStorage.setItem).not.toHaveBeenCalled();
    });
  });

  describe('Type coercion', () => {
    it('should handle number type', () => {
      mockStorage['volume'] = '75';
      
      const volume = useLocalStorage('volume', 50);
      
      expect(volume.value).toBe(75);
      expect(typeof volume.value).toBe('number');
    });

    it('should handle boolean type (true)', () => {
      mockStorage['enabled'] = 'true';
      
      const enabled = useLocalStorage('enabled', false);
      
      expect(enabled.value).toBe(true);
    });

    it('should handle boolean type (false)', () => {
      mockStorage['enabled'] = 'false';
      
      const enabled = useLocalStorage('enabled', true);
      
      expect(enabled.value).toBe(false);
    });

    it('should handle object type with JSON', () => {
      mockStorage['settings'] = '{"theme":"dark","lang":"en"}';
      
      const settings = useLocalStorage('settings', { theme: 'light' });
      
      expect(settings.value).toEqual({ theme: 'dark', lang: 'en' });
    });

    it('should handle array type with JSON', () => {
      mockStorage['items'] = '[1,2,3]';
      
      const items = useLocalStorage('items', []);
      
      expect(items.value).toEqual([1, 2, 3]);
    });
  });

  describe('Prefix option', () => {
    it('should apply prefix to key', () => {
      useLocalStorage('setting', 'value', { prefix: 'mumble.' });
      
      expect(globalThis.localStorage.getItem).toHaveBeenCalledWith('mumble.setting');
    });

    it('should read from prefixed key', () => {
      mockStorage['app.theme'] = 'dark';
      
      const theme = useLocalStorage('theme', 'light', { prefix: 'app.' });
      
      expect(theme.value).toBe('dark');
    });
  });

  describe('Error handling', () => {
    it('should return default on read error', () => {
      globalThis.localStorage.getItem = jest.fn(() => {
        throw new Error('Storage error');
      });
      
      const value = useLocalStorage('key', 'default');
      
      expect(value.value).toBe('default');
    });

    it('should handle JSON parse error gracefully', () => {
      mockStorage['settings'] = 'invalid json{';
      
      // Should not throw, returns default
      const settings = useLocalStorage('settings', { default: true });
      
      expect(settings.value).toEqual({ default: true });
    });
  });
});

describe('useClipboard', () => {
  let mockClipboard;
  let useClipboard;

  beforeEach(async () => {
    jest.useFakeTimers();
    mockClipboard = {
      writeText: jest.fn().mockResolvedValue(undefined),
    };
    globalThis.navigator = { clipboard: mockClipboard };
    
    const module = await import('../../app/composables/useClipboard.js');
    useClipboard = module.useClipboard;
  });

  afterEach(() => {
    jest.useRealTimers();
    delete globalThis.navigator;
  });

  it('should initialize with default state', () => {
    const { copied, error, text } = useClipboard();
    
    expect(copied.value).toBe(false);
    expect(error.value).toBeNull();
    expect(text.value).toBe('');
  });

  it('should copy text to clipboard', async () => {
    const { copy, copied, text } = useClipboard();
    
    const result = await copy('Hello World');
    
    expect(result).toBe(true);
    expect(mockClipboard.writeText).toHaveBeenCalledWith('Hello World');
    expect(copied.value).toBe(true);
    expect(text.value).toBe('Hello World');
  });

  it('should reset copied state after timeout', async () => {
    const { copy, copied } = useClipboard({ timeout: 1000 });
    
    await copy('text');
    expect(copied.value).toBe(true);
    
    jest.advanceTimersByTime(1000);
    expect(copied.value).toBe(false);
  });

  it('should handle copy failure', async () => {
    mockClipboard.writeText.mockRejectedValue(new Error('Copy failed'));
    
    const { copy, copied, error } = useClipboard();
    
    const result = await copy('text');
    
    expect(result).toBe(false);
    expect(copied.value).toBe(false);
    expect(error.value).toBe('Copy failed');
  });

  it('should handle copy failure without error message', async () => {
    // Error without message property - should fallback to default
    mockClipboard.writeText.mockRejectedValue({});
    
    const { copy, error } = useClipboard();
    
    const result = await copy('text');
    
    expect(result).toBe(false);
    expect(error.value).toBe('Failed to copy');
  });

  it('should reject empty value', async () => {
    const { copy, error } = useClipboard();
    
    const result = await copy('');
    
    expect(result).toBe(false);
    expect(error.value).toBe('No value provided');
  });

  it('should reject null/undefined value', async () => {
    const { copy, error } = useClipboard();
    
    await copy(null);
    expect(error.value).toBe('No value provided');
    
    await copy(undefined);
    expect(error.value).toBe('No value provided');
  });

  it('should reset all state', async () => {
    const { copy, copied, error, text, reset } = useClipboard();
    
    await copy('text');
    reset();
    
    expect(copied.value).toBe(false);
    expect(error.value).toBeNull();
    expect(text.value).toBe('');
  });
});

describe('vTooltip directive', () => {
  let mockElement;
  let appendedElements;
  let vTooltip;
  let createElementSpy;
  let appendChildSpy;

  beforeEach(async () => {
    appendedElements = [];
    
    mockElement = {
      getBoundingClientRect: jest.fn(() => ({
        top: 100,
        left: 100,
        bottom: 120,
        width: 80,
        height: 20,
      })),
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
    };

    const originalCreateElement = document.createElement.bind(document);
    createElementSpy = jest.spyOn(document, 'createElement').mockImplementation((tagName) => {
      const element = originalCreateElement(tagName);
      Object.defineProperty(element, 'offsetWidth', { configurable: true, value: 100 });
      Object.defineProperty(element, 'offsetHeight', { configurable: true, value: 30 });
      return element;
    });
    appendChildSpy = jest.spyOn(document.body, 'appendChild').mockImplementation((el) => {
      appendedElements.push(el);
      return Node.prototype.appendChild.call(document.body, el);
    });

    globalThis.innerWidth = 1024;
    globalThis.innerHeight = 768;
    
    const module = await import('../../app/composables/useTooltip.js');
    vTooltip = module.vTooltip;
  });

  afterEach(() => {
    createElementSpy?.mockRestore();
    appendChildSpy?.mockRestore();
    document.body.innerHTML = '';
    delete globalThis.innerWidth;
    delete globalThis.innerHeight;
  });

  describe('mounted hook', () => {
    it('should create tooltip element with string value', () => {
      vTooltip.mounted(mockElement, { value: 'Test tooltip' });
      
      // Check tooltip was created (using the real DOM)
      expect(mockElement._tooltip).toBeDefined();
      expect(mockElement._tooltip.textContent).toBe('Test tooltip');
      expect(mockElement._tooltip.tagName.toLowerCase()).toBe('div');
    });

    it('should create tooltip element with object value', () => {
      vTooltip.mounted(mockElement, { 
        value: { text: 'Object tooltip', placement: 'top' } 
      });
      
      expect(mockElement._tooltip.textContent).toBe('Object tooltip');
    });

    it('should not create tooltip without text', () => {
      vTooltip.mounted(mockElement, { value: '' });
      
      expect(mockElement._tooltip).toBeUndefined();
    });

    it('should register mouseenter and mouseleave handlers', () => {
      vTooltip.mounted(mockElement, { value: 'Tooltip' });
      
      expect(mockElement.addEventListener).toHaveBeenCalledWith(
        'mouseenter', 
        expect.any(Function)
      );
      expect(mockElement.addEventListener).toHaveBeenCalledWith(
        'mouseleave', 
        expect.any(Function)
      );
    });

    it('should set correct tooltip styles', () => {
      vTooltip.mounted(mockElement, { value: 'Tooltip' });
      
      expect(mockElement._tooltip.style.cssText).toContain('position: fixed');
      expect(mockElement._tooltip.style.cssText).toContain('z-index: 9999');
      expect(mockElement._tooltip.style.cssText).toContain('opacity: 0');
    });
  });

  describe('updated hook', () => {
    it('should update tooltip text', () => {
      vTooltip.mounted(mockElement, { value: 'Initial' });
      vTooltip.updated(mockElement, { value: 'Updated' });
      
      expect(mockElement._tooltip.textContent).toBe('Updated');
    });

    it('should handle object value in update', () => {
      vTooltip.mounted(mockElement, { value: 'Initial' });
      vTooltip.updated(mockElement, { value: { text: 'Updated object' } });
      
      expect(mockElement._tooltip.textContent).toBe('Updated object');
    });

    it('should handle missing value gracefully', () => {
      vTooltip.mounted(mockElement, { value: 'Initial' });
      vTooltip.updated(mockElement, { value: null });
      
      expect(mockElement._tooltip.textContent).toBe('');
    });
  });

  describe('unmounted hook', () => {
    it('should remove tooltip element', () => {
      vTooltip.mounted(mockElement, { value: 'Tooltip' });
      const tooltip = mockElement._tooltip;
      
      vTooltip.unmounted(mockElement);
      
      // Check tooltip is removed from DOM (parentNode should be null after remove())
      expect(tooltip.parentNode).toBeNull();
    });

    it('should remove event listeners', () => {
      vTooltip.mounted(mockElement, { value: 'Tooltip' });
      
      vTooltip.unmounted(mockElement);
      
      expect(mockElement.removeEventListener).toHaveBeenCalledWith(
        'mouseenter',
        mockElement._tooltipShowHandler
      );
      expect(mockElement.removeEventListener).toHaveBeenCalledWith(
        'mouseleave',
        mockElement._tooltipHideHandler
      );
    });

    it('should handle unmount without tooltip', () => {
      // Should not throw
      expect(() => vTooltip.unmounted(mockElement)).not.toThrow();
    });
  });

  describe('Tooltip positioning', () => {
    it('should show tooltip on mouseenter', () => {
      vTooltip.mounted(mockElement, { value: 'Tooltip' });
      
      // Trigger mouseenter
      mockElement._tooltipShowHandler({});
      
      expect(mockElement._tooltip.style.opacity).toBe('1');
    });

    it('should hide tooltip on mouseleave', () => {
      vTooltip.mounted(mockElement, { value: 'Tooltip' });
      
      mockElement._tooltipShowHandler({});
      mockElement._tooltipHideHandler();
      
      expect(mockElement._tooltip.style.opacity).toBe('0');
    });

    it('should position tooltip above element', () => {
      mockElement.getBoundingClientRect = jest.fn(() => ({
        top: 200,
        left: 100,
        bottom: 220,
        width: 80,
        height: 20,
      }));
      
      vTooltip.mounted(mockElement, { value: 'Tooltip' });
      mockElement._tooltipShowHandler({});
      
      // Top should be above the element
      const top = Number.parseInt(mockElement._tooltip.style.top);
      expect(top).toBeLessThan(200);
    });

    it('should position tooltip below when not enough space above', () => {
      mockElement.getBoundingClientRect = jest.fn(() => ({
        top: 10, // Near top of screen
        left: 100,
        bottom: 30,
        width: 80,
        height: 20,
      }));
      
      vTooltip.mounted(mockElement, { value: 'Tooltip' });
      mockElement._tooltipShowHandler({});
      
      // Top should be below the element
      const top = Number.parseInt(mockElement._tooltip.style.top);
      expect(top).toBeGreaterThanOrEqual(30);
    });
  });
});
