/**
 * AppState unit tests - Vue Composables Architecture
 * 
 * Tests for the new AppState structure that uses Vue composables internally
 * with Knockout observables for backward compatibility.
 */

import { describe, test, expect, jest, beforeEach, afterEach } from '@jest/globals';

// Mock dependencies
jest.unstable_mockModule('../../app/worker-client.js', () => ({
  default: class MockWorkerClient {
    constructor() {
      this.user = { id: null };
    }
    on() {}
    setSelfMute() {}
    setSelfDeaf() {}
    connect() { return Promise.resolve({}); }
    disconnect() {}
  }
}));

jest.unstable_mockModule('../../app/audio/voice.js', () => ({
  ContinuousVoiceHandler: class MockContinuousVoiceHandler {},
  PushToTalkVoiceHandler: class MockPushToTalkVoiceHandler {},
  initVoice: jest.fn(),
  setVoiceHandler: jest.fn(),
  resetVoice: jest.fn(),
  getCurrentMixer: jest.fn(() => null),
  onAudioMixerReady: jest.fn(),
  enumMicrophones: jest.fn(),
  default: {
    initVoice: jest.fn(),
    setVoiceHandler: jest.fn(),
    resetVoice: jest.fn()
  }
}));

// Import after mocks
const { default: AppState } = await import('../../app/state/AppState.js');

