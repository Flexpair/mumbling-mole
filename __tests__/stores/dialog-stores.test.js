/**
 * Pinia Dialog Stores - Unit Tests
 * 
 * Tests für die neuen Dialog-Stores, die aus Composables migriert wurden.
 * Diese Tests hätten die Referenzfehler früher aufgedeckt.
 */

import { describe, test, expect, beforeEach } from '@jest/globals';
import { setActivePinia, createPinia } from 'pinia';

// Import stores
import { useConnectionDialogStore } from '../../app/stores/connectionDialogStore.js';
import { useConnectErrorDialogStore } from '../../app/stores/connectErrorDialogStore.js';
import { useConnectionInfoStore } from '../../app/stores/connectionInfoStore.js';
import { useSampleRateWarningDialogStore } from '../../app/stores/sampleRateWarningDialogStore.js';

describe('Dialog Stores', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  describe('useConnectionDialogStore', () => {
    test('initializes with default values', () => {
      const store = useConnectionDialogStore();
      
      expect(store.visible).toBe(false);
      expect(store.username).toBe('');
      expect(store.password).toBe('');
      expect(store.address).toBeDefined();
      expect(store.port).toBeDefined();
      expect(store.isTestActive).toBe(false);
    });

    test('show() sets visible to true', () => {
      const store = useConnectionDialogStore();
      store.show();
      expect(store.visible).toBe(true);
    });

    test('hide() sets visible to false', () => {
      const store = useConnectionDialogStore();
      store.visible = true;
      store.hide();
      expect(store.visible).toBe(false);
    });

    test('properties can be set directly (Pinia pattern)', () => {
      const store = useConnectionDialogStore();
      
      // Pinia stores allow direct assignment (no .value needed)
      store.username = 'TestUser';
      store.password = 'TestPass';
      store.isTestActive = true;
      
      expect(store.username).toBe('TestUser');
      expect(store.password).toBe('TestPass');
      expect(store.isTestActive).toBe(true);
    });
  });

  describe('useConnectErrorDialogStore', () => {
    test('initializes with default values', () => {
      const store = useConnectErrorDialogStore();
      
      expect(store.visible).toBe(false);
      expect(store.type).toBe(0);
      expect(store.reason).toBe('');
    });

    test('show() accepts error object and sets state', () => {
      const store = useConnectErrorDialogStore();
      
      const error = { type: 2, reason: 'Username rejected' };
      store.show(error);
      
      expect(store.visible).toBe(true);
      expect(store.type).toBe(2);
      expect(store.reason).toBe('Username rejected');
    });

    test('show() handles error with message instead of reason', () => {
      const store = useConnectErrorDialogStore();
      
      const error = { message: 'Connection failed' };
      store.show(error);
      
      expect(store.visible).toBe(true);
      expect(store.reason).toBe('Connection failed');
    });

    test('reset() clears all state', () => {
      const store = useConnectErrorDialogStore();
      
      store.type = 5;
      store.reason = 'Some error';
      store.visible = true;
      
      store.reset();
      
      expect(store.visible).toBe(false);
      expect(store.type).toBe(0);
      expect(store.reason).toBe('');
    });
  });

  describe('useConnectionInfoStore', () => {
    test('initializes with default values', () => {
      const store = useConnectionInfoStore();
      
      // Numeric stats use NaN to indicate "no value yet" (not 0)
      expect(store.maxBitrate).toBeNaN();
      expect(store.currentBitrate).toBeNaN();
      expect(store.maxBandwidth).toBeNaN();
      expect(store.currentBandwidth).toBeNaN();
      expect(store.latencyMs).toBeNaN();
      expect(store.latencyDeviation).toBeNaN();
      expect(store.visible).toBe(false);
      expect(store.serverVersion).toBeNull();
      expect(store.codec).toBe('Unknown');
    });

    test('properties can be set directly', () => {
      const store = useConnectionInfoStore();
      
      // This is how ConnectionInfoDialog.vue uses it
      store.maxBitrate = 64000;
      store.currentBitrate = 55600;
      store.maxBandwidth = 100000;
      store.currentBandwidth = 80000;
      
      expect(store.maxBitrate).toBe(64000);
      expect(store.currentBitrate).toBe(55600);
      expect(store.maxBandwidth).toBe(100000);
      expect(store.currentBandwidth).toBe(80000);
    });

    test('reset() clears all values', () => {
      const store = useConnectionInfoStore();
      
      store.maxBitrate = 64000;
      store.currentBitrate = 55600;
      
      store.reset();
      
      // After reset, values should return to NaN (not 0)
      expect(store.maxBitrate).toBeNaN();
      expect(store.currentBitrate).toBeNaN();
    });
  });

  describe('useSampleRateWarningDialogStore', () => {
    test('initializes with default values', () => {
      const store = useSampleRateWarningDialogStore();
      
      expect(store.visible).toBe(false);
      expect(store.mode).toBe('confirm');
      expect(store.sampleRate).toBeNull();
    });

    test('show() sets visible to true', () => {
      const store = useSampleRateWarningDialogStore();
      store.show();
      expect(store.visible).toBe(true);
    });

    test('sampleRate can be set before show()', () => {
      const store = useSampleRateWarningDialogStore();
      
      // This is how useConnectionLogic.js uses it
      store.sampleRate = 44100;
      store.show();
      
      expect(store.sampleRate).toBe(44100);
      expect(store.visible).toBe(true);
    });

    test('reset() clears all state', () => {
      const store = useSampleRateWarningDialogStore();
      
      store.visible = true;
      store.mode = 'info';
      store.sampleRate = 44100;
      
      store.reset();
      
      expect(store.visible).toBe(false);
      expect(store.mode).toBe('confirm');
      expect(store.sampleRate).toBeNull();
    });
  });

  describe('Pinia Store Pattern Validation', () => {
    test('stores are singletons within same Pinia instance', () => {
      const store1 = useConnectionDialogStore();
      const store2 = useConnectionDialogStore();
      
      store1.username = 'TestUser';
      
      // Same instance
      expect(store2.username).toBe('TestUser');
    });

    test('stores can be accessed without .value (unlike raw refs)', () => {
      const store = useConnectionDialogStore();
      
      // Direct assignment works (Pinia unwraps refs)
      store.visible = true;
      expect(store.visible).toBe(true);
      
      // NOT: store.visible.value = true (that would fail)
    });
  });
});
