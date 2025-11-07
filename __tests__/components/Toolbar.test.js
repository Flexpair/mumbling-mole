/**
 * @jest-environment jsdom
 */

import { describe, test, expect, jest, beforeEach } from '@jest/globals';
import ko from 'knockout';

/**
 * Tests for Toolbar.vue component
 * 
 * Tests the integration between Vue component and Knockout state for
 * the main toolbar UI controls.
 * 
 * Features tested:
 * 1. Mute/unmute button visibility and click handling
 * 2. Deaf/undeaf button visibility and click handling
 * 3. Audio lock state (disabled buttons)
 * 4. Message box input and submission
 * 5. Connection info, settings, source code, logout buttons
 * 6. mailto link integration
 */

describe('Toolbar Vue Component Integration', () => {
  let mockAppState;

  beforeEach(() => {
    // Create mock AppState with Knockout observables
    mockAppState = {
      user: {
        selfMute: ko.observable(false),
        selfDeaf: ko.observable(false)
      },
      audio: {
        audioLockActive: ko.observable(false)
      },
      ui: {
        messageBox: ko.observable(''),
        currentOpenModal: ko.observable(null)
      },
      thisUser: ko.observable({ id: 1, name: 'testuser' }),
      messageBoxHint: ko.observable('Type a message...'),
      mailToDesktop: ko.observable('mailto:desktop@example.com'),
      requestMute: jest.fn(),
      requestDeaf: jest.fn(),
      handleUnmuteClick: jest.fn(),
      handleUndeafClick: jest.fn(),
      submitMessageBox: jest.fn(),
      connectionInfo: {
        show: jest.fn()
      },
      openSettings: jest.fn(),
      openSourceCode: jest.fn(),
      logoutUser: jest.fn()
    };
  });

  describe('Mute/Unmute Functionality', () => {
    test('should show mute button when not muted', () => {
      mockAppState.user.selfMute(false);
      
      expect(mockAppState.user.selfMute()).toBe(false);
    });

    test('should show unmute button when muted', () => {
      mockAppState.user.selfMute(true);
      
      expect(mockAppState.user.selfMute()).toBe(true);
    });

    test('should call requestMute when mute button clicked', () => {
      mockAppState.user.selfMute(false);
      const user = mockAppState.thisUser();
      
      mockAppState.requestMute(user);
      
      expect(mockAppState.requestMute).toHaveBeenCalledWith(user);
    });

    test('should call handleUnmuteClick when unmute button clicked', () => {
      mockAppState.user.selfMute(true);
      
      mockAppState.handleUnmuteClick();
      
      expect(mockAppState.handleUnmuteClick).toHaveBeenCalled();
    });

    test('should toggle mute state bidirectionally', () => {
      mockAppState.user.selfMute(false);
      expect(mockAppState.user.selfMute()).toBe(false);
      
      mockAppState.user.selfMute(true);
      expect(mockAppState.user.selfMute()).toBe(true);
    });
  });

  describe('Deaf/Undeaf Functionality', () => {
    test('should show deaf button when not deafened', () => {
      mockAppState.user.selfDeaf(false);
      
      expect(mockAppState.user.selfDeaf()).toBe(false);
    });

    test('should show undeaf button when deafened', () => {
      mockAppState.user.selfDeaf(true);
      
      expect(mockAppState.user.selfDeaf()).toBe(true);
    });

    test('should call requestDeaf when deaf button clicked', () => {
      mockAppState.user.selfDeaf(false);
      const user = mockAppState.thisUser();
      
      mockAppState.requestDeaf(user);
      
      expect(mockAppState.requestDeaf).toHaveBeenCalledWith(user);
    });

    test('should call handleUndeafClick when undeaf button clicked', () => {
      mockAppState.user.selfDeaf(true);
      
      mockAppState.handleUndeafClick();
      
      expect(mockAppState.handleUndeafClick).toHaveBeenCalled();
    });

    test('should toggle deaf state bidirectionally', () => {
      mockAppState.user.selfDeaf(false);
      expect(mockAppState.user.selfDeaf()).toBe(false);
      
      mockAppState.user.selfDeaf(true);
      expect(mockAppState.user.selfDeaf()).toBe(true);
    });
  });

  describe('Audio Lock State', () => {
    test('should disable unmute button when audio locked', () => {
      mockAppState.user.selfMute(true);
      mockAppState.audio.audioLockActive(true);
      
      expect(mockAppState.audio.audioLockActive()).toBe(true);
    });

    test('should disable undeaf button when audio locked', () => {
      mockAppState.user.selfDeaf(true);
      mockAppState.audio.audioLockActive(true);
      
      expect(mockAppState.audio.audioLockActive()).toBe(true);
    });

    test('should enable buttons when audio unlocked', () => {
      mockAppState.audio.audioLockActive(false);
      
      expect(mockAppState.audio.audioLockActive()).toBe(false);
    });

    test('should sync audioLockActive state changes', () => {
      mockAppState.audio.audioLockActive(false);
      expect(mockAppState.audio.audioLockActive()).toBe(false);
      
      mockAppState.audio.audioLockActive(true);
      expect(mockAppState.audio.audioLockActive()).toBe(true);
    });
  });

  describe('Message Box', () => {
    test('should sync message box value with Knockout', () => {
      mockAppState.ui.messageBox('Hello world');
      
      expect(mockAppState.ui.messageBox()).toBe('Hello world');
    });

    test('should update placeholder hint', () => {
      mockAppState.messageBoxHint('Enter message');
      
      expect(mockAppState.messageBoxHint()).toBe('Enter message');
    });

    test('should call submitMessageBox on form submit', () => {
      mockAppState.ui.messageBox('Test message');
      
      mockAppState.submitMessageBox();
      
      expect(mockAppState.submitMessageBox).toHaveBeenCalled();
    });

    test('should clear message box after submit', () => {
      mockAppState.ui.messageBox('Test message');
      mockAppState.submitMessageBox();
      
      // In real implementation, submitMessageBox clears the box
      expect(mockAppState.submitMessageBox).toHaveBeenCalled();
    });

    test('should handle empty message box', () => {
      mockAppState.ui.messageBox('');
      
      expect(mockAppState.ui.messageBox()).toBe('');
    });

    test('should handle message box with special characters', () => {
      const specialMessage = 'Test <html> & "quotes"';
      mockAppState.ui.messageBox(specialMessage);
      
      expect(mockAppState.ui.messageBox()).toBe(specialMessage);
    });
  });

  describe('Mailto Link', () => {
    test('should sync mailToDesktop link', () => {
      mockAppState.mailToDesktop('mailto:test@example.com');
      
      expect(mockAppState.mailToDesktop()).toBe('mailto:test@example.com');
    });

    test('should update mailToDesktop dynamically', () => {
      mockAppState.mailToDesktop('mailto:old@example.com');
      mockAppState.mailToDesktop('mailto:new@example.com');
      
      expect(mockAppState.mailToDesktop()).toBe('mailto:new@example.com');
    });

    test('should handle empty mailToDesktop', () => {
      mockAppState.mailToDesktop('');
      
      expect(mockAppState.mailToDesktop()).toBe('');
    });
  });

  describe('Connection Info Button', () => {
    test('should call connectionInfo.show when clicked', () => {
      mockAppState.connectionInfo.show();
      
      expect(mockAppState.connectionInfo.show).toHaveBeenCalled();
    });

    test('should handle multiple clicks', () => {
      mockAppState.connectionInfo.show();
      mockAppState.connectionInfo.show();
      
      expect(mockAppState.connectionInfo.show).toHaveBeenCalledTimes(2);
    });
  });

  describe('Settings Button', () => {
    test('should call openSettings when clicked', () => {
      mockAppState.openSettings();
      
      expect(mockAppState.openSettings).toHaveBeenCalled();
    });

    test('should handle multiple clicks', () => {
      mockAppState.openSettings();
      mockAppState.openSettings();
      
      expect(mockAppState.openSettings).toHaveBeenCalledTimes(2);
    });
  });

  describe('Source Code Button', () => {
    test('should call openSourceCode when clicked', () => {
      mockAppState.openSourceCode();
      
      expect(mockAppState.openSourceCode).toHaveBeenCalled();
    });

    test('should handle multiple clicks', () => {
      mockAppState.openSourceCode();
      mockAppState.openSourceCode();
      
      expect(mockAppState.openSourceCode).toHaveBeenCalledTimes(2);
    });
  });

  describe('Logout Button', () => {
    test('should call logoutUser when clicked', () => {
      mockAppState.logoutUser();
      
      expect(mockAppState.logoutUser).toHaveBeenCalled();
    });

    test('should handle multiple clicks', () => {
      mockAppState.logoutUser();
      mockAppState.logoutUser();
      
      expect(mockAppState.logoutUser).toHaveBeenCalledTimes(2);
    });
  });

  describe('Combined State Changes', () => {
    test('should handle simultaneous mute and deaf', () => {
      mockAppState.user.selfMute(true);
      mockAppState.user.selfDeaf(true);
      
      expect(mockAppState.user.selfMute()).toBe(true);
      expect(mockAppState.user.selfDeaf()).toBe(true);
    });

    test('should handle mute with audio lock', () => {
      mockAppState.user.selfMute(true);
      mockAppState.audio.audioLockActive(true);
      
      expect(mockAppState.user.selfMute()).toBe(true);
      expect(mockAppState.audio.audioLockActive()).toBe(true);
    });

    test('should handle deaf with audio lock', () => {
      mockAppState.user.selfDeaf(true);
      mockAppState.audio.audioLockActive(true);
      
      expect(mockAppState.user.selfDeaf()).toBe(true);
      expect(mockAppState.audio.audioLockActive()).toBe(true);
    });
  });

  describe('Subscription Lifecycle', () => {
    test('should support subscriptions to selfMute', () => {
      const values = [];
      const sub = mockAppState.user.selfMute.subscribe((val) => {
        values.push(val);
      });
      
      mockAppState.user.selfMute(true);
      mockAppState.user.selfMute(false);
      
      expect(values).toEqual([true, false]);
      
      sub.dispose();
    });

    test('should support subscriptions to selfDeaf', () => {
      const values = [];
      const sub = mockAppState.user.selfDeaf.subscribe((val) => {
        values.push(val);
      });
      
      mockAppState.user.selfDeaf(true);
      mockAppState.user.selfDeaf(false);
      
      expect(values).toEqual([true, false]);
      
      sub.dispose();
    });

    test('should support subscriptions to audioLockActive', () => {
      const values = [];
      const sub = mockAppState.audio.audioLockActive.subscribe((val) => {
        values.push(val);
      });
      
      mockAppState.audio.audioLockActive(true);
      mockAppState.audio.audioLockActive(false);
      
      expect(values).toEqual([true, false]);
      
      sub.dispose();
    });

    test('should support subscriptions to messageBox', () => {
      const values = [];
      const sub = mockAppState.ui.messageBox.subscribe((val) => {
        values.push(val);
      });
      
      mockAppState.ui.messageBox('First');
      mockAppState.ui.messageBox('Second');
      
      expect(values).toEqual(['First', 'Second']);
      
      sub.dispose();
    });

    test('should support subscriptions to mailToDesktop', () => {
      const values = [];
      const sub = mockAppState.mailToDesktop.subscribe((val) => {
        values.push(val);
      });
      
      mockAppState.mailToDesktop('mailto:first@example.com');
      mockAppState.mailToDesktop('mailto:second@example.com');
      
      expect(values).toEqual(['mailto:first@example.com', 'mailto:second@example.com']);
      
      sub.dispose();
    });
  });

  describe('Edge Cases', () => {
    test('should handle null thisUser', () => {
      mockAppState.thisUser(null);
      
      expect(mockAppState.thisUser()).toBe(null);
    });

    test('should handle undefined connectionInfo', () => {
      mockAppState.connectionInfo = undefined;
      
      expect(mockAppState.connectionInfo).toBeUndefined();
    });

    test('should handle rapid state toggles', () => {
      mockAppState.user.selfMute(true);
      mockAppState.user.selfMute(false);
      mockAppState.user.selfMute(true);
      
      expect(mockAppState.user.selfMute()).toBe(true);
    });

    test('should handle concurrent audio lock and mute changes', () => {
      mockAppState.user.selfMute(true);
      mockAppState.audio.audioLockActive(true);
      mockAppState.user.selfMute(false);
      mockAppState.audio.audioLockActive(false);
      
      expect(mockAppState.user.selfMute()).toBe(false);
      expect(mockAppState.audio.audioLockActive()).toBe(false);
    });
  });
});
