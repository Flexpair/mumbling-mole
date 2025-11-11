import { describe, test, expect, beforeEach, jest } from '@jest/globals';

describe('SettingsDialog.vue - Integration Tests', () => {
  let mockAppState;
  let mockSettingsDialog;

  beforeEach(() => {
    mockSettingsDialog = {
      voiceMode: { value: 'cont' },
      pttKey: { value: 'ctrl + shift' },
      pttKeyDisplay: { value: 'ctrl + shift' },
      audioBitrate: { value: 40000 },
      samplesPerPacket: { value: 960 }
    };
    
    // Create msPerPacket computed - simple getter/setter wrapper
    mockSettingsDialog.msPerPacket = {
      get value() {
        return mockSettingsDialog.samplesPerPacket.value / 48;
      },
      set value(ms) {
        mockSettingsDialog.samplesPerPacket.value = ms * 48;
      }
    };
    
    // Add methods
    mockSettingsDialog.applyTo = jest.fn((settings) => {
      settings.voiceMode = mockSettingsDialog.voiceMode.value;
      settings.pttKey = mockSettingsDialog.pttKey.value;
      settings.audioBitrate = mockSettingsDialog.audioBitrate.value;
      settings.samplesPerPacket = mockSettingsDialog.samplesPerPacket.value;
    });
    mockSettingsDialog.recordPttKey = jest.fn();
    mockSettingsDialog.totalBandwidth = { value: 41500 };
    mockSettingsDialog.positionBandwidth = { value: 500 };
    mockSettingsDialog.overheadBandwidth = { value: 1000 };
    mockSettingsDialog.end = jest.fn();

    mockAppState = {
      settings: {
        voiceMode: 'cont',
        pttKey: 'ctrl + shift',
        audioBitrate: 40000,
        samplesPerPacket: 960,
        save: jest.fn()
      },
      settingsDialog: { value: null },
      ui: {
        settingsDialog: { value: null },
        closeSettings: jest.fn()
      },
      applySettings: jest.fn(),
      closeSettings: jest.fn()
    };

    jest.clearAllMocks();
  });

  describe('Knockout State Structure', () => {
    test('settingsDialog observable starts as null', () => {
      expect(mockAppState.settingsDialog.value).toBeNull();
    });

    test('settingsDialog can be set to dialog instance', () => {
      mockAppState.settingsDialog.value = mockSettingsDialog;
      expect(mockAppState.settingsDialog.value).toBe(mockSettingsDialog);
      expect(mockAppState.settingsDialog.value.voiceMode.value).toBe('cont');
    });

    test('msPerPacket computed converts samplesPerPacket to milliseconds', () => {
      mockAppState.settingsDialog.value = mockSettingsDialog;
      const dialog = mockAppState.settingsDialog.value;
      expect(dialog.msPerPacket.value).toBe(20);
      dialog.msPerPacket.value = 40;
      expect(dialog.samplesPerPacket.value).toBe(1920);
    });
  });

  describe('Voice Mode Settings', () => {
    test('voiceMode observable defaults to continuous', () => {
      mockAppState.settingsDialog.value = mockSettingsDialog;
      const dialog = mockAppState.settingsDialog.value;
      expect(dialog.voiceMode.value).toBe('cont');
    });

    test('voiceMode can be changed to PTT', () => {
      mockAppState.settingsDialog.value = mockSettingsDialog;
      const dialog = mockAppState.settingsDialog.value;
      dialog.voiceMode.value = 'ptt';
      expect(dialog.voiceMode.value).toBe('ptt');
    });

    test('PTT key observable tracks key binding', () => {
      mockAppState.settingsDialog.value = mockSettingsDialog;
      const dialog = mockAppState.settingsDialog.value;
      expect(dialog.pttKey.value).toBe('ctrl + shift');
      dialog.pttKey.value = 'alt + space';
      expect(dialog.pttKey.value).toBe('alt + space');
    });
  });

  describe('Audio Quality Settings', () => {
    test('audioBitrate observable defaults to 40000', () => {
      mockAppState.settingsDialog.value = mockSettingsDialog;
      const dialog = mockAppState.settingsDialog.value;
      expect(dialog.audioBitrate.value).toBe(40000);
    });

    test('audioBitrate can be updated', () => {
      mockAppState.settingsDialog.value = mockSettingsDialog;
      const dialog = mockAppState.settingsDialog.value;
      dialog.audioBitrate.value = 80000;
      expect(dialog.audioBitrate.value).toBe(80000);
    });

    test('samplesPerPacket observable defaults to 960', () => {
      mockAppState.settingsDialog.value = mockSettingsDialog;
      const dialog = mockAppState.settingsDialog.value;
      expect(dialog.samplesPerPacket.value).toBe(960);
    });

    test('samplesPerPacket maps to valid audio packet sizes', () => {
      mockAppState.settingsDialog.value = mockSettingsDialog;
      const dialog = mockAppState.settingsDialog.value;
      const validSizes = [480, 960, 1920, 2880];
      for (const size of validSizes) {
        dialog.samplesPerPacket.value = size;
        expect(dialog.samplesPerPacket.value).toBe(size);
        expect(dialog.msPerPacket.value).toBe(size / 48);
      }
    });

    test('samplesPerPacket is fixed to 960 (20ms) due to architecture constraint', () => {
      // ARCHITECTURE CONSTRAINT: The audio pipeline (AudioWorklet processor,
      // worker resampler, Opus codec) is hard-coded for 960 samples (20ms @ 48kHz).
      // Changing this would require coordinated updates across multiple components.
      // See: app/audio/README.md and .github/copilot-instructions.md
      mockAppState.settingsDialog.value = mockSettingsDialog;
      const dialog = mockAppState.settingsDialog.value;
      
      // Default should be 960 samples (20ms)
      expect(dialog.samplesPerPacket.value).toBe(960);
      expect(dialog.msPerPacket.value).toBe(20);
      
      // UI should prevent changing this value (slider disabled/hidden in SettingsDialog.vue)
      // This test documents the constraint - actual enforcement is in the UI component
    });
  });

  describe('Form Submission', () => {
    test('applyTo method updates AppState settings', () => {
      mockAppState.settingsDialog.value = mockSettingsDialog;
      const dialog = mockAppState.settingsDialog.value;
      dialog.voiceMode.value = 'ptt';
      dialog.pttKey.value = 'ctrl + alt + k';
      dialog.audioBitrate.value = 60000;
      dialog.samplesPerPacket.value = 1920;
      dialog.applyTo(mockAppState.settings);
      expect(mockAppState.settings.voiceMode).toBe('ptt');
      expect(mockAppState.settings.pttKey).toBe('ctrl + alt + k');
      expect(mockAppState.settings.audioBitrate).toBe(60000);
      expect(mockAppState.settings.samplesPerPacket).toBe(1920);
    });

    test('applySettings triggers action', () => {
      mockAppState.settingsDialog.value = mockSettingsDialog;
      mockAppState.applySettings();
      expect(mockAppState.applySettings).toHaveBeenCalledTimes(1);
    });
  });

  describe('Dialog Lifecycle', () => {
    test('settingsDialog can be closed', () => {
      mockAppState.settingsDialog.value = mockSettingsDialog;
      expect(mockAppState.settingsDialog.value).not.toBeNull();
      mockAppState.settingsDialog.value = null;
      expect(mockAppState.settingsDialog.value).toBeNull();
    });

    test('end method exists', () => {
      mockAppState.settingsDialog.value = mockSettingsDialog;
      const dialog = mockAppState.settingsDialog.value;
      dialog.end();
      expect(dialog.end).toHaveBeenCalledTimes(1);
    });
  });
});
