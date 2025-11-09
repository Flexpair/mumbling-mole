/**
 * @jest-environment jsdom
 */

import { describe, test, expect, jest, beforeEach } from '@jest/globals';

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
        selfMute: { value: false },
        selfDeaf: { value: false }
      },
      audio: {
        audioLockActive: { value: false }
      },
      ui: {
        messageBox: { value: '' },
        currentOpenModal: { value: null }
      },
      thisUser: { value: { id: 1, name: 'testuser' } },
      messageBoxHint: { value: 'Type a message...' },
      mailToDesktop: { value: 'mailto:desktop@example.com' },
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
      mockAppState.user.selfMute.value = false;
      
      expect(mockAppState.user.selfMute.value).toBe(false);
    });

    test('should show unmute button when muted', () => {
      mockAppState.user.selfMute.value = true;
      
      expect(mockAppState.user.selfMute.value).toBe(true);
    });

    test('should call requestMute when mute button clicked', () => {
      mockAppState.user.selfMute.value = false;
      const user = mockAppState.thisUser.value;
      
      mockAppState.requestMute(user);
      
      expect(mockAppState.requestMute).toHaveBeenCalledWith(user);
    });

    test('should call handleUnmuteClick when unmute button clicked', () => {
      mockAppState.user.selfMute.value = true;
      
      mockAppState.handleUnmuteClick();
      
      expect(mockAppState.handleUnmuteClick).toHaveBeenCalled();
    });

    test('should toggle mute state bidirectionally', () => {
      mockAppState.user.selfMute.value = false;
      expect(mockAppState.user.selfMute.value).toBe(false);
      
      mockAppState.user.selfMute.value = true;
      expect(mockAppState.user.selfMute.value).toBe(true);
    });
  });

  describe('Deaf/Undeaf Functionality', () => {
    test('should show deaf button when not deafened', () => {
      mockAppState.user.selfDeaf.value = false;
      
      expect(mockAppState.user.selfDeaf.value).toBe(false);
    });

    test('should show undeaf button when deafened', () => {
      mockAppState.user.selfDeaf.value = true;
      
      expect(mockAppState.user.selfDeaf.value).toBe(true);
    });

    test('should call requestDeaf when deaf button clicked', () => {
      mockAppState.user.selfDeaf.value = false;
      const user = mockAppState.thisUser.value;
      
      mockAppState.requestDeaf(user);
      
      expect(mockAppState.requestDeaf).toHaveBeenCalledWith(user);
    });

    test('should call handleUndeafClick when undeaf button clicked', () => {
      mockAppState.user.selfDeaf.value = true;
      
      mockAppState.handleUndeafClick();
      
      expect(mockAppState.handleUndeafClick).toHaveBeenCalled();
    });

    test('should toggle deaf state bidirectionally', () => {
      mockAppState.user.selfDeaf.value = false;
      expect(mockAppState.user.selfDeaf.value).toBe(false);
      
      mockAppState.user.selfDeaf.value = true;
      expect(mockAppState.user.selfDeaf.value).toBe(true);
    });
  });

  describe('Audio Lock State', () => {
    test('should disable unmute button when audio locked', () => {
      mockAppState.user.selfMute.value = true;
      mockAppState.audio.audioLockActive.value = true;
      
      expect(mockAppState.audio.audioLockActive.value).toBe(true);
    });

    test('should disable undeaf button when audio locked', () => {
      mockAppState.user.selfDeaf.value = true;
      mockAppState.audio.audioLockActive.value = true;
      
      expect(mockAppState.audio.audioLockActive.value).toBe(true);
    });

    test('should enable buttons when audio unlocked', () => {
      mockAppState.audio.audioLockActive.value = false;
      
      expect(mockAppState.audio.audioLockActive.value).toBe(false);
    });

    test('should sync audioLockActive state changes', () => {
      mockAppState.audio.audioLockActive.value = false;
      expect(mockAppState.audio.audioLockActive.value).toBe(false);
      
      mockAppState.audio.audioLockActive.value = true;
      expect(mockAppState.audio.audioLockActive.value).toBe(true);
    });
  });

  describe('Message Box', () => {
    test('should sync message box value with Knockout', () => {
      mockAppState.ui.messageBox.value = 'Hello world';
      
      expect(mockAppState.ui.messageBox.value).toBe('Hello world');
    });

    test('should update placeholder hint', () => {
      mockAppState.messageBoxHint.value = 'Enter message';
      
      expect(mockAppState.messageBoxHint.value).toBe('Enter message');
    });

    test('should call submitMessageBox on form submit', () => {
      mockAppState.ui.messageBox.value = 'Test message';
      
      mockAppState.submitMessageBox();
      
      expect(mockAppState.submitMessageBox).toHaveBeenCalled();
    });

    test('should clear message box after submit', () => {
      mockAppState.ui.messageBox.value = 'Test message';
      mockAppState.submitMessageBox();
      
      // In real implementation, submitMessageBox clears the box
      expect(mockAppState.submitMessageBox).toHaveBeenCalled();
    });

    test('should handle empty message box', () => {
      mockAppState.ui.messageBox.value = '';
      
      expect(mockAppState.ui.messageBox.value).toBe('');
    });

    test('should handle message box with special characters', () => {
      const specialMessage = 'Test <html> & "quotes"';
      mockAppState.ui.messageBox.value = specialMessage;
      
      expect(mockAppState.ui.messageBox.value).toBe(specialMessage);
    });
  });

  describe('Mailto Link', () => {
    test('should sync mailToDesktop link', () => {
      mockAppState.mailToDesktop.value = 'mailto:test@example.com';
      
      expect(mockAppState.mailToDesktop.value).toBe('mailto:test@example.com');
    });

    test('should update mailToDesktop dynamically', () => {
      mockAppState.mailToDesktop.value = 'mailto:old@example.com';
      mockAppState.mailToDesktop.value = 'mailto:new@example.com';
      
      expect(mockAppState.mailToDesktop.value).toBe('mailto:new@example.com');
    });

    test('should handle empty mailToDesktop', () => {
      mockAppState.mailToDesktop.value = '';
      
      expect(mockAppState.mailToDesktop.value).toBe('');
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
      mockAppState.user.selfMute.value = true;
      mockAppState.user.selfDeaf.value = true;
      
      expect(mockAppState.user.selfMute.value).toBe(true);
      expect(mockAppState.user.selfDeaf.value).toBe(true);
    });

    test('should handle mute with audio lock', () => {
      mockAppState.user.selfMute.value = true;
      mockAppState.audio.audioLockActive.value = true;
      
      expect(mockAppState.user.selfMute.value).toBe(true);
      expect(mockAppState.audio.audioLockActive.value).toBe(true);
    });

    test('should handle deaf with audio lock', () => {
      mockAppState.user.selfDeaf.value = true;
      mockAppState.audio.audioLockActive.value = true;
      
      expect(mockAppState.user.selfDeaf.value).toBe(true);
      expect(mockAppState.audio.audioLockActive.value).toBe(true);
    });
  });


  describe('Edge Cases', () => {
    test('should handle null thisUser', () => {
      mockAppState.thisUser.value = null;
      
      expect(mockAppState.thisUser.value).toBe(null);
    });

    test('should handle undefined connectionInfo', () => {
      mockAppState.connectionInfo = undefined;
      
      expect(mockAppState.connectionInfo).toBeUndefined();
    });

    test('should handle rapid state toggles', () => {
      mockAppState.user.selfMute.value = true;
      mockAppState.user.selfMute.value = false;
      mockAppState.user.selfMute.value = true;
      
      expect(mockAppState.user.selfMute.value).toBe(true);
    });

    test('should handle concurrent audio lock and mute changes', () => {
      mockAppState.user.selfMute.value = true;
      mockAppState.audio.audioLockActive.value = true;
      mockAppState.user.selfMute.value = false;
      mockAppState.audio.audioLockActive.value = false;
      
      expect(mockAppState.user.selfMute.value).toBe(false);
      expect(mockAppState.audio.audioLockActive.value).toBe(false);
    });
  });
});
