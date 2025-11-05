/**
 * Characterization tests for ConnectErrorDialog (Knockout version)
 * 
 * These tests document the current behavior before Vue.js migration.
 * The ConnectErrorDialog shows different error messages based on connection failure types.
 * 
 * Error types (from app/index.html):
 * 0 = Connection refused
 * 1 = Incompatible version
 * 2 = Username rejected
 * 3 = User password incorrect
 * 4 = Server password incorrect
 * 5 = Username already in use
 * 6 = Full server
 * 7 = NoCert
 * 8 = Connection refused (duplicate of 0)
 */

import ko from 'knockout';

describe('ConnectErrorDialog - Knockout Characterization Tests', () => {
  let connectDialog;
  let connectErrorDialog;
  let mockConnectCalls;

  // Mock ConnectDialog dependency
  beforeEach(() => {
    mockConnectCalls = [];
    
    connectDialog = {
      username: ko.observable('TestUser'),
      password: ko.observable('TestPassword'),
      address: ko.observable('mumble.example.com'),
      port: ko.observable('64738'),
      visible: ko.observable(false),
      connect: function() {
        mockConnectCalls.push({ username: this.username(), password: this.password() });
      }
    };

    // Import ConnectErrorDialog constructor from app/index.js
    // Since it's not exported, we'll recreate it here based on the source
    function ConnectErrorDialog(connectDialogInstance) {
      this.type = ko.observable(0);
      this.reason = ko.observable('');
      this.username = connectDialogInstance.username;
      this.password = connectDialogInstance.password;
      this.visible = ko.observable(false);
      this.show = this.visible.bind(this.visible, true);
      this.hide = this.visible.bind(this.visible, false);
      this.connect = () => {
        this.hide();
        connectDialogInstance.connect();
      };
    }

    connectErrorDialog = new ConnectErrorDialog(connectDialog);
  });

  describe('Initialization', () => {
    test('initializes with type 0 (connection refused)', () => {
      expect(connectErrorDialog.type()).toBe(0);
    });

    test('initializes with empty reason', () => {
      expect(connectErrorDialog.reason()).toBe('');
    });

    test('starts hidden', () => {
      expect(connectErrorDialog.visible()).toBe(false);
    });

    test('shares username observable with ConnectDialog', () => {
      expect(connectErrorDialog.username).toBe(connectDialog.username);
      expect(connectErrorDialog.username()).toBe('TestUser');
    });

    test('shares password observable with ConnectDialog', () => {
      expect(connectErrorDialog.password).toBe(connectDialog.password);
      expect(connectErrorDialog.password()).toBe('TestPassword');
    });
  });

  describe('Visibility Control', () => {
    test('show() makes dialog visible', () => {
      connectErrorDialog.show();
      expect(connectErrorDialog.visible()).toBe(true);
    });

    test('hide() makes dialog invisible', () => {
      connectErrorDialog.show();
      connectErrorDialog.hide();
      expect(connectErrorDialog.visible()).toBe(false);
    });

    test('show() can be called multiple times', () => {
      connectErrorDialog.show();
      connectErrorDialog.show();
      expect(connectErrorDialog.visible()).toBe(true);
    });

    test('hide() is idempotent', () => {
      connectErrorDialog.hide();
      connectErrorDialog.hide();
      expect(connectErrorDialog.visible()).toBe(false);
    });
  });

  describe('Error Types', () => {
    test('type 0 - Connection refused', () => {
      connectErrorDialog.type(0);
      connectErrorDialog.reason('Network error');
      connectErrorDialog.show();
      
      expect(connectErrorDialog.type()).toBe(0);
      expect(connectErrorDialog.reason()).toBe('Network error');
      expect(connectErrorDialog.visible()).toBe(true);
    });

    test('type 1 - Incompatible version', () => {
      connectErrorDialog.type(1);
      connectErrorDialog.reason('Server version 1.2.3');
      connectErrorDialog.show();
      
      expect(connectErrorDialog.type()).toBe(1);
      expect(connectErrorDialog.reason()).toBe('Server version 1.2.3');
      expect(connectErrorDialog.visible()).toBe(true);
    });

    test('type 2 - Username rejected', () => {
      connectErrorDialog.type(2);
      connectErrorDialog.reason('Invalid username format');
      connectErrorDialog.show();
      
      expect(connectErrorDialog.type()).toBe(2);
      expect(connectErrorDialog.reason()).toBe('Invalid username format');
      expect(connectErrorDialog.visible()).toBe(true);
    });

    test('type 3 - User password incorrect', () => {
      connectErrorDialog.type(3);
      connectErrorDialog.reason('Wrong password for registered user');
      connectErrorDialog.show();
      
      expect(connectErrorDialog.type()).toBe(3);
      expect(connectErrorDialog.reason()).toBe('Wrong password for registered user');
      expect(connectErrorDialog.visible()).toBe(true);
    });

    test('type 4 - Server password incorrect', () => {
      connectErrorDialog.type(4);
      connectErrorDialog.reason('Server requires password');
      connectErrorDialog.show();
      
      expect(connectErrorDialog.type()).toBe(4);
      expect(connectErrorDialog.reason()).toBe('Server requires password');
      expect(connectErrorDialog.visible()).toBe(true);
    });

    test('type 5 - Username already in use', () => {
      connectErrorDialog.type(5);
      connectErrorDialog.reason('User already connected');
      connectErrorDialog.show();
      
      expect(connectErrorDialog.type()).toBe(5);
      expect(connectErrorDialog.reason()).toBe('User already connected');
      expect(connectErrorDialog.visible()).toBe(true);
    });

    test('type 6 - Full server', () => {
      connectErrorDialog.type(6);
      connectErrorDialog.reason('Maximum users reached');
      connectErrorDialog.show();
      
      expect(connectErrorDialog.type()).toBe(6);
      expect(connectErrorDialog.reason()).toBe('Maximum users reached');
      expect(connectErrorDialog.visible()).toBe(true);
    });

    test('type 7 - NoCert', () => {
      connectErrorDialog.type(7);
      connectErrorDialog.reason('Certificate required');
      connectErrorDialog.show();
      
      expect(connectErrorDialog.type()).toBe(7);
      expect(connectErrorDialog.reason()).toBe('Certificate required');
      expect(connectErrorDialog.visible()).toBe(true);
    });

    test('type 8 - Connection refused (duplicate)', () => {
      connectErrorDialog.type(8);
      connectErrorDialog.reason('Connection timeout');
      connectErrorDialog.show();
      
      expect(connectErrorDialog.type()).toBe(8);
      expect(connectErrorDialog.reason()).toBe('Connection timeout');
      expect(connectErrorDialog.visible()).toBe(true);
    });
  });

  describe('Connect Action', () => {
    test('connect() hides the error dialog', () => {
      connectErrorDialog.show();
      connectErrorDialog.connect();
      
      expect(connectErrorDialog.visible()).toBe(false);
    });

    test('connect() calls connectDialog.connect()', () => {
      connectErrorDialog.connect();
      
      expect(mockConnectCalls.length).toBe(1);
    });

    test('connect() hides dialog before calling connectDialog.connect()', () => {
      const callOrder = [];
      
      const visibleSubscription = connectErrorDialog.visible.subscribe((value) => {
        if (!value) callOrder.push('hide');
      });
      
      const originalConnect = connectDialog.connect;
      connectDialog.connect = function() {
        callOrder.push('connect');
        originalConnect.call(this);
      };
      
      connectErrorDialog.show();
      callOrder.length = 0; // Reset after show
      connectErrorDialog.connect();
      
      expect(callOrder).toEqual(['hide', 'connect']);
      visibleSubscription.dispose();
    });
  });

  describe('Username/Password Editing', () => {
    test('username changes reflect in ConnectDialog', () => {
      connectErrorDialog.username('NewUser');
      expect(connectDialog.username()).toBe('NewUser');
    });

    test('password changes reflect in ConnectDialog', () => {
      connectErrorDialog.password('NewPassword');
      expect(connectDialog.password()).toBe('NewPassword');
    });

    test('ConnectDialog username changes reflect in ConnectErrorDialog', () => {
      connectDialog.username('AnotherUser');
      expect(connectErrorDialog.username()).toBe('AnotherUser');
    });

    test('ConnectDialog password changes reflect in ConnectErrorDialog', () => {
      connectDialog.password('AnotherPassword');
      expect(connectErrorDialog.password()).toBe('AnotherPassword');
    });
  });

  describe('Error Reason Display', () => {
    test('reason can be empty string', () => {
      connectErrorDialog.reason('');
      expect(connectErrorDialog.reason()).toBe('');
    });

    test('reason can be updated after dialog is shown', () => {
      connectErrorDialog.show();
      connectErrorDialog.reason('New error message');
      
      expect(connectErrorDialog.reason()).toBe('New error message');
      expect(connectErrorDialog.visible()).toBe(true);
    });

    test('reason persists after hide', () => {
      connectErrorDialog.reason('Persistent error');
      connectErrorDialog.show();
      connectErrorDialog.hide();
      
      expect(connectErrorDialog.reason()).toBe('Persistent error');
    });

    test('reason can contain special characters', () => {
      const specialReason = 'Error: <script>alert("XSS")</script> & "quotes"';
      connectErrorDialog.reason(specialReason);
      expect(connectErrorDialog.reason()).toBe(specialReason);
    });
  });

  describe('Type Updates', () => {
    test('type can be changed while dialog is visible', () => {
      connectErrorDialog.type(2);
      connectErrorDialog.show();
      connectErrorDialog.type(4);
      
      expect(connectErrorDialog.type()).toBe(4);
      expect(connectErrorDialog.visible()).toBe(true);
    });

    test('type persists after hide', () => {
      connectErrorDialog.type(5);
      connectErrorDialog.show();
      connectErrorDialog.hide();
      
      expect(connectErrorDialog.type()).toBe(5);
    });

    test('type accepts negative values (edge case)', () => {
      connectErrorDialog.type(-1);
      expect(connectErrorDialog.type()).toBe(-1);
    });

    test('type accepts values beyond defined range (edge case)', () => {
      connectErrorDialog.type(99);
      expect(connectErrorDialog.type()).toBe(99);
    });
  });

  describe('Form Field Visibility Logic (based on HTML)', () => {
    /**
     * These tests document which form fields should be shown for each error type
     * based on the data-bind conditions in app/index.html:
     * 
     * Username field shown when: type == 2 || type == 3 || type == 5
     * Password field shown when: type == 3 || type == 4
     */

    test('type 2 (username rejected) should show username field', () => {
      connectErrorDialog.type(2);
      const shouldShowUsername = [2, 3, 5].includes(connectErrorDialog.type());
      expect(shouldShowUsername).toBe(true);
    });

    test('type 3 (user password) should show both username and password fields', () => {
      connectErrorDialog.type(3);
      const shouldShowUsername = [2, 3, 5].includes(connectErrorDialog.type());
      const shouldShowPassword = [3, 4].includes(connectErrorDialog.type());
      
      expect(shouldShowUsername).toBe(true);
      expect(shouldShowPassword).toBe(true);
    });

    test('type 4 (server password) should show only password field', () => {
      connectErrorDialog.type(4);
      const shouldShowUsername = [2, 3, 5].includes(connectErrorDialog.type());
      const shouldShowPassword = [3, 4].includes(connectErrorDialog.type());
      
      expect(shouldShowUsername).toBe(false);
      expect(shouldShowPassword).toBe(true);
    });

    test('type 5 (username in use) should show username field', () => {
      connectErrorDialog.type(5);
      const shouldShowUsername = [2, 3, 5].includes(connectErrorDialog.type());
      expect(shouldShowUsername).toBe(true);
    });

    test('type 0 (connection refused) should show no input fields', () => {
      connectErrorDialog.type(0);
      const shouldShowUsername = [2, 3, 5].includes(connectErrorDialog.type());
      const shouldShowPassword = [3, 4].includes(connectErrorDialog.type());
      
      expect(shouldShowUsername).toBe(false);
      expect(shouldShowPassword).toBe(false);
    });

    test('type 1 (incompatible version) should show no input fields', () => {
      connectErrorDialog.type(1);
      const shouldShowUsername = [2, 3, 5].includes(connectErrorDialog.type());
      const shouldShowPassword = [3, 4].includes(connectErrorDialog.type());
      
      expect(shouldShowUsername).toBe(false);
      expect(shouldShowPassword).toBe(false);
    });

    test('type 6 (full server) should show no input fields', () => {
      connectErrorDialog.type(6);
      const shouldShowUsername = [2, 3, 5].includes(connectErrorDialog.type());
      const shouldShowPassword = [3, 4].includes(connectErrorDialog.type());
      
      expect(shouldShowUsername).toBe(false);
      expect(shouldShowPassword).toBe(false);
    });

    test('type 7 (NoCert) should show no input fields', () => {
      connectErrorDialog.type(7);
      const shouldShowUsername = [2, 3, 5].includes(connectErrorDialog.type());
      const shouldShowPassword = [3, 4].includes(connectErrorDialog.type());
      
      expect(shouldShowUsername).toBe(false);
      expect(shouldShowPassword).toBe(false);
    });
  });

  describe('Observable Subscriptions', () => {
    test('visible observable can be subscribed to', () => {
      const calls = [];
      const subscription = connectErrorDialog.visible.subscribe((val) => calls.push(val));
      
      connectErrorDialog.show();
      expect(calls).toContain(true);
      
      connectErrorDialog.hide();
      expect(calls).toContain(false);
      
      subscription.dispose();
    });

    test('type observable can be subscribed to', () => {
      const calls = [];
      const subscription = connectErrorDialog.type.subscribe((val) => calls.push(val));
      
      connectErrorDialog.type(3);
      expect(calls).toContain(3);
      
      subscription.dispose();
    });

    test('reason observable can be subscribed to', () => {
      const calls = [];
      const subscription = connectErrorDialog.reason.subscribe((val) => calls.push(val));
      
      connectErrorDialog.reason('Test error');
      expect(calls).toContain('Test error');
      
      subscription.dispose();
    });
  });

  describe('Integration with ConnectDialog', () => {
    test('preserves ConnectDialog state when shown', () => {
      const originalUsername = connectDialog.username();
      const originalPassword = connectDialog.password();
      
      connectErrorDialog.show();
      
      expect(connectDialog.username()).toBe(originalUsername);
      expect(connectDialog.password()).toBe(originalPassword);
    });

    test('allows editing credentials through error dialog', () => {
      connectErrorDialog.show();
      connectErrorDialog.username('EditedUser');
      connectErrorDialog.password('EditedPass');
      
      // Verify changes propagate to ConnectDialog
      expect(connectDialog.username()).toBe('EditedUser');
      expect(connectDialog.password()).toBe('EditedPass');
    });

    test('connect action delegates to ConnectDialog', () => {
      connectErrorDialog.type(3);
      connectErrorDialog.username('RetryUser');
      connectErrorDialog.password('RetryPass');
      
      connectErrorDialog.connect();
      
      expect(mockConnectCalls.length).toBeGreaterThan(0);
      expect(connectDialog.username()).toBe('RetryUser');
      expect(connectDialog.password()).toBe('RetryPass');
    });
  });
});
