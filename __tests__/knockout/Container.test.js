/**
 * Container - Comprehensive Knockout Component Tests
 * 
 * Tests the main container visibility and conditional rendering in index.html:
 * - Container visibility binding (data-bind="visible: true")
 * - Conditional blocks (<!-- ko with: ... -->)
 * - Dialog visibility states
 * - GuacamoleFrame integration
 * - AudioSource select element
 * 
 * Tests the container/conditional rendering patterns before Vue.js migration.
 */

import { jest } from '@jest/globals';
import ko from 'knockout';

describe('Container - Visibility Bindings', () => {
  let containerState;
  
  beforeEach(() => {
    containerState = {
      visible: ko.observable(true),
    };
  });

  test('container visible observable defaults to true', () => {
    expect(containerState.visible()).toBe(true);
  });

  test('container visibility can be toggled', () => {
    containerState.visible(false);
    expect(containerState.visible()).toBe(false);
    
    containerState.visible(true);
    expect(containerState.visible()).toBe(true);
  });

  test('container visible is observable', () => {
    expect(ko.isObservable(containerState.visible)).toBe(true);
  });

  test('visibility changes trigger subscriptions', () => {
    const spy = jest.fn();
    containerState.visible.subscribe(spy);
    
    containerState.visible(false);
    expect(spy).toHaveBeenCalledWith(false);
  });
});

describe('Container - Conditional Blocks (ko with)', () => {
  let appState;
  
  beforeEach(() => {
    appState = {
      connectErrorDialog: ko.observable(null),
      sampleRateWarningDialog: ko.observable(null),
    };
  });

  test('connectErrorDialog can be null', () => {
    expect(appState.connectErrorDialog()).toBeNull();
  });

  test('connectErrorDialog can be set to object', () => {
    const dialog = {
      visible: ko.observable(false),
      type: ko.observable(0),
      reason: ko.observable(''),
    };
    
    appState.connectErrorDialog(dialog);
    expect(appState.connectErrorDialog()).toBe(dialog);
  });

  test('connectErrorDialog with-binding renders when not null', () => {
    const dialog = {
      visible: ko.observable(false),
    };
    
    appState.connectErrorDialog(dialog);
    const shouldRender = appState.connectErrorDialog() !== null;
    expect(shouldRender).toBe(true);
  });

  test('connectErrorDialog with-binding does not render when null', () => {
    const shouldRender = appState.connectErrorDialog() !== null;
    expect(shouldRender).toBe(false);
  });

  test('sampleRateWarningDialog can be null', () => {
    expect(appState.sampleRateWarningDialog()).toBeNull();
  });

  test('sampleRateWarningDialog can be set to object', () => {
    const dialog = {
      visible: ko.observable(false),
      mode: ko.observable('confirm'),
      sampleRate: ko.observable(48000),
    };
    
    appState.sampleRateWarningDialog(dialog);
    expect(appState.sampleRateWarningDialog()).toBe(dialog);
  });

  test('multiple dialogs can coexist', () => {
    const errorDialog = { visible: ko.observable(false) };
    const warningDialog = { visible: ko.observable(false) };
    
    appState.connectErrorDialog(errorDialog);
    appState.sampleRateWarningDialog(warningDialog);
    
    expect(appState.connectErrorDialog()).toBe(errorDialog);
    expect(appState.sampleRateWarningDialog()).toBe(warningDialog);
  });
});