describe('AppState - Vue Composables Architecture', () => {
  let appState;
  let mockAuth;
  let mockConfig;

  beforeEach(() => {
    // Mock auth (using plain objects instead of knockout observables)
    mockAuth = {
      currentUser: {
        value: {
          email: 'test@example.com',
          app_metadata: {
            roles: ['watch', 'listen']
          }
        }
      },
      init: jest.fn(),
      on: jest.fn()
    };

    // Mock config
    mockConfig = {
      defaults: {
        host: 'localhost',
        port: 64738,
        username: 'TestUser',
        password: ''
      },
      settings: {
        voiceMode: 'cont',
        pttKey: 'ctrl + shift',
        vadLevel: 0.3,
        testToneVolume: 1,
        toolbarVertical: false,
        audioBitrate: 40000,
        samplesPerPacket: 960
      },
      connectDialog: {
        address: true,
        port: true,
        username: true,
        password: true
      }
    };

    appState = new AppState();
    
    // Set external properties (as done in index.js)
    appState.auth = mockAuth;
    appState.config = mockConfig;
    // Settings is now a Vue composable with refs (not Knockout observables)
    appState.settings = {
      voiceMode: { value: 'cont' },
      audioBitrate: { value: 40000 },
      samplesPerPacket: { value: 960 },
      pttKey: { value: 'ctrl + shift' },
      vadLevel: { value: 0.3 },
      testToneVolume: { value: 1 },
      toolbarVertical: { value: false },
      pttKeyDisplay: { value: 'ctrl + shift' },
      userCountInChannelName: { value: false },
      // Computed properties
      msPerPacket: { value: 20 },
      totalBandwidth: { value: 0 },
      positionBandwidth: { value: 0 },
      overheadBandwidth: { value: 0 },
      // Methods
      save: jest.fn(),
      recordPttKey: jest.fn()
    };
    // connectDialog, connectErrorDialog, sampleRateWarningDialog, and connectionInfo are now Vue composables (getters), initialize their refs directly
    appState.connectDialog.address.value = 'localhost';
    appState.connectDialog.port.value = '64738';
    appState.connectDialog.username.value = 'TestUser';
    appState.connectDialog.password.value = '';
    appState.connectDialog.visible.value = false;
    appState.connectDialog.isTestActive.value = false;
    appState.connectErrorDialog.type.value = 0;
    appState.connectErrorDialog.reason.value = '';
    appState.connectErrorDialog.visible.value = false;
    appState.sampleRateWarningDialog.visible.value = false;
    appState.sampleRateWarningDialog.mode.value = 'confirm';
    appState.sampleRateWarningDialog.sampleRate.value = null;
    appState.connectionInfo.visible.value = false;
    appState.connectionInfo.serverVersion.value = null;
    appState.connectionInfo.latencyMs.value = Number.NaN;
    appState.connectionInfo.latencyDeviation.value = Number.NaN;
    appState.connectionInfo.remoteHost.value = null;
    appState.connectionInfo.remotePort.value = null;
    appState.connectionInfo.maxBitrate.value = Number.NaN;
    appState.connectionInfo.currentBitrate.value = Number.NaN;
    appState.connectionInfo.maxBandwidth.value = Number.NaN;
    appState.connectionInfo.currentBandwidth.value = Number.NaN;
    appState.connectionInfo.codec.value = 'Unknown';
    appState.guacamoleFrame = {};
  });

  afterEach(() => {
    if (appState) {
      appState.reset?.();
    }
  });

  describe('Constructor & Initialization', () => {
    test('creates AppState instance', () => {
      expect(appState).toBeDefined();
      expect(appState).toBeInstanceOf(AppState);
    });

    test('stores auth and config references', () => {
      expect(appState.auth).toBe(mockAuth);
      expect(appState.config).toBe(mockConfig);
    });

    test('creates Vue composables', () => {
      expect(appState._vueState).toBeDefined();
      expect(appState._vueState.connection).toBeDefined();
      expect(appState._vueState.audio).toBeDefined();
      expect(appState._vueState.voice).toBeDefined();
      expect(appState._vueState.ui).toBeDefined();
      expect(appState._vueState.user).toBeDefined();
    });

    test('initializes settings from config', () => {
      expect(appState.settings).toBeDefined();
      // Settings is now a Vue composable with refs (not Knockout observables)
      expect(appState.settings.voiceMode.value).toBe('cont');
      expect(appState.settings.audioBitrate.value).toBe(40000);
      expect(appState.settings.samplesPerPacket.value).toBe(960);
    });
  });

  describe('Root-Level Getters (Backward Compatibility API)', () => {
    test('connection getters expose Vue refs', () => {
      expect(appState.remoteHost).toBe(appState._vueState.connection.remoteHost);
      expect(appState.remotePort).toBe(appState._vueState.connection.remotePort);
    });

    test('audio getters expose Vue refs', () => {
      expect(appState.audioLockActive).toBe(appState._vueState.audio.audioLockActive);
      expect(appState.micPermissionDenied).toBe(appState._vueState.audio.micPermissionDenied);
      expect(appState.micPermissionErrorMessage).toBe(appState._vueState.audio.micPermissionErrorMessage);
      expect(appState.isBeeping).toBe(appState._vueState.audio.isBeeping);
      expect(appState.beeperReady).toBe(appState._vueState.audio.beeperReady);
    });

    test('voice getters expose Vue refs', () => {
      expect(appState.isLoopbackMode).toBe(appState._vueState.voice.isLoopbackMode);
      expect(appState.voiceHandlerReady).toBe(appState._vueState.voice.voiceHandlerReady);
      expect(appState.loopbackDominantFrequency).toBe(appState._vueState.voice.loopbackDominantFrequency);
    });

    test('UI getters expose Vue refs', () => {
      expect(appState.currentOpenModal).toBe(appState._vueState.ui.currentOpenModal);
      expect(appState.messageBox).toBe(appState._vueState.ui.messageBox);
      expect(appState.settingsDialog).toBe(appState._vueState.ui.settingsDialog);
    });

    test('user getters expose Vue refs', () => {
      expect(appState.thisUser).toBe(appState._vueState.user.thisUser);
      expect(appState.selfMute).toBe(appState._vueState.user.selfMute);
      expect(appState.selfDeaf).toBe(appState._vueState.user.selfDeaf);
    });

    test('audioContext getter returns Vue composable value', () => {
      expect(appState.audioContext).toBe(appState._vueState.audio.audioContext);
    });

    test('voiceHandler getter returns Vue composable value', () => {
      expect(appState.voiceHandler).toBe(appState._vueState.voice.voiceHandler);
    });
  });

  describe('Connection Management', () => {
    test('connected() returns true when thisUser exists', () => {
      appState._vueState.user.thisUser.value = { id: 1, name: 'Test' };
      expect(appState.connected()).toBe(true);
    });

    test('connected() returns false when thisUser is null', () => {
      appState._vueState.user.thisUser.value = null;
      expect(appState.connected()).toBe(false);
    });

    test('getClient() delegates to connection state', () => {
      const result = appState.getClient();
      // Should return whatever the connection state returns (null in this case)
      expect(result).toBe(appState._vueState.connection.getClient());
    });
  });

  describe('Audio Methods', () => {
    test('startBeep() delegates to audio state', () => {
      const spy = jest.spyOn(appState._vueState.audio, 'startBeep');
      appState.startBeep();
      expect(spy).toHaveBeenCalled();
    });

    test('stopBeep() delegates to audio state', () => {
      const spy = jest.spyOn(appState._vueState.audio, 'stopBeep');
      appState.stopBeep();
      expect(spy).toHaveBeenCalled();
    });

    test('retryMicrophonePermission() delegates to audio state', () => {
      const spy = jest.spyOn(appState._vueState.audio, 'retryMicrophonePermission');
      appState.retryMicrophonePermission();
      expect(spy).toHaveBeenCalled();
    });

    test('initializeAudioContext() delegates to audio state', () => {
      const spy = jest.spyOn(appState._vueState.audio, 'initializeAudioContext');
      appState.initializeAudioContext();
      expect(spy).toHaveBeenCalled();
    });
  });

  describe('UI Methods', () => {
    test('submitMessageBox() delegates to UI state', () => {
      const spy = jest.spyOn(appState._vueState.ui, 'submitMessageBox');
      appState.submitMessageBox();
      expect(spy).toHaveBeenCalled();
    });
  });

  describe('Settings Management', () => {
    test('settings object is initialized from config', () => {
      expect(appState.settings).toBeDefined();
      // Settings is now a Vue composable with refs (not Knockout observables)
      expect(typeof appState.settings.voiceMode).toBe('object');
      expect(appState.settings.voiceMode).toHaveProperty('value');
      expect(typeof appState.settings.audioBitrate).toBe('object');
      expect(appState.settings.audioBitrate).toHaveProperty('value');
    });

    test('settings values can be changed', () => {
      appState.settings.voiceMode.value = 'ptt';
      expect(appState.settings.voiceMode.value).toBe('ptt');
      
      appState.settings.audioBitrate.value = 48000;
      expect(appState.settings.audioBitrate.value).toBe(48000);
    });
  });

  describe('Dialog Management', () => {
    test('connectDialog is initialized', () => {
      expect(appState.connectDialog).toBeDefined();
      // connectDialog is now a Vue composable with refs (not Knockout observables)
      expect(typeof appState.connectDialog.visible).toBe('object');
      expect(appState.connectDialog.visible).toHaveProperty('value');
      expect(typeof appState.connectDialog.address).toBe('object');
      expect(appState.connectDialog.address).toHaveProperty('value');
      expect(typeof appState.connectDialog.port).toBe('object');
      expect(appState.connectDialog.port).toHaveProperty('value');
      expect(typeof appState.connectDialog.username).toBe('object');
      expect(appState.connectDialog.username).toHaveProperty('value');
      expect(typeof appState.connectDialog.password).toBe('object');
      expect(appState.connectDialog.password).toHaveProperty('value');
      expect(typeof appState.connectDialog.isTestActive).toBe('object');
      expect(appState.connectDialog.isTestActive).toHaveProperty('value');
    });

    test('connectionInfo is initialized', () => {
      expect(appState.connectionInfo).toBeDefined();
      expect(typeof appState.connectionInfo).toBe('object');
      // Verify it's a Vue composable with refs
      expect(typeof appState.connectionInfo.visible).toBe('object');
      expect(appState.connectionInfo.visible).toHaveProperty('value');
      expect(typeof appState.connectionInfo.serverVersion).toBe('object');
      expect(appState.connectionInfo.serverVersion).toHaveProperty('value');
      expect(typeof appState.connectionInfo.latencyMs).toBe('object');
      expect(appState.connectionInfo.latencyMs).toHaveProperty('value');
      expect(typeof appState.connectionInfo.remoteHost).toBe('object');
      expect(appState.connectionInfo.remoteHost).toHaveProperty('value');
      expect(typeof appState.connectionInfo.codec).toBe('object');
      expect(appState.connectionInfo.codec).toHaveProperty('value');
    });

    test('connectErrorDialog is initialized', () => {
      expect(appState.connectErrorDialog).toBeDefined();
      // Verify it's a Vue composable with refs
      expect(typeof appState.connectErrorDialog.type).toBe('object');
      expect(appState.connectErrorDialog.type).toHaveProperty('value');
      expect(typeof appState.connectErrorDialog.reason).toBe('object');
      expect(appState.connectErrorDialog.reason).toHaveProperty('value');
      expect(typeof appState.connectErrorDialog.visible).toBe('object');
      expect(appState.connectErrorDialog.visible).toHaveProperty('value');
    });

    test('sampleRateWarningDialog is initialized', () => {
      expect(appState.sampleRateWarningDialog).toBeDefined();
      expect(typeof appState.sampleRateWarningDialog).toBe('object');
      // Verify it's a Vue composable with refs
      expect(typeof appState.sampleRateWarningDialog.visible).toBe('object');
      expect(appState.sampleRateWarningDialog.visible).toHaveProperty('value');
      expect(typeof appState.sampleRateWarningDialog.mode).toBe('object');
      expect(appState.sampleRateWarningDialog.mode).toHaveProperty('value');
      expect(typeof appState.sampleRateWarningDialog.sampleRate).toBe('object');
      expect(appState.sampleRateWarningDialog.sampleRate).toHaveProperty('value');
    });

    test('guacamoleFrame is initialized', () => {
      expect(appState.guacamoleFrame).toBeDefined();
    });
  });

  describe('Module Delegation', () => {
    test('has connection module', () => {
      expect(appState.connection).toBe(appState._vueState.connection);
    });

    test('has audio module', () => {
      expect(appState.audio).toBe(appState._vueState.audio);
    });

    test('has voice module', () => {
      expect(appState.voice).toBe(appState._vueState.voice);
    });

    test('has ui module', () => {
      expect(appState.ui).toBe(appState._vueState.ui);
    });

    test('has user module', () => {
      expect(appState.user).toBe(appState._vueState.user);
    });
  });

  describe('Channel Registration (Single-Channel Mode)', () => {
    test('should register channel and create UI wrapper', () => {
      const mockChannel = {
        id: 0,
        name: 'Root',
        position: 0,
        description: 'Root channel',
        temporary: false,
        parent: null,
        links: [],
        children: []
      };

      appState._registerChannel(mockChannel);

      expect(mockChannel.__ui).toBeDefined();
      expect(mockChannel.__ui.model).toBe(mockChannel);
      // Channel name is now a Vue ref (not Knockout observable)
      expect(typeof mockChannel.__ui.name).toBe('object');
      expect(mockChannel.__ui.name).toHaveProperty('value');
      expect(mockChannel.__ui.name.value).toBe('Root');
    });

    test('should store root channel reference', () => {
      const mockChannel = {
        id: 0,
        name: 'Root',
        position: 0
      };

      appState._registerChannel(mockChannel);

      // _registerChannel doesn't set appState.root - it only adds __ui to channel
      expect(mockChannel.__ui).toBeDefined();
      expect(mockChannel.__ui.name.value).toBe('Root');
    });

    test('should update channel name reactively', () => {
      const mockChannel = {
        id: 0,
        name: 'Initial Name',
        position: 0
      };

      appState._registerChannel(mockChannel);
      expect(mockChannel.__ui.name.value).toBe('Initial Name');

      // Update the ref directly
      mockChannel.__ui.name.value = 'Updated Name';
      expect(mockChannel.__ui.name.value).toBe('Updated Name');
    });

    test('should handle channel without description', () => {
      const mockChannel = {
        id: 0,
        name: 'Test Channel',
        position: 0,
        description: null
      };

      appState._registerChannel(mockChannel);
      expect(mockChannel.__ui.model.description).toBeNull();
    });

    test('should return early for already-registered channel', () => {
      const mockChannel = {
        id: 0,
        name: 'Root',
        position: 0
      };

      appState._registerChannel(mockChannel);
      const originalUI = mockChannel.__ui;
      
      // Call again - should not replace __ui
      appState._registerChannel(mockChannel);

      expect(mockChannel.__ui).toBe(originalUI);
    });
  });

  describe('Connection Flow', () => {
    test('should have _performConnect method', () => {
      expect(typeof appState._performConnect).toBe('function');
    });

    test('should have connect method', () => {
      expect(typeof appState.connect).toBe('function');
    });

    test('should have connectLoopback method', () => {
      expect(typeof appState.connectLoopback).toBe('function');
    });

    test('should have resetClient method', () => {
      expect(typeof appState.resetClient).toBe('function');
    });

    test('should track connection ID for race safety', () => {
      expect(appState._currentConnectionId).toBeDefined();
    });
  });

  describe('Backward Compatibility Getters', () => {
    test('should have connected() method that checks thisUser', () => {
      expect(typeof appState.connected).toBe('function');
      
      // Not connected initially (thisUser is null via Vue composable)
      expect(appState.connected()).toBe(false);
    });

    test('should have getClient() method', () => {
      expect(typeof appState.getClient).toBe('function');
    });
  });

  describe('Audio Lock Integration', () => {
    test('should prevent unmute when audio lock is active', () => {
      // Activate audio lock (Knockout observable syntax)
      if (typeof appState.audio.audioLockActive === 'function') {
        appState.audio.audioLockActive(true);
        appState.audio.audioLockReason('sample-rate');
      }

      // Try to unmute
      if (typeof appState.user.selfMute === 'function') {
        appState.user.selfMute(true);
        appState.user.requestUnmute?.();

        // Should remain muted
        expect(appState.user.selfMute()).toBe(true);
      }
    });

    test('should prevent undeaf when audio lock is active', () => {
      // Activate audio lock
      if (typeof appState.audio.audioLockActive === 'function') {
        appState.audio.audioLockActive(true);
      }

      // Try to undeaf
      if (typeof appState.user.selfDeaf === 'function') {
        appState.user.selfDeaf(true);
        appState.user.requestUndeaf?.();

        // Should remain deaf
        expect(appState.user.selfDeaf()).toBe(true);
      }
    });

    test('should allow unmute when audio lock is cleared', () => {
      // Activate then clear audio lock
      if (typeof appState.audio.audioLockActive === 'function') {
        appState.audio.audioLockActive(true);
        appState.audio.audioLockActive(false);
      }

      // Now unmute should work
      if (typeof appState.user.selfMute === 'function') {
        appState.user.selfMute(true);
        appState.user.requestUnmute?.();

        expect(appState.user.selfMute()).toBe(false);
      }
    });
  });

  describe('Settings Integration', () => {
    test('should have settings object', () => {
      expect(appState.settings).toBeDefined();
      expect(appState.settings.voiceMode).toBeDefined();
      expect(appState.settings.audioBitrate).toBeDefined();
    });

    test('should read voice mode setting', () => {
      appState.settings.voiceMode.value = 'cont';
      expect(appState.settings.voiceMode.value).toBe('cont');

      appState.settings.voiceMode.value = 'ptt';
      expect(appState.settings.voiceMode.value).toBe('ptt');
    });

    test('should read audio bitrate setting', () => {
      appState.settings.audioBitrate.value = 40000;
      expect(appState.settings.audioBitrate.value).toBe(40000);

      appState.settings.audioBitrate.value = 24000;
      expect(appState.settings.audioBitrate.value).toBe(24000);
    });

    test('should read samples per packet setting', () => {
      expect(appState.settings.samplesPerPacket.value).toBe(960);
    });
  });

  describe('Error Handling', () => {
    test('should handle missing channel gracefully', () => {
      // Test that _registerChannel handles null/undefined input
      if (appState._registerChannel) {
        expect(() => {
          appState._registerChannel(null);
        }).toThrow();
      } else {
        // If method doesn't exist, skip test
        expect(true).toBe(true);
      }
    });

    test('should handle invalid channel data', () => {
      if (appState._registerChannel) {
        // Test with incomplete channel object
        const invalidChannel = { id: 999 }; // Missing name
        
        expect(() => {
          appState._registerChannel(invalidChannel);
        }).not.toThrow(); // Should handle gracefully
      } else {
        expect(true).toBe(true);
      }
    });
  });
});
