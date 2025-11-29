/**
 * Jest Unit Tests for uiStore
 * 
 * Tests the Pinia store that manages:
 * - Modal state
 * - Message box content
 * - Message confirmation
 * - Guacamole frame reference
 */

import { jest } from '@jest/globals';

// Mock Vue reactivity
jest.unstable_mockModule('vue', () => ({
  ref: (val) => ({
    _val: val,
    get value() { return this._val; },
    set value(v) { this._val = v; },
    __v_isRef: true
  }),
  shallowRef: (val) => ({
    _val: val,
    get value() { return this._val; },
    set value(v) { this._val = v; },
    __v_isRef: true
  }),
  watch: jest.fn(() => () => {}),
  computed: (fn) => ({ value: typeof fn === 'function' ? fn() : fn.get() }),
  markRaw: (o) => o,
  nextTick: async () => {},
  effectScope: () => ({ active: true, run: fn => fn(), stop: () => {} }),
  getCurrentScope: () => null
}));

// Mock Pinia
jest.unstable_mockModule('pinia', () => ({
  defineStore: (id, setup) => {
    return () => {
      const result = setup();
      return result;
    };
  },
  createPinia: () => ({})
}));

const { useUIStore } = await import('../../app/stores/uiStore.js');

describe('uiStore', () => {
  let store;

  beforeEach(() => {
    jest.clearAllMocks();
    store = useUIStore();
  });

  describe('Initial State', () => {
    test('should initialize with no open modal', () => {
      expect(store.currentOpenModal.value).toBeNull();
    });

    test('should initialize with empty message box', () => {
      expect(store.messageBox.value).toBe('');
    });

    test('should initialize with message not confirmed', () => {
      expect(store.messageConfirmed.value).toBe(false);
    });

    test('should initialize with null guacamole frame', () => {
      expect(store.guacamoleFrame.value).toBeNull();
    });
  });

  describe('Modal Management', () => {
    test('should track current open modal', () => {
      store.currentOpenModal.value = 'settings';
      expect(store.currentOpenModal.value).toBe('settings');

      store.currentOpenModal.value = 'connect';
      expect(store.currentOpenModal.value).toBe('connect');
    });

    test('should allow closing modal by setting to null', () => {
      store.currentOpenModal.value = 'settings';
      store.currentOpenModal.value = null;
      expect(store.currentOpenModal.value).toBeNull();
    });
  });

  describe('Message Box', () => {
    test('should track message box content', () => {
      store.messageBox.value = 'Hello, world!';
      expect(store.messageBox.value).toBe('Hello, world!');
    });

    test('should allow clearing message box', () => {
      store.messageBox.value = 'Some message';
      store.messageBox.value = '';
      expect(store.messageBox.value).toBe('');
    });
  });

  describe('submitMessageBox', () => {
    test('should call sendMessageFn with target and message', () => {
      const sendMessageFn = jest.fn();
      const target = { id: 1, name: 'General' };
      store.messageBox.value = 'Test message';

      store.submitMessageBox(sendMessageFn, target);

      expect(sendMessageFn).toHaveBeenCalledWith(target, 'Test message');
    });

    test('should clear message box after sending', () => {
      const sendMessageFn = jest.fn();
      store.messageBox.value = 'Test message';

      store.submitMessageBox(sendMessageFn, {});

      expect(store.messageBox.value).toBe('');
    });

    test('should not send empty messages', () => {
      const sendMessageFn = jest.fn();
      store.messageBox.value = '';

      store.submitMessageBox(sendMessageFn, {});

      expect(sendMessageFn).not.toHaveBeenCalled();
    });

    test('should not send whitespace-only messages', () => {
      const sendMessageFn = jest.fn();
      store.messageBox.value = '   ';

      store.submitMessageBox(sendMessageFn, {});

      expect(sendMessageFn).not.toHaveBeenCalled();
    });

    test('should trim whitespace when checking for empty', () => {
      const sendMessageFn = jest.fn();
      store.messageBox.value = '  Hello  ';

      store.submitMessageBox(sendMessageFn, {});

      // Should send with original (untrimmed) content
      expect(sendMessageFn).toHaveBeenCalledWith({}, '  Hello  ');
    });
  });

  describe('Message Confirmation', () => {
    test('should track message confirmation state', () => {
      expect(store.messageConfirmed.value).toBe(false);
      store.messageConfirmed.value = true;
      expect(store.messageConfirmed.value).toBe(true);
    });
  });

  describe('Guacamole Frame', () => {
    test('should store guacamole frame reference', () => {
      const mockFrame = { contentWindow: {} };
      store.guacamoleFrame.value = mockFrame;
      expect(store.guacamoleFrame.value).toBe(mockFrame);
    });
  });

  describe('reset', () => {
    test('should reset all state to defaults', () => {
      // Set various state
      store.currentOpenModal.value = 'settings';
      store.messageBox.value = 'Some message';
      store.messageConfirmed.value = true;

      store.reset();

      expect(store.currentOpenModal.value).toBeNull();
      expect(store.messageBox.value).toBe('');
      expect(store.messageConfirmed.value).toBe(false);
    });
  });
});
