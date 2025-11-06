/**
 * MessageBox - Comprehensive Knockout Component Tests
 * 
 * Tests the message box/chat UI bindings in index.html:
 * - Message box observable binding
 * - Form submission handling
 * - Placeholder text computation (channel vs user)
 * - Message target selection
 * - Message clearing after submission
 * 
 * Tests the chat input component before Vue.js migration.
 */

import { jest } from '@jest/globals';
import ko from 'knockout';

describe('MessageBox - Initialization', () => {
  let uiState;
  
  beforeEach(() => {
    uiState = {
      messageBox: ko.observable(""),
      selected: ko.observable(null),
    };
  });

  test('messageBox observable initializes empty', () => {
    expect(uiState.messageBox()).toBe("");
  });

  test('messageBox is observable', () => {
    expect(ko.isObservable(uiState.messageBox)).toBe(true);
  });

  // REMOVED: selected target tests - no selection UI exists
});

describe('MessageBox - Text Input', () => {
  let uiState;
  
  beforeEach(() => {
    uiState = {
      messageBox: ko.observable(""),
    };
  });

  test('messageBox can be updated', () => {
    uiState.messageBox("Hello World");
    expect(uiState.messageBox()).toBe("Hello World");
  });

  test('messageBox handles empty string', () => {
    uiState.messageBox("Test");
    uiState.messageBox("");
    expect(uiState.messageBox()).toBe("");
  });

  test('messageBox handles multiline text', () => {
    const multiline = "Line 1\nLine 2\nLine 3";
    uiState.messageBox(multiline);
    expect(uiState.messageBox()).toBe(multiline);
  });

  test('messageBox handles special characters', () => {
    const special = "Test @#$% & <html> 你好";
    uiState.messageBox(special);
    expect(uiState.messageBox()).toBe(special);
  });

  test('messageBox observable triggers subscriptions', () => {
    const spy = jest.fn();
    uiState.messageBox.subscribe(spy);
    
    uiState.messageBox("Test message");
    expect(spy).toHaveBeenCalledWith("Test message");
  });
});

describe('MessageBox - Placeholder Text Computation', () => {
  let appState;
  let thisUser;
  let targetChannel;
  let targetUser;
  
  beforeEach(() => {
    targetChannel = {
      name: ko.observable("General"),
      users: ko.observableArray([]), // Indicates it's a channel
    };
    
    targetUser = {
      name: ko.observable("Alice"),
      channel: ko.observable(targetChannel),
      // No 'users' property - indicates it's a user
    };
    
    thisUser = {
      name: ko.observable("Bob"),
      channel: ko.observable(targetChannel),
    };
    
    appState = {
      user: {
        thisUser: ko.observable(thisUser),
      },
    };
    
    // Simulate messageBoxHint computed observable (always uses current channel)
    appState.messageBoxHint = ko.pureComputed(() => {
      if (!appState.user.thisUser()) {
        return "";
      }
      const target = appState.user.thisUser().channel();
      return `Send message to channel: ${target.name()}`;
    });
  });

  test('placeholder is empty when not connected', () => {
    appState.user.thisUser(null);
    expect(appState.messageBoxHint()).toBe("");
  });

  test('placeholder shows current channel', () => {
    expect(appState.messageBoxHint()).toBe("Send message to channel: General");
  });

  test('placeholder updates when channel name changes', () => {
    expect(appState.messageBoxHint()).toBe("Send message to channel: General");
    
    targetChannel.name("Updated Channel");
    expect(appState.messageBoxHint()).toBe("Send message to channel: Updated Channel");
  });

  // REMOVED: Tests for selected channel/user - no selection UI exists
});

describe('MessageBox - Form Submission', () => {
  let uiState;
  let sendMessageFn;
  
  beforeEach(() => {
    sendMessageFn = jest.fn();
    
    uiState = {
      messageBox: ko.observable(""),
      selected: ko.observable(null),
      submitMessageBox: function(sendFn, target) {
        sendFn(target, this.messageBox());
        this.messageBox("");
      },
    };
  });

  test('submitMessageBox sends message to target', () => {
    const target = { name: ko.observable("General") };
    uiState.messageBox("Hello World");
    
    uiState.submitMessageBox(sendMessageFn, target);
    
    expect(sendMessageFn).toHaveBeenCalledWith(target, "Hello World");
  });

  test('submitMessageBox clears message box after sending', () => {
    const target = { name: ko.observable("General") };
    uiState.messageBox("Test message");
    
    uiState.submitMessageBox(sendMessageFn, target);
    
    expect(uiState.messageBox()).toBe("");
  });

  test('submitMessageBox handles empty message', () => {
    const target = { name: ko.observable("General") };
    uiState.messageBox("");
    
    uiState.submitMessageBox(sendMessageFn, target);
    
    expect(sendMessageFn).toHaveBeenCalledWith(target, "");
  });

  test('submitMessageBox handles null target', () => {
    uiState.messageBox("Test message");
    
    uiState.submitMessageBox(sendMessageFn, null);
    
    expect(sendMessageFn).toHaveBeenCalledWith(null, "Test message");
    expect(uiState.messageBox()).toBe("");
  });

  test('form submission clears input', () => {
    const target = { name: ko.observable("General") };
    uiState.messageBox("First message");
    uiState.submitMessageBox(sendMessageFn, target);
    expect(uiState.messageBox()).toBe("");
    
    uiState.messageBox("Second message");
    uiState.submitMessageBox(sendMessageFn, target);
    expect(uiState.messageBox()).toBe("");
  });
});

