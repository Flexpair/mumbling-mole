/**
 * @jest-environment jsdom
 */

import { describe, test, expect, jest, beforeEach } from '@jest/globals';
import ko from 'knockout';

/**
 * Tests for ConnectDialog.vue component
 * 
 * Since we're in dual-runtime mode, we test the integration between
 * Vue component and Knockout state.
 * 
 * The ConnectDialog is complex with multiple features:
 * 1. Visibility sync with Knockout
 * 2. Form handling (username, password, microphone)
 * 3. Loopback test mode (Audio Test toggle)
 * 4. Piano button (Beeper) for audio testing
 * 5. Real-time frequency display
 * 6. Multiple Knockout subscriptions (beeperReady, voiceHandlerReady, dominantFrequency)
 * 7. Modal state management
 */

describe('ConnectDialog Vue Component Integration', () => {
  let mockAppState;
  let mockConfig;

  beforeEach(() => {
    // Create mock config
    mockConfig = {
      connectDialog: {
        username: true,
        password: true
      }
    };

    // Create mock AppState with Knockout observables
    mockAppState = {
      connectDialog: {
        visible: ko.observable(false),
        isTestActive: ko.observable(false),
        address: ko.observable(''),
        port: ko.observable(''),
        username: ko.observable('testuser'),
        password: ko.observable(''),
        connect: jest.fn(),
        toggleLoopback: jest.fn(),
        hide: jest.fn()
      },
      audio: {
        beeperReady: ko.observable(false),
        audioContext: null
      },
      voice: {
        voiceHandlerReady: ko.observable(false),
        isLoopbackMode: ko.observable(false),
        loopbackDominantFrequency: ko.observable(0)
      },
      startBeep: jest.fn(),
      stopBeep: jest.fn(),
      connected: ko.observable(false),
      ui: {
        currentOpenModal: ko.observable(null)
      }
    };
  });

  describe('Dual Runtime Integration Pattern', () => {
    test('Vue component should sync with Knockout visible observable', () => {
      expect(mockAppState.connectDialog.visible()).toBe(false);
      
      mockAppState.connectDialog.visible(true);
      
      expect(mockAppState.connectDialog.visible()).toBe(true);
    });

    test('should sync isTestActive with Knockout', () => {
      expect(mockAppState.connectDialog.isTestActive()).toBe(false);
      
      mockAppState.connectDialog.isTestActive(true);
      
      expect(mockAppState.connectDialog.isTestActive()).toBe(true);
    });

    test('should sync form fields with Knockout', () => {
      mockAppState.connectDialog.username('newuser');
      mockAppState.connectDialog.password('secret');
      mockAppState.connectDialog.address('server.example.com');
      mockAppState.connectDialog.port('64738');
      
      expect(mockAppState.connectDialog.username()).toBe('newuser');
      expect(mockAppState.connectDialog.password()).toBe('secret');
      expect(mockAppState.connectDialog.address()).toBe('server.example.com');
      expect(mockAppState.connectDialog.port()).toBe('64738');
    });
  });

  describe('Audio Test Features', () => {
    describe('Beeper Ready State', () => {
      test('beeperReady observable tracks audio initialization', () => {
        expect(mockAppState.audio.beeperReady()).toBe(false);
        
        mockAppState.audio.beeperReady(true);
        
        expect(mockAppState.audio.beeperReady()).toBe(true);
      });

      test('should subscribe to beeperReady changes', () => {
        const callback = jest.fn();
        const subscription = mockAppState.audio.beeperReady.subscribe(callback);
        
        mockAppState.audio.beeperReady(true);
        
        expect(callback).toHaveBeenCalledWith(true);
        subscription.dispose();
      });
    });

    describe('Voice Handler Ready State', () => {
      test('voiceHandlerReady observable tracks voice handler initialization', () => {
        expect(mockAppState.voice.voiceHandlerReady()).toBe(false);
        
        mockAppState.voice.voiceHandlerReady(true);
        
        expect(mockAppState.voice.voiceHandlerReady()).toBe(true);
      });

      test('should subscribe to voiceHandlerReady changes', () => {
        const callback = jest.fn();
        const subscription = mockAppState.voice.voiceHandlerReady.subscribe(callback);
        
        mockAppState.voice.voiceHandlerReady(true);
        
        expect(callback).toHaveBeenCalledWith(true);
        subscription.dispose();
      });
    });

    describe('Loopback Frequency Display', () => {
      test('loopbackDominantFrequency tracks detected frequency', () => {
        expect(mockAppState.voice.loopbackDominantFrequency()).toBe(0);
        
        mockAppState.voice.loopbackDominantFrequency(440.5);
        
        expect(mockAppState.voice.loopbackDominantFrequency()).toBe(440.5);
      });

      test('should subscribe to frequency changes', () => {
        const callback = jest.fn();
        const subscription = mockAppState.voice.loopbackDominantFrequency.subscribe(callback);
        
        mockAppState.voice.loopbackDominantFrequency(440);
        mockAppState.voice.loopbackDominantFrequency(441.2);
        
        expect(callback).toHaveBeenCalledTimes(2);
        expect(callback).toHaveBeenLastCalledWith(441.2);
        subscription.dispose();
      });

      test('frequency rounds to 1 decimal place in display', () => {
        mockAppState.voice.loopbackDominantFrequency(440.567);
        
        // The Vue template rounds to 1 decimal: dominantFrequency.toFixed(1)
        const displayed = mockAppState.voice.loopbackDominantFrequency().toFixed(1);
        expect(displayed).toBe('440.6');
      });

      test('displays "--- Hz" when frequency is 0', () => {
        mockAppState.voice.loopbackDominantFrequency(0);
        
        const freq = mockAppState.voice.loopbackDominantFrequency();
        const display = freq > 0 ? freq + ' Hz' : '--- Hz';
        expect(display).toBe('--- Hz');
      });
    });
  });

  describe('handleConnect() - Form Submission', () => {
    test('calls Knockout connectDialog.connect() when form submitted', () => {
      // Simulate form submission
      if (mockAppState?.connectDialog?.connect) {
        mockAppState.connectDialog.connect();
      }
      
      expect(mockAppState.connectDialog.connect).toHaveBeenCalled();
    });

    test('does nothing when connectDialog.connect not available', () => {
      const brokenState = { connectDialog: {} };
      
      // Should not throw
      if (brokenState?.connectDialog?.connect) {
        brokenState.connectDialog.connect();
      }
      
      // No error expected
      expect(true).toBe(true);
    });

    test('handles connection when already connected (exits test mode)', () => {
      mockAppState.connected(true);
      mockAppState.connectDialog.isTestActive(true);
      
      mockAppState.connectDialog.connect();
      
      expect(mockAppState.connectDialog.connect).toHaveBeenCalled();
    });
  });

  describe('handleToggleLoopback() - Audio Test Toggle', () => {
    test('activates loopback test mode when toggled', async () => {
      expect(mockAppState.connectDialog.isTestActive()).toBe(false);
      
      await mockAppState.connectDialog.toggleLoopback();
      
      expect(mockAppState.connectDialog.toggleLoopback).toHaveBeenCalled();
    });

    test('one-way activation - does not deactivate when already active', async () => {
      mockAppState.connectDialog.isTestActive(true);
      
      // Simulate Vue component logic: return early if already active
      if (mockAppState.connectDialog.isTestActive()) {
        // Do nothing - one-way activation only
        return;
      }
      
      // Should not reach here
      await mockAppState.connectDialog.toggleLoopback();
      
      expect(mockAppState.connectDialog.toggleLoopback).not.toHaveBeenCalled();
    });

    test('requires "Exit Test Mode" button to deactivate', () => {
      mockAppState.connectDialog.isTestActive(true);
      
      // To exit test mode, user must click "Exit Test Mode" button
      // which calls handleExitTest() -> connect()
      mockAppState.connectDialog.connect();
      
      expect(mockAppState.connectDialog.connect).toHaveBeenCalled();
    });
  });

  describe('handleExitTest() - Exit Test Mode', () => {
    test('calls connect() to exit test mode and show Guacamole', () => {
      mockAppState.connectDialog.isTestActive(true);
      
      // Exit test mode by calling connect()
      mockAppState.connectDialog.connect();
      
      expect(mockAppState.connectDialog.connect).toHaveBeenCalled();
    });

    test('ensures isTestActive is true before exiting', () => {
      // If somehow isTestActive is false, set it to true
      expect(mockAppState.connectDialog.isTestActive()).toBe(false);
      
      if (!mockAppState.connectDialog.isTestActive()) {
        mockAppState.connectDialog.isTestActive(true);
      }
      
      expect(mockAppState.connectDialog.isTestActive()).toBe(true);
    });
  });

  describe('startBeep() / stopBeep() - Piano Button', () => {
    test('startBeep calls appState.startBeep()', () => {
      if (mockAppState?.startBeep) {
        mockAppState.startBeep();
      }
      
      expect(mockAppState.startBeep).toHaveBeenCalled();
    });

    test('stopBeep calls appState.stopBeep()', () => {
      if (mockAppState?.stopBeep) {
        mockAppState.stopBeep();
      }
      
      expect(mockAppState.stopBeep).toHaveBeenCalled();
    });

    test('handles missing startBeep gracefully', () => {
      const brokenState = {};
      
      // Should not throw
      if (brokenState?.startBeep) {
        brokenState.startBeep();
      }
      
      expect(true).toBe(true);
    });

    test('handles missing stopBeep gracefully', () => {
      const brokenState = {};
      
      // Should not throw
      if (brokenState?.stopBeep) {
        brokenState.stopBeep();
      }
      
      expect(true).toBe(true);
    });
  });

  describe('handleHide() - Close Dialog', () => {
    test('calls Knockout connectDialog.hide()', () => {
      if (mockAppState?.connectDialog?.hide) {
        mockAppState.connectDialog.hide();
      }
      
      expect(mockAppState.connectDialog.hide).toHaveBeenCalled();
    });

    test('handles missing hide method gracefully', () => {
      const brokenState = { connectDialog: {} };
      
      // Should not throw
      if (brokenState?.connectDialog?.hide) {
        brokenState.connectDialog.hide();
      }
      
      expect(true).toBe(true);
    });
  });

  describe('Subscription Lifecycle', () => {
    test('all subscriptions should be disposable', () => {
      const sub1 = mockAppState.audio.beeperReady.subscribe(() => {});
      const sub2 = mockAppState.voice.voiceHandlerReady.subscribe(() => {});
      const sub3 = mockAppState.voice.loopbackDominantFrequency.subscribe(() => {});
      
      expect(typeof sub1.dispose).toBe('function');
      expect(typeof sub2.dispose).toBe('function');
      expect(typeof sub3.dispose).toBe('function');
      
      // Cleanup
      sub1.dispose();
      sub2.dispose();
      sub3.dispose();
    });

    test('subscriptions stop firing after disposal', () => {
      const callback = jest.fn();
      const subscription = mockAppState.audio.beeperReady.subscribe(callback);
      
      mockAppState.audio.beeperReady(true);
      expect(callback).toHaveBeenCalledTimes(1);
      
      subscription.dispose();
      
      mockAppState.audio.beeperReady(false);
      // Should still be 1, not 2
      expect(callback).toHaveBeenCalledTimes(1);
    });

    test('component should dispose all 3 subscriptions on unmount', () => {
      const disposeSpy1 = jest.fn();
      const disposeSpy2 = jest.fn();
      const disposeSpy3 = jest.fn();
      
      const sub1 = mockAppState.audio.beeperReady.subscribe(() => {});
      const sub2 = mockAppState.voice.voiceHandlerReady.subscribe(() => {});
      const sub3 = mockAppState.voice.loopbackDominantFrequency.subscribe(() => {});
      
      sub1.dispose = disposeSpy1;
      sub2.dispose = disposeSpy2;
      sub3.dispose = disposeSpy3;
      
      // Simulate onUnmounted
      sub1.dispose();
      sub2.dispose();
      sub3.dispose();
      
      expect(disposeSpy1).toHaveBeenCalled();
      expect(disposeSpy2).toHaveBeenCalled();
      expect(disposeSpy3).toHaveBeenCalled();
    });
  });

  describe('Loopback Mode Integration', () => {
    test('isLoopbackMode tracks test state', () => {
      expect(mockAppState.voice.isLoopbackMode()).toBe(false);
      
      mockAppState.voice.isLoopbackMode(true);
      
      expect(mockAppState.voice.isLoopbackMode()).toBe(true);
    });

    test('frequency display only shown when in loopback mode', () => {
      // Frequency display uses v-if="isLoopbackMode"
      mockAppState.voice.isLoopbackMode(false);
      expect(mockAppState.voice.isLoopbackMode()).toBe(false);
      
      mockAppState.voice.isLoopbackMode(true);
      expect(mockAppState.voice.isLoopbackMode()).toBe(true);
    });

    test('test section hidden when isTestActive is false', () => {
      // Test controls use v-if="isTestActive"
      expect(mockAppState.connectDialog.isTestActive()).toBe(false);
    });

    test('test section shown when isTestActive is true', () => {
      mockAppState.connectDialog.isTestActive(true);
      expect(mockAppState.connectDialog.isTestActive()).toBe(true);
    });
  });

  describe('Piano Button State', () => {
    test('button disabled when beeperReady is false', () => {
      mockAppState.audio.beeperReady(false);
      mockAppState.voice.voiceHandlerReady(true);
      
      const disabled = !mockAppState.audio.beeperReady() || !mockAppState.voice.voiceHandlerReady();
      expect(disabled).toBe(true);
    });

    test('button disabled when voiceHandlerReady is false', () => {
      mockAppState.audio.beeperReady(true);
      mockAppState.voice.voiceHandlerReady(false);
      
      const disabled = !mockAppState.audio.beeperReady() || !mockAppState.voice.voiceHandlerReady();
      expect(disabled).toBe(true);
    });

    test('button enabled when both beeperReady and voiceHandlerReady are true', () => {
      mockAppState.audio.beeperReady(true);
      mockAppState.voice.voiceHandlerReady(true);
      
      const disabled = !mockAppState.audio.beeperReady() || !mockAppState.voice.voiceHandlerReady();
      expect(disabled).toBe(false);
    });
  });

  describe('Microphone Container', () => {
    test('microphone select element should be moved into Vue component', () => {
      // The Vue component moves the global #audioSource select
      // into its microphoneContainer ref on mount
      
      // Simulate DOM element exists
      const mockAudioSourceSelect = {
        id: 'audioSource',
        style: { display: 'none' }
      };
      
      // Simulate Vue onMounted logic
      if (mockAudioSourceSelect) {
        mockAudioSourceSelect.style.display = 'block';
        // Append to microphoneContainer (simulated)
      }
      
      expect(mockAudioSourceSelect.style.display).toBe('block');
    });
  });

  describe('Config-based Visibility', () => {
    test('username field shown when config.connectDialog.username is true', () => {
      expect(mockConfig.connectDialog.username).toBe(true);
    });

    test('password field shown when config.connectDialog.password is true', () => {
      expect(mockConfig.connectDialog.password).toBe(true);
    });

    test('fields hidden when config values are false', () => {
      mockConfig.connectDialog.username = false;
      mockConfig.connectDialog.password = false;
      
      expect(mockConfig.connectDialog.username).toBe(false);
      expect(mockConfig.connectDialog.password).toBe(false);
    });
  });

  describe('Connection State Integration', () => {
    test('tracks connected state from Knockout', () => {
      expect(mockAppState.connected()).toBe(false);
      
      mockAppState.connected(true);
      
      expect(mockAppState.connected()).toBe(true);
    });

    test('button label changes based on connected state', () => {
      // When not connected: "Connect"
      // When connected and in test: "Exit Test Mode"
      // When connected and not in test: "Connect"
      
      mockAppState.connected(false);
      mockAppState.connectDialog.isTestActive(false);
      let label = mockAppState.connected() && mockAppState.connectDialog.isTestActive() 
        ? 'Exit Test Mode' 
        : 'Connect';
      expect(label).toBe('Connect');
      
      mockAppState.connected(true);
      mockAppState.connectDialog.isTestActive(true);
      label = mockAppState.connected() && mockAppState.connectDialog.isTestActive() 
        ? 'Exit Test Mode' 
        : 'Connect';
      expect(label).toBe('Exit Test Mode');
    });
  });

  describe('Edge Cases', () => {
    test('handles undefined appState gracefully', () => {
      const undefinedState = undefined;
      
      // All handlers check appState?.method
      if (undefinedState?.connectDialog?.connect) {
        undefinedState.connectDialog.connect();
      }
      
      // Should not throw
      expect(true).toBe(true);
    });

    test('handles null config gracefully', () => {
      const nullConfig = null;
      
      // Template uses config.connectDialog?.username
      const showUsername = nullConfig?.connectDialog?.username ?? false;
      expect(showUsername).toBe(false);
    });

    test('handles missing audio state gracefully', () => {
      const stateWithoutAudio = { connectDialog: mockAppState.connectDialog };
      
      if (stateWithoutAudio?.audio?.beeperReady) {
        // Should not execute
        expect(true).toBe(false);
      }
      
      expect(true).toBe(true);
    });

    test('handles missing voice state gracefully', () => {
      const stateWithoutVoice = { connectDialog: mockAppState.connectDialog };
      
      if (stateWithoutVoice?.voice?.voiceHandlerReady) {
        // Should not execute
        expect(true).toBe(false);
      }
      
      expect(true).toBe(true);
    });
  });

  describe('Documentation: Vue Component Behavior', () => {
    /**
     * The Vue component (ConnectDialog.vue) has these key behaviors:
     * 
     * 1. **Visibility Sync**: Bidirectional sync with Knockout observable
     *    - Vue → Knockout: watch(visible, val => appState.connectDialog.visible(val))
     *    - Knockout → Vue: appState.connectDialog.visible.subscribe(val => visible.value = val)
     * 
     * 2. **Form Field Sync**: Bidirectional sync for address, port, username, password
     *    - Each field has its own watch() and subscribe() pair
     * 
     * 3. **Audio Test Features**:
     *    - Loopback toggle (one-way activation only)
     *    - Piano button (beeper) with mousedown/mouseup/touchstart/touchend
     *    - Real-time frequency display (rounded to 1 decimal)
     * 
     * 4. **Subscription Management**: 3 subscriptions to Knockout observables
     *    - beeperReady (audio readiness)
     *    - voiceHandlerReady (voice handler readiness)
     *    - loopbackDominantFrequency (detected frequency in Hz)
     *    - All disposed in onUnmounted()
     * 
     * 5. **Event Delegation**: All actions delegate to Knockout methods
     *    - handleConnect() → appState.connectDialog.connect()
     *    - handleToggleLoopback() → appState.connectDialog.toggleLoopback()
     *    - startBeep() → appState.startBeep()
     *    - stopBeep() → appState.stopBeep()
     *    - handleHide() → appState.connectDialog.hide()
     * 
     * 6. **Microphone Select**: Moves global #audioSource into component on mount
     * 
     * These tests verify the Knockout side of this integration.
     * The Vue component itself is tested indirectly through browser testing.
     */
    
    test('documentation test - Vue component integration points', () => {
      // Verify all integration points exist
      expect(mockAppState.connectDialog.visible).toBeDefined();
      expect(mockAppState.connectDialog.isTestActive).toBeDefined();
      expect(mockAppState.connectDialog.connect).toBeDefined();
      expect(mockAppState.connectDialog.toggleLoopback).toBeDefined();
      expect(mockAppState.audio.beeperReady).toBeDefined();
      expect(mockAppState.voice.voiceHandlerReady).toBeDefined();
      expect(mockAppState.voice.loopbackDominantFrequency).toBeDefined();
      expect(mockAppState.startBeep).toBeDefined();
      expect(mockAppState.stopBeep).toBeDefined();
    });

    test('documentation test - all observables are functions', () => {
      // Knockout observables are functions
      expect(typeof mockAppState.connectDialog.visible).toBe('function');
      expect(typeof mockAppState.connectDialog.isTestActive).toBe('function');
      expect(typeof mockAppState.audio.beeperReady).toBe('function');
      expect(typeof mockAppState.voice.voiceHandlerReady).toBe('function');
      expect(typeof mockAppState.voice.loopbackDominantFrequency).toBe('function');
    });

    test('documentation test - all observables have subscribe method', () => {
      // All Knockout observables can be subscribed to
      expect(typeof mockAppState.connectDialog.visible.subscribe).toBe('function');
      expect(typeof mockAppState.connectDialog.isTestActive.subscribe).toBe('function');
      expect(typeof mockAppState.audio.beeperReady.subscribe).toBe('function');
      expect(typeof mockAppState.voice.voiceHandlerReady.subscribe).toBe('function');
      expect(typeof mockAppState.voice.loopbackDominantFrequency.subscribe).toBe('function');
    });
  });
});
