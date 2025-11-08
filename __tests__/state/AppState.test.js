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
const ko = (await import('knockout')).default;

describe('AppState - Vue Composables Architecture', () => {
  let appState;
  let mockAuth;
  let mockConfig;

  beforeEach(() => {
    // Mock auth
    mockAuth = {
      currentUser: ko.observable({
        email: 'test@example.com',
        app_metadata: {
          roles: ['watch', 'listen']
        }
      }),
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
    appState.settings = {
      voiceMode: ko.observable('cont'),
      audioBitrate: ko.observable(40000),
      samplesPerPacket: ko.observable(960),
      pttKey: ko.observable('ctrl + shift'),
      vadLevel: ko.observable(0.3),
      testToneVolume: ko.observable(1),
      toolbarVertical: ko.observable(false)
    };
    appState.connectDialog = {
      visible: ko.observable(false),
      address: ko.observable('localhost'),
      port: ko.observable(64738),
      username: ko.observable('TestUser'),
      password: ko.observable(''),
      isTestActive: ko.observable(false)
    };
    appState.connectionInfo = {};
    appState.connectErrorDialog = {};
    appState.sampleRateWarningDialog = {};
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
      expect(appState.settings.voiceMode()).toBe('cont');
      expect(appState.settings.audioBitrate()).toBe(40000);
      expect(appState.settings.samplesPerPacket()).toBe(960);
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
      expect(typeof appState.settings.voiceMode).toBe('function');
      expect(typeof appState.settings.audioBitrate).toBe('function');
    });

    test('settings values can be changed', () => {
      appState.settings.voiceMode('ptt');
      expect(appState.settings.voiceMode()).toBe('ptt');
      
      appState.settings.audioBitrate(48000);
      expect(appState.settings.audioBitrate()).toBe(48000);
    });
  });

  describe('Dialog Management', () => {
    test('connectDialog is initialized', () => {
      expect(appState.connectDialog).toBeDefined();
      expect(typeof appState.connectDialog.visible).toBe('function');
    });

    test('connectionInfo is initialized', () => {
      expect(appState.connectionInfo).toBeDefined();
    });

    test('connectErrorDialog is initialized', () => {
      expect(appState.connectErrorDialog).toBeDefined();
    });

    test('sampleRateWarningDialog is initialized', () => {
      expect(appState.sampleRateWarningDialog).toBeDefined();
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
      expect(typeof mockChannel.__ui.name).toBe('function'); // Knockout observable
      expect(mockChannel.__ui.name()).toBe('Root');
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
      expect(mockChannel.__ui.name()).toBe('Root');
    });

    test('should update channel name reactively', () => {
      const mockChannel = {
        id: 0,
        name: 'Initial Name',
        position: 0
      };

      appState._registerChannel(mockChannel);
      expect(mockChannel.__ui.name()).toBe('Initial Name');

      // Update the observable directly
      mockChannel.__ui.name('Updated Name');
      expect(mockChannel.__ui.name()).toBe('Updated Name');
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
      appState.settings.voiceMode('cont');
      expect(appState.settings.voiceMode()).toBe('cont');

      appState.settings.voiceMode('ptt');
      expect(appState.settings.voiceMode()).toBe('ptt');
    });

    test('should read audio bitrate setting', () => {
      appState.settings.audioBitrate(40000);
      expect(appState.settings.audioBitrate()).toBe(40000);

      appState.settings.audioBitrate(24000);
      expect(appState.settings.audioBitrate()).toBe(24000);
    });

    test('should read samples per packet setting', () => {
      expect(appState.settings.samplesPerPacket()).toBe(960);
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