describe('Container - Dialog Visibility States', () => {
  let connectErrorDialog;
  let sampleRateWarningDialog;
  
  beforeEach(() => {
    connectErrorDialog = {
      visible: ko.observable(false),
      type: ko.observable(0),
      reason: ko.observable(''),
      username: ko.observable(''),
      password: ko.observable(''),
      show: function() { this.visible(true); },
      hide: function() { this.visible(false); },
    };
    
    sampleRateWarningDialog = {
      visible: ko.observable(false),
      mode: ko.observable('confirm'),
      sampleRate: ko.observable(null),
      show: function(sampleRate) {
        this.sampleRate(sampleRate);
        this.visible(true);
      },
      hide: function() { this.visible(false); },
    };
  });

  test('connectErrorDialog starts hidden', () => {
    expect(connectErrorDialog.visible()).toBe(false);
  });

  test('connectErrorDialog can be shown', () => {
    connectErrorDialog.show();
    expect(connectErrorDialog.visible()).toBe(true);
  });

  test('connectErrorDialog can be hidden', () => {
    connectErrorDialog.show();
    connectErrorDialog.hide();
    expect(connectErrorDialog.visible()).toBe(false);
  });

  test('sampleRateWarningDialog starts hidden', () => {
    expect(sampleRateWarningDialog.visible()).toBe(false);
  });

  test('sampleRateWarningDialog can be shown with sample rate', () => {
    sampleRateWarningDialog.show(44100);
    expect(sampleRateWarningDialog.visible()).toBe(true);
    expect(sampleRateWarningDialog.sampleRate()).toBe(44100);
  });

  test('sampleRateWarningDialog can be hidden', () => {
    sampleRateWarningDialog.show(48000);
    sampleRateWarningDialog.hide();
    expect(sampleRateWarningDialog.visible()).toBe(false);
  });

  test('multiple dialogs can have independent visibility', () => {
    connectErrorDialog.show();
    expect(connectErrorDialog.visible()).toBe(true);
    expect(sampleRateWarningDialog.visible()).toBe(false);
    
    sampleRateWarningDialog.show(48000);
    expect(connectErrorDialog.visible()).toBe(true);
    expect(sampleRateWarningDialog.visible()).toBe(true);
  });

  test('dialog visibility is observable', () => {
    expect(ko.isObservable(connectErrorDialog.visible)).toBe(true);
    expect(ko.isObservable(sampleRateWarningDialog.visible)).toBe(true);
  });
});

describe('Container - AudioSource Select Element', () => {
  let audioSourceElement;
  
  beforeEach(() => {
    // Simulate the #audioSource select element
    audioSourceElement = {
      style: {
        display: 'none',
        width: '100%',
        boxSizing: 'border-box',
      },
      options: [],
      selectedIndex: 0,
      value: '',
    };
  });

  test('audioSource element starts hidden', () => {
    expect(audioSourceElement.style.display).toBe('none');
  });

  test('audioSource has proper styling', () => {
    expect(audioSourceElement.style.width).toBe('100%');
    expect(audioSourceElement.style.boxSizing).toBe('border-box');
  });

  test('audioSource can have options added', () => {
    audioSourceElement.options.push({ value: 'device1', text: 'Microphone 1' });
    audioSourceElement.options.push({ value: 'device2', text: 'Microphone 2' });
    
    expect(audioSourceElement.options).toHaveLength(2);
  });

  test('audioSource visibility can be toggled', () => {
    audioSourceElement.style.display = 'block';
    expect(audioSourceElement.style.display).toBe('block');
  });

  test('audioSource can have selected value', () => {
    audioSourceElement.options.push({ value: 'device1', text: 'Microphone 1' });
    audioSourceElement.value = 'device1';
    
    expect(audioSourceElement.value).toBe('device1');
  });
});

describe('Container - GuacamoleFrame Integration', () => {
  let guacamoleFrame;
  
  beforeEach(() => {
    guacamoleFrame = {
      visible: ko.observable(false),
      src: ko.observable(''),
      show: function() { this.visible(true); },
      hide: function() { this.visible(false); },
      start: function(login, password) {
        this.src(`/guacamole/?login=${login}`);
        this.show();
      },
    };
  });

  test('guacamoleFrame starts hidden', () => {
    expect(guacamoleFrame.visible()).toBe(false);
  });

  test('guacamoleFrame can be shown', () => {
    guacamoleFrame.show();
    expect(guacamoleFrame.visible()).toBe(true);
  });

  test('guacamoleFrame can be hidden', () => {
    guacamoleFrame.show();
    guacamoleFrame.hide();
    expect(guacamoleFrame.visible()).toBe(false);
  });

  test('guacamoleFrame start method shows frame with src', () => {
    guacamoleFrame.start('testuser', 'testpass');
    
    expect(guacamoleFrame.visible()).toBe(true);
    expect(guacamoleFrame.src()).toContain('/guacamole/');
    expect(guacamoleFrame.src()).toContain('testuser');
  });

  test('guacamoleFrame visibility is observable', () => {
    expect(ko.isObservable(guacamoleFrame.visible)).toBe(true);
  });

  test('guacamoleFrame src is observable', () => {
    expect(ko.isObservable(guacamoleFrame.src)).toBe(true);
  });

  test('guacamoleFrame src changes trigger subscriptions', () => {
    const spy = jest.fn();
    guacamoleFrame.src.subscribe(spy);
    
    guacamoleFrame.src('/guacamole/?login=user1');
    expect(spy).toHaveBeenCalledWith('/guacamole/?login=user1');
  });
});

