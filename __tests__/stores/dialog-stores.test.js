/**
 * Pinia Dialog Store - Unit Tests
 * 
 * Tests für den konsolidierten Dialog-Store.
 */

import { describe, test, expect, beforeEach } from '@jest/globals';
import { setActivePinia, createPinia } from 'pinia';

import { useDialogStore } from '../../app/stores/dialogStore.js';

describe('useDialogStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  describe('connectDialog', () => {
    test('initializes with default values', () => {
      const store = useDialogStore();
      
      expect(store.connectDialog.visible).toBe(false);
      expect(store.connectDialog.username).toBe('');
      expect(store.connectDialog.password).toBe('');
      expect(store.connectDialog.address).toBe('');
      expect(store.connectDialog.port).toBe('');
      expect(store.connectDialog.isTestActive).toBe(false);
    });

    test('showConnectDialog() sets visible to true', () => {
      const store = useDialogStore();
      store.showConnectDialog();
      expect(store.connectDialog.visible).toBe(true);
    });

    test('hideConnectDialog() sets visible to false', () => {
      const store = useDialogStore();
      store.connectDialog.visible = true;
      store.hideConnectDialog();
      expect(store.connectDialog.visible).toBe(false);
    });

    test('properties can be set directly', () => {
      const store = useDialogStore();
      
      store.connectDialog.username = 'TestUser';
      store.connectDialog.password = 'TestPass';
      store.connectDialog.isTestActive = true;
      
      expect(store.connectDialog.username).toBe('TestUser');
      expect(store.connectDialog.password).toBe('TestPass');
      expect(store.connectDialog.isTestActive).toBe(true);
    });

    test('resetConnectDialog() clears all state', () => {
      const store = useDialogStore();
      
      store.connectDialog.address = 'server.example.com';
      store.connectDialog.port = '64738';
      store.connectDialog.username = 'TestUser';
      store.connectDialog.password = 'TestPass';
      store.connectDialog.visible = true;
      store.connectDialog.isTestActive = true;
      
      store.resetConnectDialog();
      
      expect(store.connectDialog.address).toBe('');
      expect(store.connectDialog.port).toBe('');
      expect(store.connectDialog.username).toBe('');
      expect(store.connectDialog.password).toBe('');
      expect(store.connectDialog.visible).toBe(false);
      expect(store.connectDialog.isTestActive).toBe(false);
    });
  });

  describe('errorDialog', () => {
    test('initializes with default values', () => {
      const store = useDialogStore();
      
      expect(store.errorDialog.visible).toBe(false);
      expect(store.errorDialog.type).toBe(0);
      expect(store.errorDialog.reason).toBe('');
    });

    test('showErrorDialog() accepts error object and sets state', () => {
      const store = useDialogStore();
      
      const error = { type: 2, reason: 'Username rejected' };
      store.showErrorDialog(error);
      
      expect(store.errorDialog.visible).toBe(true);
      expect(store.errorDialog.type).toBe(2);
      expect(store.errorDialog.reason).toBe('Username rejected');
    });

    test('showErrorDialog() handles error with message instead of reason', () => {
      const store = useDialogStore();
      
      const error = { message: 'Connection failed' };
      store.showErrorDialog(error);
      
      expect(store.errorDialog.visible).toBe(true);
      expect(store.errorDialog.reason).toBe('Connection failed');
    });

    test('showErrorDialog() handles null error', () => {
      const store = useDialogStore();
      
      store.showErrorDialog(null);
      
      expect(store.errorDialog.visible).toBe(true);
      // Should keep default values when error is null
      expect(store.errorDialog.type).toBe(0);
      expect(store.errorDialog.reason).toBe('');
    });

    test('showErrorDialog() handles error without type (defaults to 0)', () => {
      const store = useDialogStore();
      
      const error = { reason: 'Some error' };
      store.showErrorDialog(error);
      
      expect(store.errorDialog.visible).toBe(true);
      expect(store.errorDialog.type).toBe(0);
      expect(store.errorDialog.reason).toBe('Some error');
    });

    test('showErrorDialog() handles error without reason or message', () => {
      const store = useDialogStore();
      
      const error = { type: 3 };
      store.showErrorDialog(error);
      
      expect(store.errorDialog.visible).toBe(true);
      expect(store.errorDialog.type).toBe(3);
      expect(store.errorDialog.reason).toBe('');
    });

    test('hideErrorDialog() sets visible to false', () => {
      const store = useDialogStore();
      store.errorDialog.visible = true;
      store.hideErrorDialog();
      expect(store.errorDialog.visible).toBe(false);
    });

    test('resetErrorDialog() clears all state', () => {
      const store = useDialogStore();
      
      store.errorDialog.type = 5;
      store.errorDialog.reason = 'Some error';
      store.errorDialog.visible = true;
      
      store.resetErrorDialog();
      
      expect(store.errorDialog.visible).toBe(false);
      expect(store.errorDialog.type).toBe(0);
      expect(store.errorDialog.reason).toBe('');
    });
  });

  describe('infoDialog', () => {
    test('initializes with default values', () => {
      const store = useDialogStore();
      
      expect(store.infoDialog.maxBitrate).toBeNaN();
      expect(store.infoDialog.currentBitrate).toBeNaN();
      expect(store.infoDialog.maxBandwidth).toBeNaN();
      expect(store.infoDialog.currentBandwidth).toBeNaN();
      expect(store.infoDialog.latencyMs).toBeNaN();
      expect(store.infoDialog.latencyDeviation).toBeNaN();
      expect(store.infoDialog.visible).toBe(false);
      expect(store.infoDialog.serverVersion).toBeNull();
      expect(store.infoDialog.codec).toBe('Unknown');
    });

    test('showInfoDialog() sets visible to true', () => {
      const store = useDialogStore();
      store.showInfoDialog();
      expect(store.infoDialog.visible).toBe(true);
    });

    test('hideInfoDialog() sets visible to false', () => {
      const store = useDialogStore();
      store.infoDialog.visible = true;
      store.hideInfoDialog();
      expect(store.infoDialog.visible).toBe(false);
    });

    test('properties can be set directly', () => {
      const store = useDialogStore();
      
      store.infoDialog.maxBitrate = 64000;
      store.infoDialog.currentBitrate = 55600;
      
      expect(store.infoDialog.maxBitrate).toBe(64000);
      expect(store.infoDialog.currentBitrate).toBe(55600);
    });

    test('resetInfoDialog() clears all values', () => {
      const store = useDialogStore();
      
      store.infoDialog.maxBitrate = 64000;
      store.infoDialog.currentBitrate = 55600;
      
      store.resetInfoDialog();
      
      expect(store.infoDialog.maxBitrate).toBeNaN();
      expect(store.infoDialog.currentBitrate).toBeNaN();
    });
  });

  describe('sampleRateDialog', () => {
    test('initializes with default values', () => {
      const store = useDialogStore();
      
      expect(store.sampleRateDialog.visible).toBe(false);
      expect(store.sampleRateDialog.mode).toBe('confirm');
      expect(store.sampleRateDialog.sampleRate).toBeNull();
      expect(store.sampleRateDialog.connectionParams).toBeNull();
    });

    test('showSampleRateDialog() sets visible to true', () => {
      const store = useDialogStore();
      store.showSampleRateDialog();
      expect(store.sampleRateDialog.visible).toBe(true);
    });

    test('hideSampleRateDialog() sets visible to false', () => {
      const store = useDialogStore();
      store.sampleRateDialog.visible = true;
      store.hideSampleRateDialog();
      expect(store.sampleRateDialog.visible).toBe(false);
    });

    test('sampleRate and connectionParams can be set before show()', () => {
      const store = useDialogStore();
      
      store.sampleRateDialog.sampleRate = 44100;
      store.sampleRateDialog.connectionParams = { host: 'test', port: 64738 };
      store.showSampleRateDialog();
      
      expect(store.sampleRateDialog.sampleRate).toBe(44100);
      expect(store.sampleRateDialog.connectionParams).toEqual({ host: 'test', port: 64738 });
      expect(store.sampleRateDialog.visible).toBe(true);
    });

    test('resetSampleRateDialog() clears all state', () => {
      const store = useDialogStore();
      
      store.sampleRateDialog.visible = true;
      store.sampleRateDialog.mode = 'info';
      store.sampleRateDialog.sampleRate = 44100;
      store.sampleRateDialog.connectionParams = { host: 'test' };
      
      store.resetSampleRateDialog();
      
      expect(store.sampleRateDialog.visible).toBe(false);
      expect(store.sampleRateDialog.mode).toBe('confirm');
      expect(store.sampleRateDialog.sampleRate).toBeNull();
      expect(store.sampleRateDialog.connectionParams).toBeNull();
    });
  });

  describe('Global Actions', () => {
    test('contains all dialog namespaces', () => {
      const store = useDialogStore();
      
      expect(store.connectDialog).toBeDefined();
      expect(store.errorDialog).toBeDefined();
      expect(store.infoDialog).toBeDefined();
      expect(store.sampleRateDialog).toBeDefined();
    });

    test('resetAll() clears all dialogs', () => {
      const store = useDialogStore();
      
      store.connectDialog.visible = true;
      store.errorDialog.visible = true;
      store.infoDialog.visible = true;
      store.sampleRateDialog.visible = true;
      
      store.resetAll();
      
      expect(store.connectDialog.visible).toBe(false);
      expect(store.errorDialog.visible).toBe(false);
      expect(store.infoDialog.visible).toBe(false);
      expect(store.sampleRateDialog.visible).toBe(false);
    });

    test('store is singleton within same Pinia instance', () => {
      const store1 = useDialogStore();
      const store2 = useDialogStore();
      
      store1.connectDialog.username = 'TestUser';
      
      expect(store2.connectDialog.username).toBe('TestUser');
    });
  });
});
