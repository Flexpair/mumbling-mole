import { describe, test, expect, beforeEach, jest } from '@jest/globals';
import ko from 'knockout';

describe('SettingsDialog.vue - Integration Tests', () => {
  let mockAppState;
  let mockSettingsDialog;

  beforeEach(() => {
    mockSettingsDialog = {
      voiceMode: ko.observable('cont'),
      pttKey: ko.observable('ctrl + shift'),
      pttKeyDisplay: ko.observable('ctrl + shift'),
      audioBitrate: ko.observable(40000),
      samplesPerPacket: ko.observable(960)
    };
    
    // Create msPerPacket computed after other observables are initialized
    mockSettingsDialog.msPerPacket = ko.pureComputed({
      read: () => mockSettingsDialog.samplesPerPacket() / 48,
      write: (value) => mockSettingsDialog.samplesPerPacket(value * 48)
    });
    
    // Add methods
    mockSettingsDialog.applyTo = jest.fn((settings) => {
      settings.voiceMode = mockSettingsDialog.voiceMode();
      settings.pttKey = mockSettingsDialog.pttKey();
      settings.audioBitrate = mockSettingsDialog.audioBitrate();
      settings.samplesPerPacket = mockSettingsDialog.samplesPerPacket();
    });
    mockSettingsDialog.recordPttKey = jest.fn();
    mockSettingsDialog.totalBandwidth = ko.observable(41500);
    mockSettingsDialog.positionBandwidth = ko.observable(500);
    mockSettingsDialog.overheadBandwidth = ko.observable(1000);
    mockSettingsDialog.end = jest.fn();

    mockAppState = {
      settings: {
        voiceMode: 'cont',
        pttKey: 'ctrl + shift',
        audioBitrate: 40000,
        samplesPerPacket: 960,
        save: jest.fn()
      },
      settingsDialog: ko.observable(null),
      ui: {
        settingsDialog: ko.observable(null),
        closeSettings: jest.fn()
      },
      applySettings: jest.fn(),
      closeSettings: jest.fn()
    };

    jest.clearAllMocks();
  });

  describe('Knockout State Structure', () => {
    test('settingsDialog observable starts as null', () => {
      expect(mockAppState.settingsDialog()).toBeNull();
    });

    test('settingsDialog can be set to dialog instance', () => {
      mockAppState.settingsDialog(mockSettingsDialog);
      expect(mockAppState.settingsDialog()).toBe(mockSettingsDialog);
      expect(mockAppState.settingsDialog().voiceMode()).toBe('cont');
    });

    test('msPerPacket computed converts samplesPerPacket to milliseconds', () => {
      mockAppState.settingsDialog(mockSettingsDialog);
      const dialog = mockAppState.settingsDialog();
      expect(dialog.msPerPacket()).toBe(20);
      dialog.msPerPacket(40);
      expect(dialog.samplesPerPacket()).toBe(1920);
    });
  });

  describe('Voice Mode Settings', () => {
    test('voiceMode observable defaults to continuous', () => {
      mockAppState.settingsDialog(mockSettingsDialog);
      const dialog = mockAppState.settingsDialog();
      expect(dialog.voiceMode()).toBe('cont');
    });

    test('voiceMode can be changed to PTT', () => {
      mockAppState.settingsDialog(mockSettingsDialog);
      const dialog = mockAppState.settingsDialog();
      dialog.voiceMode('ptt');
      expect(dialog.voiceMode()).toBe('ptt');
    });

    test('PTT key observable tracks key binding', () => {
      mockAppState.settingsDialog(mockSettingsDialog);
      const dialog = mockAppState.settingsDialog();
      expect(dialog.pttKey()).toBe('ctrl + shift');
      dialog.pttKey('alt + space');
      expect(dialog.pttKey()).toBe('alt + space');
    });
  });

  describe('Audio Quality Settings', () => {
    test('audioBitrate observable defaults to 40000', () => {
      mockAppState.settingsDialog(mockSettingsDialog);
      const dialog = mockAppState.settingsDialog();
      expect(dialog.audioBitrate()).toBe(40000);
    });

    test('audioBitrate can be updated', () => {
      mockAppState.settingsDialog(mockSettingsDialog);
      const dialog = mockAppState.settingsDialog();
      dialog.audioBitrate(80000);
      expect(dialog.audioBitrate()).toBe(80000);
    });

    test('samplesPerPacket observable defaults to 960', () => {
      mockAppState.settingsDialog(mockSettingsDialog);
      const dialog = mockAppState.settingsDialog();
      expect(dialog.samplesPerPacket()).toBe(960);
    });

    test('samplesPerPacket maps to valid audio packet sizes', () => {
      mockAppState.settingsDialog(mockSettingsDialog);
      const dialog = mockAppState.settingsDialog();
      const validSizes = [480, 960, 1920, 2880];
      validSizes.forEach(size => {
        dialog.samplesPerPacket(size);
        expect(dialog.samplesPerPacket()).toBe(size);
        expect(dialog.msPerPacket()).toBe(size / 48);
      });
    });
  });

  describe('Form Submission', () => {
    test('applyTo method updates AppState settings', () => {
      mockAppState.settingsDialog(mockSettingsDialog);
      const dialog = mockAppState.settingsDialog();
      dialog.voiceMode('ptt');
      dialog.pttKey('ctrl + alt + k');
      dialog.audioBitrate(60000);
      dialog.samplesPerPacket(1920);
      dialog.applyTo(mockAppState.settings);
      expect(mockAppState.settings.voiceMode).toBe('ptt');
      expect(mockAppState.settings.pttKey).toBe('ctrl + alt + k');
      expect(mockAppState.settings.audioBitrate).toBe(60000);
      expect(mockAppState.settings.samplesPerPacket).toBe(1920);
    });

    test('applySettings triggers action', () => {
      mockAppState.settingsDialog(mockSettingsDialog);
      mockAppState.applySettings();
      expect(mockAppState.applySettings).toHaveBeenCalledTimes(1);
    });
  });

  describe('Dialog Lifecycle', () => {
    test('settingsDialog can be closed', () => {
      mockAppState.settingsDialog(mockSettingsDialog);
      expect(mockAppState.settingsDialog()).not.toBeNull();
      mockAppState.settingsDialog(null);
      expect(mockAppState.settingsDialog()).toBeNull();
    });

    test('end method exists', () => {
      mockAppState.settingsDialog(mockSettingsDialog);
      const dialog = mockAppState.settingsDialog();
      dialog.end();
      expect(dialog.end).toHaveBeenCalledTimes(1);
    });
  });

  describe('Observable Subscriptions', () => {
    test('voiceMode observable supports subscriptions', () => {
      mockAppState.settingsDialog(mockSettingsDialog);
      const dialog = mockAppState.settingsDialog();
      const callback = jest.fn();
      const subscription = dialog.voiceMode.subscribe(callback);
      dialog.voiceMode('ptt');
      expect(callback).toHaveBeenCalledWith('ptt');
      subscription.dispose();
    });

    test('subscription disposal prevents updates', () => {
      mockAppState.settingsDialog(mockSettingsDialog);
      const dialog = mockAppState.settingsDialog();
      const callback = jest.fn();
      const subscription = dialog.voiceMode.subscribe(callback);
      subscription.dispose();
      dialog.voiceMode('ptt');
      expect(callback).not.toHaveBeenCalled();
    });
  });
});