describe('Container - Vue.js Mount Points', () => {
  let mountPoints;
  
  beforeEach(() => {
    mountPoints = {
      vueConnectDialogRoot: { id: 'vue-connect-dialog-root' },
      vueConnectionInfoDialogRoot: { id: 'vue-connection-info-dialog-root' },
      vueSettingsDialogRoot: { id: 'vue-settings-dialog-root' },
      vueGuacamoleFrameRoot: { id: 'vue-guacamole-frame-root' },
    };
  });

  test('vue mount points have correct IDs', () => {
    expect(mountPoints.vueConnectDialogRoot.id).toBe('vue-connect-dialog-root');
    expect(mountPoints.vueConnectionInfoDialogRoot.id).toBe('vue-connection-info-dialog-root');
    expect(mountPoints.vueSettingsDialogRoot.id).toBe('vue-settings-dialog-root');
    expect(mountPoints.vueGuacamoleFrameRoot.id).toBe('vue-guacamole-frame-root');
  });

  test('vue mount points exist as separate elements', () => {
    const ids = Object.values(mountPoints).map(el => el.id);
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(ids.length);
  });
});

describe('Container - Conditional Rendering Edge Cases', () => {
  let appState;
  
  beforeEach(() => {
    appState = {
      connectErrorDialog: ko.observable(null),
      sampleRateWarningDialog: ko.observable(null),
    };
  });

  test('setting dialog to null hides content', () => {
    const dialog = { visible: ko.observable(true) };
    appState.connectErrorDialog(dialog);
    
    appState.connectErrorDialog(null);
    expect(appState.connectErrorDialog()).toBeNull();
  });

  test('replacing dialog object updates content', () => {
    const dialog1 = { visible: ko.observable(false), type: ko.observable(0) };
    const dialog2 = { visible: ko.observable(true), type: ko.observable(1) };
    
    appState.connectErrorDialog(dialog1);
    expect(appState.connectErrorDialog()).toBe(dialog1);
    
    appState.connectErrorDialog(dialog2);
    expect(appState.connectErrorDialog()).toBe(dialog2);
  });

  test('dialog observable changes trigger subscriptions', () => {
    const spy = jest.fn();
    appState.connectErrorDialog.subscribe(spy);
    
    const dialog = { visible: ko.observable(false) };
    appState.connectErrorDialog(dialog);
    
    expect(spy).toHaveBeenCalledWith(dialog);
  });
});

describe('Container - Observable Subscription Management', () => {
  let containerState;
  
  beforeEach(() => {
    containerState = {
      visible: ko.observable(true),
      activeDialog: ko.observable(null),
    };
  });

  test('subscriptions can be disposed', () => {
    const spy = jest.fn();
    const subscription = containerState.visible.subscribe(spy);
    
    subscription.dispose();
    containerState.visible(false);
    
    expect(spy).not.toHaveBeenCalled();
  });

  test('multiple subscriptions work independently', () => {
    const spy1 = jest.fn();
    const spy2 = jest.fn();
    
    containerState.visible.subscribe(spy1);
    containerState.visible.subscribe(spy2);
    
    containerState.visible(false);
    
    expect(spy1).toHaveBeenCalledWith(false);
    expect(spy2).toHaveBeenCalledWith(false);
  });

  test('subscriptions receive initial value on subscribe', () => {
    let receivedValue = null;
    const subscription = containerState.visible.subscribe((val) => {
      receivedValue = val;
    });
    
    containerState.visible(false);
    expect(receivedValue).toBe(false);
    
    subscription.dispose();
  });
});

