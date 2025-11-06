/**
 * UIState - Comprehensive Tests
 * 
 * Tests UIState functionality:
 * - Message box state
 * - Modal management (prevent multiple modals)
 * - Settings dialog lifecycle
 * 
 * NOTE: Selection management removed - no UI for selecting channels/users.
 */

import { jest } from '@jest/globals';

const { default: UIState } = await import('../../app/state/UIState.js');

describe('UIState - Constructor & Initialization', () => {
  test('constructor initializes with default values', () => {
    const uiState = new UIState();
    
    expect(uiState.currentOpenModal()).toBeNull();
    expect(uiState.messageBox()).toBe("");
    expect(uiState.settingsDialog()).toBeUndefined();
  });

  test('constructor creates observables', () => {
    const uiState = new UIState();
    
    expect(typeof uiState.currentOpenModal).toBe('function');
    expect(typeof uiState.messageBox).toBe('function');
    expect(typeof uiState.settingsDialog).toBe('function');
  });
});

describe('UIState - Message Box', () => {
  let uiState;

  beforeEach(() => {
    uiState = new UIState();
  });

  test('messageBox starts empty', () => {
    expect(uiState.messageBox()).toBe("");
  });

  test('messageBox can be set', () => {
    uiState.messageBox("Hello World");
    
    expect(uiState.messageBox()).toBe("Hello World");
  });

  test('submitMessageBox sends message and clears box', () => {
    const sendMessage = jest.fn();
    const target = { id: 1, name: 'Target' };
    
    uiState.messageBox("Test message");
    uiState.submitMessageBox(sendMessage, target);
    
    expect(sendMessage).toHaveBeenCalledWith(target, "Test message");
    expect(uiState.messageBox()).toBe("");
  });

  test('submitMessageBox works with empty message', () => {
    const sendMessage = jest.fn();
    const target = { id: 1, name: 'Target' };
    
    uiState.submitMessageBox(sendMessage, target);
    
    expect(sendMessage).toHaveBeenCalledWith(target, "");
    expect(uiState.messageBox()).toBe("");
  });
});

describe('UIState - Settings Dialog', () => {
  let uiState;
  let mockSettings;
  let MockSettingsDialog;

  beforeEach(() => {
    uiState = new UIState();
    mockSettings = { setting1: 'value1' };
    MockSettingsDialog = jest.fn(function(settings) {
      this.settings = settings;
      this.end = jest.fn();
    });
  });

  test('openSettings creates settings dialog', () => {
    uiState.openSettings(mockSettings, MockSettingsDialog);
    
    expect(MockSettingsDialog).toHaveBeenCalledWith(mockSettings);
    expect(uiState.settingsDialog()).toBeDefined();
    expect(uiState.settingsDialog().settings).toBe(mockSettings);
  });

  test('openSettings sets modal state', () => {
    uiState.openSettings(mockSettings, MockSettingsDialog);
    
    expect(uiState.currentOpenModal()).toBe('settings');
  });

  test('openSettings prevents opening when modal already open', () => {
    uiState.currentOpenModal('other-modal');
    
    uiState.openSettings(mockSettings, MockSettingsDialog);
    
    expect(MockSettingsDialog).not.toHaveBeenCalled();
    expect(uiState.settingsDialog()).toBeUndefined();
  });

  test('closeSettings calls end() on dialog', () => {
    uiState.openSettings(mockSettings, MockSettingsDialog);
    const dialog = uiState.settingsDialog();
    
    uiState.closeSettings();
    
    expect(dialog.end).toHaveBeenCalled();
  });

  test('closeSettings clears dialog', () => {
    uiState.openSettings(mockSettings, MockSettingsDialog);
    
    uiState.closeSettings();
    
    expect(uiState.settingsDialog()).toBeNull();
  });

  test('closeSettings clears modal state', () => {
    uiState.openSettings(mockSettings, MockSettingsDialog);
    expect(uiState.currentOpenModal()).toBe('settings');
    
    uiState.closeSettings();
    
    expect(uiState.currentOpenModal()).toBeNull();
  });

  test('closeSettings is safe when no dialog open', () => {
    expect(uiState.settingsDialog()).toBeUndefined();
    
    // Should not throw
    uiState.closeSettings();
    
    expect(uiState.settingsDialog()).toBeNull();
  });

  test('closeSettings does not clear modal if different modal is open', () => {
    uiState.currentOpenModal('other-modal');
    uiState.settingsDialog({ end: jest.fn() });
    
    uiState.closeSettings();
    
    // Modal state should remain (different modal is open)
    expect(uiState.currentOpenModal()).toBe('other-modal');
  });
});

describe('UIState - Modal Management', () => {
  let uiState;

  beforeEach(() => {
    uiState = new UIState();
  });

  test('currentOpenModal starts null', () => {
    expect(uiState.currentOpenModal()).toBeNull();
  });

  test('currentOpenModal can be set', () => {
    uiState.currentOpenModal('test-modal');
    
    expect(uiState.currentOpenModal()).toBe('test-modal');
  });

  test('currentOpenModal prevents multiple modals', () => {
    const MockDialog = jest.fn(function() {
      this.end = jest.fn();
    });
    
    uiState.currentOpenModal('existing-modal');
    
    uiState.openSettings({}, MockDialog);
    
    expect(MockDialog).not.toHaveBeenCalled();
  });
});

describe('UIState - Reset', () => {
  let uiState;

  beforeEach(() => {
    uiState = new UIState();
  });

  test('reset clears all state', () => {
    const MockDialog = jest.fn(function() {
      this.end = jest.fn();
    });
    
    uiState.messageBox("Test message");
    uiState.openSettings({}, MockDialog);
    
    uiState.reset();
    
    expect(uiState.messageBox()).toBe("");
    expect(uiState.settingsDialog()).toBeNull();
    expect(uiState.currentOpenModal()).toBeNull();
  });

  test('reset can be called multiple times safely', () => {
    uiState.reset();
    uiState.reset();
    
    expect(uiState.messageBox()).toBe("");
    expect(uiState.settingsDialog()).toBeNull();
    expect(uiState.currentOpenModal()).toBeNull();
  });
});
