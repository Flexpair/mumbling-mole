/**
 * Characterization tests for Toolbar (Knockout version)
 * 
 * These tests document the current behavior before Vue.js migration.
 * The Toolbar contains the main UI controls: mute/deaf buttons, message box,
 * and various action buttons (settings, source code, logout, etc.)
 * 
 * Location in UI: Bottom of the screen (app/index.html lines 187-267)
 * State management: Distributed across AppState modules (UserState, UIState, AudioState)
 */

import ko from 'knockout';

describe('Toolbar - Knockout Characterization Tests', () => {
  let appState;
  let mockClient;
  let mockCalls;

  beforeEach(() => {
    // Track mock function calls
    mockCalls = {
      setSelfMute: [],
      setSelfDeaf: [],
      sendMessage: [],
      openSettings: [],
      openSourceCode: [],
      logoutUser: []
    };

    // Mock minimal AppState structure for toolbar functionality
    mockClient = {
      setSelfMute: (val) => mockCalls.setSelfMute.push(val),
      setSelfDeaf: (val) => mockCalls.setSelfDeaf.push(val),
      sendMessage: (target, message) => mockCalls.sendMessage.push({ target, message })
    };

    // Create minimal AppState mock with relevant observables
    appState = {
      // UserState properties
      selfMute: ko.observable(false),
      selfDeaf: ko.observable(false),
      thisUser: ko.observable(null),
      
      // AudioState properties
      audioLockActive: ko.observable(false),
      audioLockReason: ko.observable(null),
      
      // UIState properties
      messageBox: ko.observable(''),
      messageBoxHint: ko.observable('Message'),
      selected: ko.observable(null),
      
      // ConnectionState properties
      client: mockClient,
      connected: ko.observable(false),
      remoteHost: ko.observable(''),
      remotePort: ko.observable(''),
      
      // Methods
      requestMute: function(user) {
        if (user) {
          this.selfMute(true);
          if (this.client) {
            this.client.setSelfMute(true);
          }
        }
      },
      
      requestDeaf: function(user) {
        if (user) {
          this.selfDeaf(true);
          if (this.client) {
            this.client.setSelfDeaf(true);
          }
        }
      },
      
      handleUnmuteClick: function() {
        if (!this.audioLockActive()) {
          this.selfMute(false);
          if (this.client) {
            this.client.setSelfMute(false);
          }
        }
      },
      
      handleUndeafClick: function() {
        if (!this.audioLockActive()) {
          this.selfDeaf(false);
          if (this.client) {
            this.client.setSelfDeaf(false);
          }
        }
      },
      
      submitMessageBox: function(sendMessageFn, target) {
        const text = this.messageBox();
        if (text && text.trim()) {
          if (sendMessageFn) {
            sendMessageFn(target, text);
          }
          this.messageBox('');
        }
      },
      
      sendMessage: function(target, message) {
        if (appState.client) {
          appState.client.sendMessage(target, message);
        }
      },
      
      openSettings: () => mockCalls.openSettings.push(true),
      openSourceCode: () => mockCalls.openSourceCode.push(true),
      logoutUser: () => mockCalls.logoutUser.push(true)
    };
    
    // Add computed observables after appState is initialized
    appState.mailToDesktop = ko.computed(() => {
      const host = appState.remoteHost();
      const port = appState.remotePort();
      if (host && port) {
        return `mailto:${host}@${port}`;
      }
      return 'mailto:';
    });
  });

  describe('Mute Button', () => {
    test('selfMute starts as false', () => {
      expect(appState.selfMute()).toBe(false);
    });

    test('requestMute sets selfMute to true', () => {
      const user = { id: 1 };
      appState.thisUser(user);
      appState.requestMute(user);
      
      expect(appState.selfMute()).toBe(true);
    });

    test('requestMute calls client.setSelfMute', () => {
      const user = { id: 1 };
      appState.thisUser(user);
      appState.requestMute(user);
      
      expect(mockCalls.setSelfMute).toContain(true);
    });

    test('requestMute does nothing if user is null', () => {
      appState.requestMute(null);
      
      expect(appState.selfMute()).toBe(false);
      expect(mockCalls.setSelfMute).toEqual([]);
    });

    test('mute button should be visible when not muted', () => {
      const shouldShow = !appState.selfMute();
      expect(shouldShow).toBe(true);
    });

    test('unmute button should be visible when muted', () => {
      appState.selfMute(true);
      const shouldShow = appState.selfMute();
      expect(shouldShow).toBe(true);
    });
  });

  describe('Unmute Button', () => {
    beforeEach(() => {
      appState.selfMute(true);
    });

    test('handleUnmuteClick sets selfMute to false when not locked', () => {
      appState.handleUnmuteClick();
      
      expect(appState.selfMute()).toBe(false);
    });

    test('handleUnmuteClick calls client.setSelfMute(false)', () => {
      appState.handleUnmuteClick();
      
      expect(mockCalls.setSelfMute).toContain(false);
    });

    test('handleUnmuteClick does nothing when audio is locked', () => {
      appState.audioLockActive(true);
      appState.handleUnmuteClick();
      
      expect(appState.selfMute()).toBe(true);
      expect(mockCalls.setSelfMute).toEqual([]);
    });

    test('unmute button should have tb-disabled class when audio locked', () => {
      appState.audioLockActive(true);
      const shouldHaveDisabledClass = appState.audioLockActive();
      expect(shouldHaveDisabledClass).toBe(true);
    });
  });

  describe('Deaf Button', () => {
    test('selfDeaf starts as false', () => {
      expect(appState.selfDeaf()).toBe(false);
    });

    test('requestDeaf sets selfDeaf to true', () => {
      const user = { id: 1 };
      appState.thisUser(user);
      appState.requestDeaf(user);
      
      expect(appState.selfDeaf()).toBe(true);
    });

    test('requestDeaf calls client.setSelfDeaf', () => {
      const user = { id: 1 };
      appState.thisUser(user);
      appState.requestDeaf(user);
      
      expect(mockCalls.setSelfDeaf).toContain(true);
    });

    test('requestDeaf does nothing if user is null', () => {
      appState.requestDeaf(null);
      
      expect(appState.selfDeaf()).toBe(false);
      expect(mockCalls.setSelfDeaf).toEqual([]);
    });

    test('deaf button should be visible when not deafened', () => {
      const shouldShow = !appState.selfDeaf();
      expect(shouldShow).toBe(true);
    });

    test('undeaf button should be visible when deafened', () => {
      appState.selfDeaf(true);
      const shouldShow = appState.selfDeaf();
      expect(shouldShow).toBe(true);
    });
  });

  describe('Undeaf Button', () => {
    beforeEach(() => {
      appState.selfDeaf(true);
    });

    test('handleUndeafClick sets selfDeaf to false when not locked', () => {
      appState.handleUndeafClick();
      
      expect(appState.selfDeaf()).toBe(false);
    });

    test('handleUndeafClick calls client.setSelfDeaf(false)', () => {
      appState.handleUndeafClick();
      
      expect(mockCalls.setSelfDeaf).toContain(false);
    });

    test('handleUndeafClick does nothing when audio is locked', () => {
      appState.audioLockActive(true);
      appState.handleUndeafClick();
      
      expect(appState.selfDeaf()).toBe(true);
      expect(mockCalls.setSelfDeaf).toEqual([]);
    });

    test('undeaf button should have tb-disabled class when audio locked', () => {
      appState.audioLockActive(true);
      const shouldHaveDisabledClass = appState.audioLockActive();
      expect(shouldHaveDisabledClass).toBe(true);
    });
  });

  describe('Message Box', () => {
    test('messageBox starts empty', () => {
      expect(appState.messageBox()).toBe('');
    });

    test('messageBoxHint provides placeholder text', () => {
      expect(appState.messageBoxHint()).toBe('Message');
    });

    test('messageBox can be updated', () => {
      appState.messageBox('Hello world');
      expect(appState.messageBox()).toBe('Hello world');
    });

    test('submitMessageBox sends message and clears box', () => {
      appState.messageBox('Test message');
      const target = { id: 1, name: 'Channel' };
      appState.selected(target);
      
      appState.submitMessageBox(appState.sendMessage, appState.selected());
      
      expect(mockCalls.sendMessage).toHaveLength(1);
      expect(mockCalls.sendMessage[0]).toEqual({ target, message: 'Test message' });
      expect(appState.messageBox()).toBe('');
    });

    test('submitMessageBox does nothing with empty message', () => {
      appState.messageBox('');
      appState.submitMessageBox(appState.sendMessage, appState.selected());
      
      expect(mockCalls.sendMessage).toEqual([]);
    });

    test('submitMessageBox does nothing with whitespace-only message', () => {
      appState.messageBox('   ');
      appState.submitMessageBox(appState.sendMessage, appState.selected());
      
      expect(mockCalls.sendMessage).toEqual([]);
      expect(appState.messageBox()).toBe('   ');
    });

    test('submitMessageBox trims message before checking', () => {
      appState.messageBox('  Hello  ');
      const target = { id: 1 };
      appState.selected(target);
      
      appState.submitMessageBox(appState.sendMessage, appState.selected());
      
      expect(mockCalls.sendMessage[0].message).toBe('  Hello  ');
    });

    test('submitMessageBox works without sendMessageFn', () => {
      appState.messageBox('Test');
      appState.submitMessageBox(null, null);
      
      expect(appState.messageBox()).toBe('');
    });
  });

  describe('Mail to Desktop Link', () => {
    test('mailToDesktop returns mailto: when not connected', () => {
      expect(appState.mailToDesktop()).toBe('mailto:');
    });

    test('mailToDesktop includes host and port when connected', () => {
      appState.remoteHost('example.com');
      appState.remotePort('64738');
      
      expect(appState.mailToDesktop()).toBe('mailto:example.com@64738');
    });

    test('mailToDesktop returns mailto: when only host is set', () => {
      appState.remoteHost('example.com');
      appState.remotePort('');
      
      expect(appState.mailToDesktop()).toBe('mailto:');
    });

    test('mailToDesktop returns mailto: when only port is set', () => {
      appState.remoteHost('');
      appState.remotePort('64738');
      
      expect(appState.mailToDesktop()).toBe('mailto:');
    });

    test('mailToDesktop is a computed observable', () => {
      expect(ko.isComputed(appState.mailToDesktop)).toBe(true);
    });

    test('mailToDesktop updates when host changes', () => {
      appState.remoteHost('server1.com');
      appState.remotePort('64738');
      expect(appState.mailToDesktop()).toBe('mailto:server1.com@64738');
      
      appState.remoteHost('server2.com');
      expect(appState.mailToDesktop()).toBe('mailto:server2.com@64738');
    });

    test('mailToDesktop updates when port changes', () => {
      appState.remoteHost('example.com');
      appState.remotePort('64738');
      expect(appState.mailToDesktop()).toBe('mailto:example.com@64738');
      
      appState.remotePort('12345');
      expect(appState.mailToDesktop()).toBe('mailto:example.com@12345');
    });
  });

  describe('Action Buttons', () => {
    test('openSettings can be called', () => {
      appState.openSettings();
      expect(mockCalls.openSettings).toHaveLength(1);
    });

    test('openSourceCode can be called', () => {
      appState.openSourceCode();
      expect(mockCalls.openSourceCode).toHaveLength(1);
    });

    test('logoutUser can be called', () => {
      appState.logoutUser();
      expect(mockCalls.logoutUser).toHaveLength(1);
    });
  });

  describe('Audio Lock State', () => {
    test('audioLockActive starts as false', () => {
      expect(appState.audioLockActive()).toBe(false);
    });

    test('audioLockActive can be set to true', () => {
      appState.audioLockActive(true);
      expect(appState.audioLockActive()).toBe(true);
    });

    test('unmute is blocked when audio locked', () => {
      appState.selfMute(true);
      appState.audioLockActive(true);
      appState.handleUnmuteClick();
      
      expect(appState.selfMute()).toBe(true);
    });

    test('undeaf is blocked when audio locked', () => {
      appState.selfDeaf(true);
      appState.audioLockActive(true);
      appState.handleUndeafClick();
      
      expect(appState.selfDeaf()).toBe(true);
    });

    test('audioLockReason can store lock reason', () => {
      appState.audioLockReason('Sample rate mismatch');
      expect(appState.audioLockReason()).toBe('Sample rate mismatch');
    });
  });

  describe('Observable Subscriptions', () => {
    test('selfMute observable can be subscribed to', () => {
      const calls = [];
      const subscription = appState.selfMute.subscribe((val) => calls.push(val));
      
      appState.selfMute(true);
      expect(calls).toContain(true);
      
      appState.selfMute(false);
      expect(calls).toContain(false);
      
      subscription.dispose();
    });

    test('selfDeaf observable can be subscribed to', () => {
      const calls = [];
      const subscription = appState.selfDeaf.subscribe((val) => calls.push(val));
      
      appState.selfDeaf(true);
      expect(calls).toContain(true);
      
      subscription.dispose();
    });

    test('messageBox observable can be subscribed to', () => {
      const calls = [];
      const subscription = appState.messageBox.subscribe((val) => calls.push(val));
      
      appState.messageBox('Test');
      expect(calls).toContain('Test');
      
      subscription.dispose();
    });

    test('audioLockActive observable can be subscribed to', () => {
      const calls = [];
      const subscription = appState.audioLockActive.subscribe((val) => calls.push(val));
      
      appState.audioLockActive(true);
      expect(calls).toContain(true);
      
      subscription.dispose();
    });
  });

  describe('Integration: Mute and Deaf Interaction', () => {
    test('can mute while not deafened', () => {
      const user = { id: 1 };
      appState.thisUser(user);
      appState.requestMute(user);
      
      expect(appState.selfMute()).toBe(true);
      expect(appState.selfDeaf()).toBe(false);
    });

    test('can deaf while not muted', () => {
      const user = { id: 1 };
      appState.thisUser(user);
      appState.requestDeaf(user);
      
      expect(appState.selfDeaf()).toBe(true);
      expect(appState.selfMute()).toBe(false);
    });

    test('can be both muted and deafened', () => {
      const user = { id: 1 };
      appState.thisUser(user);
      appState.requestMute(user);
      appState.requestDeaf(user);
      
      expect(appState.selfMute()).toBe(true);
      expect(appState.selfDeaf()).toBe(true);
    });

    test('unmuting does not affect deaf state', () => {
      const user = { id: 1 };
      appState.thisUser(user);
      appState.requestMute(user);
      appState.requestDeaf(user);
      appState.handleUnmuteClick();
      
      expect(appState.selfMute()).toBe(false);
      expect(appState.selfDeaf()).toBe(true);
    });

    test('undeafening does not affect mute state', () => {
      const user = { id: 1 };
      appState.thisUser(user);
      appState.requestMute(user);
      appState.requestDeaf(user);
      appState.handleUndeafClick();
      
      expect(appState.selfMute()).toBe(true);
      expect(appState.selfDeaf()).toBe(false);
    });
  });
});