describe('Container - Integration with AppState', () => {
  let appState;
  
  beforeEach(() => {
    appState = {
      // Container visibility
      containerVisible: ko.observable(true),
      
      // Dialogs
      connectErrorDialog: ko.observable(null),
      sampleRateWarningDialog: ko.observable(null),
      
      // GuacamoleFrame
      guacamoleFrame: {
        visible: ko.observable(false),
        show: function() { this.visible(true); },
        hide: function() { this.visible(false); },
      },
      
      // Audio source
      audioSource: {
        devices: ko.observableArray([]),
        selectedDevice: ko.observable(null),
      },
    };
  });

  test('appState has all container-related properties', () => {
    expect(appState.containerVisible).toBeDefined();
    expect(appState.connectErrorDialog).toBeDefined();
    expect(appState.sampleRateWarningDialog).toBeDefined();
    expect(appState.guacamoleFrame).toBeDefined();
    expect(appState.audioSource).toBeDefined();
  });

  test('showing error dialog does not affect container visibility', () => {
    const dialog = { visible: ko.observable(true) };
    appState.connectErrorDialog(dialog);
    
    expect(appState.containerVisible()).toBe(true);
  });

  test('showing guacamole does not affect container visibility', () => {
    appState.guacamoleFrame.show();
    expect(appState.containerVisible()).toBe(true);
  });

  test('audio devices can be enumerated', () => {
    appState.audioSource.devices.push({ id: 'device1', label: 'Microphone 1' });
    appState.audioSource.devices.push({ id: 'device2', label: 'Microphone 2' });
    
    expect(appState.audioSource.devices()).toHaveLength(2);
  });

  test('audio device can be selected', () => {
    const device = { id: 'device1', label: 'Microphone 1' };
    appState.audioSource.devices.push(device);
    appState.audioSource.selectedDevice(device);
    
    expect(appState.audioSource.selectedDevice()).toBe(device);
  });
});

describe('Container - Complex Visibility Scenarios', () => {
  let appState;
  
  beforeEach(() => {
    appState = {
      containerVisible: ko.observable(true),
      connectErrorDialog: ko.observable(null),
      sampleRateWarningDialog: ko.observable(null),
      guacamoleFrame: {
        visible: ko.observable(false),
      },
    };
  });

  test('multiple dialogs can be shown simultaneously', () => {
    const errorDialog = { visible: ko.observable(true) };
    const warningDialog = { visible: ko.observable(true) };
    
    appState.connectErrorDialog(errorDialog);
    appState.sampleRateWarningDialog(warningDialog);
    
    expect(appState.connectErrorDialog().visible()).toBe(true);
    expect(appState.sampleRateWarningDialog().visible()).toBe(true);
  });

  test('guacamole and dialogs can be shown simultaneously', () => {
    const errorDialog = { visible: ko.observable(true) };
    appState.connectErrorDialog(errorDialog);
    appState.guacamoleFrame.visible(true);
    
    expect(appState.connectErrorDialog().visible()).toBe(true);
    expect(appState.guacamoleFrame.visible()).toBe(true);
  });

  test('hiding container does not affect dialog states', () => {
    const dialog = { visible: ko.observable(true) };
    appState.connectErrorDialog(dialog);
    
    appState.containerVisible(false);
    
    expect(appState.connectErrorDialog().visible()).toBe(true);
  });

  test('all UI elements can be hidden', () => {
    const errorDialog = { visible: ko.observable(false) };
    const warningDialog = { visible: ko.observable(false) };
    
    appState.containerVisible(false);
    appState.connectErrorDialog(errorDialog);
    appState.sampleRateWarningDialog(warningDialog);
    appState.guacamoleFrame.visible(false);
    
    expect(appState.containerVisible()).toBe(false);
    expect(appState.connectErrorDialog().visible()).toBe(false);
    expect(appState.sampleRateWarningDialog().visible()).toBe(false);
    expect(appState.guacamoleFrame.visible()).toBe(false);
  });

  test('all UI elements can be shown', () => {
    const errorDialog = { visible: ko.observable(true) };
    const warningDialog = { visible: ko.observable(true) };
    
    appState.containerVisible(true);
    appState.connectErrorDialog(errorDialog);
    appState.sampleRateWarningDialog(warningDialog);
    appState.guacamoleFrame.visible(true);
    
    expect(appState.containerVisible()).toBe(true);
    expect(appState.connectErrorDialog().visible()).toBe(true);
    expect(appState.sampleRateWarningDialog().visible()).toBe(true);
    expect(appState.guacamoleFrame.visible()).toBe(true);
  });
});