// REMOVED: Target Selection tests - no UI for selecting channels/users
// describe('MessageBox - Target Selection', () => { ... });
// Reason: All messages go to current channel, no selection UI exists

describe('MessageBox - Integration with AppState', () => {
  let appState;
  let thisUser;
  let channel;
  
  beforeEach(() => {
    channel = {
      name: ko.observable("General"),
      users: ko.observableArray([]),
    };
    
    thisUser = {
      name: ko.observable("Bob"),
      channel: ko.observable(channel),
    };
    
    appState = {
      user: {
        thisUser: ko.observable(thisUser),
      },
      ui: {
        messageBox: ko.observable(""),
      },
      sendMessage: jest.fn(),
      submitMessageBox: function() {
        const target = this.user.thisUser().channel();
        this.sendMessage(target, this.ui.messageBox());
        this.ui.messageBox("");
      },
    };
  });

  // REMOVED: Test for selected target - no selection UI exists

  test('submitMessageBox sends to current channel', () => {
    appState.ui.messageBox("Hello channel");
    
    appState.submitMessageBox();
    
    expect(appState.sendMessage).toHaveBeenCalledWith(channel, "Hello channel");
    expect(appState.ui.messageBox()).toBe("");
  });

  test('multiple messages can be sent in sequence', () => {
    appState.ui.messageBox("Message 1");
    appState.submitMessageBox();
    
    appState.ui.messageBox("Message 2");
    appState.submitMessageBox();
    
    expect(appState.sendMessage).toHaveBeenCalledTimes(2);
    expect(appState.sendMessage).toHaveBeenNthCalledWith(1, channel, "Message 1");
    expect(appState.sendMessage).toHaveBeenNthCalledWith(2, channel, "Message 2");
  });

  // REMOVED: Test for changing target between messages - no selection UI exists
});

describe('MessageBox - Edge Cases', () => {
  let uiState;
  let sendMessageFn;
  
  beforeEach(() => {
    sendMessageFn = jest.fn();
    
    uiState = {
      messageBox: ko.observable(""),
      selected: ko.observable(null),
      submitMessageBox: function(sendFn, target) {
        sendFn(target, this.messageBox());
        this.messageBox("");
      },
    };
  });

  test('handles very long messages', () => {
    const longMessage = "A".repeat(10000);
    const target = { name: ko.observable("General") };
    
    uiState.messageBox(longMessage);
    uiState.submitMessageBox(sendMessageFn, target);
    
    expect(sendMessageFn).toHaveBeenCalledWith(target, longMessage);
  });

  test('handles rapid message submission', () => {
    const target = { name: ko.observable("General") };
    
    for (let i = 0; i < 100; i++) {
      uiState.messageBox(`Message ${i}`);
      uiState.submitMessageBox(sendMessageFn, target);
    }
    
    expect(sendMessageFn).toHaveBeenCalledTimes(100);
    expect(uiState.messageBox()).toBe("");
  });

  test('handles whitespace-only messages', () => {
    const target = { name: ko.observable("General") };
    
    uiState.messageBox("   \n\t  ");
    uiState.submitMessageBox(sendMessageFn, target);
    
    expect(sendMessageFn).toHaveBeenCalledWith(target, "   \n\t  ");
  });

  // REMOVED: Test for messageBox state persisting across target changes - no selection UI exists
});

describe('MessageBox - Observable Subscriptions', () => {
  let uiState;
  
  beforeEach(() => {
    uiState = {
      messageBox: ko.observable(""),
    };
  });

  test('messageBox subscriptions receive updates', () => {
    const spy = jest.fn();
    uiState.messageBox.subscribe(spy);
    
    uiState.messageBox("Test");
    expect(spy).toHaveBeenCalledWith("Test");
    
    uiState.messageBox("Updated");
    expect(spy).toHaveBeenCalledWith("Updated");
  });

  // REMOVED: selected subscriptions test - no selection UI exists

  test('subscriptions can be disposed', () => {
    const spy = jest.fn();
    const subscription = uiState.messageBox.subscribe(spy);
    
    subscription.dispose();
    uiState.messageBox("Test");
    
    expect(spy).not.toHaveBeenCalled();
  });

  test('multiple subscriptions work independently', () => {
    const spy1 = jest.fn();
    const spy2 = jest.fn();
    
    uiState.messageBox.subscribe(spy1);
    uiState.messageBox.subscribe(spy2);
    
    uiState.messageBox("Test");
    
    expect(spy1).toHaveBeenCalledWith("Test");
    expect(spy2).toHaveBeenCalledWith("Test");
  });
});

describe('MessageBox - Reset Functionality', () => {
  let uiState;
  
  beforeEach(() => {
    uiState = {
      messageBox: ko.observable(""),
      reset: function() {
        this.messageBox("");
      },
    };
  });

  test('reset clears messageBox', () => {
    uiState.messageBox("Test message");
    uiState.reset();
    expect(uiState.messageBox()).toBe("");
  });

  // REMOVED: Test for reset clearing selection - no selection UI exists

  test('reset can be called multiple times', () => {
    uiState.messageBox("Test");
    uiState.reset();
    expect(uiState.messageBox()).toBe("");
    
    uiState.messageBox("Another test");
    uiState.reset();
    expect(uiState.messageBox()).toBe("");
  });

  test('reset works when already empty', () => {
    uiState.reset();
    expect(uiState.messageBox()).toBe("");
  });
});
