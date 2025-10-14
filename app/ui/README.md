# UI Manager Classes

This directory contains modular manager classes that replaced the monolithic `GlobalBindings` god object.

## Architecture Overview

The UI state management is now divided into focused, single-responsibility classes:

```
GlobalBindings (Coordinator)
    ├── AudioManager         - Audio, voice, beepers, microphone permissions
    ├── ConnectionManager    - Connection lifecycle, client state
    ├── UserChannelManager   - User/channel bindings and event handlers
    ├── UIStateManager       - UI state, dialogs, modals, selection
    └── MessageManager       - Messaging functionality
```

## Manager Classes

### AudioManager

**Responsibilities:**
- AudioContext initialization and management
- Voice handler creation (PTT/Continuous)
- Beeper initialization and control
- Microphone permission handling
- Audio lock state management

**Key Methods:**
- `initializeAudioContext()` - Initialize Web Audio API context
- `createVoiceHandler(client, mode, target)` - Create voice handler based on mode
- `initializePersistentBeeper()` - Set up beeper for audio testing
- `startBeep()` / `stopBeep()` - Control beeper
- `activateAudioLock()` / `clearAudioLock()` - Manage audio lock state
- `attemptMicrophonePermission()` - Request mic permissions

### ConnectionManager

**Responsibilities:**
- WebSocket connection lifecycle
- Client state management  
- Connection to Mumble server
- Audio quality settings

**Key Methods:**
- `performConnect(connectionParams, options)` - Connect to server
- `resetClient()` - Clean up connection
- `isConnected()` - Check connection status
- `setAudioQuality(bitrate, samplesPerPacket)` - Configure audio
- `setSelfMute(mute)` / `setSelfDeaf(deaf)` - Control mute/deaf state

### UserChannelManager

**Responsibilities:**
- User and channel UI binding creation
- Event handler registration
- Voice stream management
- Channel link tracking

**Key Methods:**
- `createUser(user)` - Create UI bindings for a user
- `createChannel(channel)` - Create UI bindings for a channel
- `updateLinks()` - Update channel link status
- `findLinks(channel, knownLinks)` - Find linked channels recursively
- `getAllChannels(channel, channels)` - Get all channels in tree

**Callbacks:**
- `onRequestMute`, `onRequestDeaf`, `onRequestUnmute`, `onRequestUndeaf` - User action callbacks
- `onUpdateLinks` - Channel link update callback

### UIStateManager

**Responsibilities:**
- Modal and dialog management
- UI element selection
- Settings dialog lifecycle

**Key Methods:**
- `select(element)` - Select a UI element
- `openSettings(SettingsDialog, settings)` - Open settings dialog
- `closeSettings()` - Close settings dialog
- `openSourceCode()` - Open repository in new tab

**Properties:**
- `currentOpenModal` - Tracks currently open modal to prevent overlaps
- `selected` - Currently selected element
- `settingsDialog` - Current settings dialog instance

### MessageManager

**Responsibilities:**
- Message composition and sending
- Message box hint computation
- Target selection for messages

**Key Methods:**
- `submitMessageBox()` - Send current message
- `sendMessage(target, message, isConnected)` - Send message to target

**Properties:**
- `messageBox` - Current message text
- `messageBoxHint` - Computed hint based on selection
- `mailToDesktop` - Mail-to link for attachments

## Design Patterns

### Composition over Inheritance

`GlobalBindings` uses composition to delegate to manager classes rather than inheriting from them. This allows:
- Clear separation of concerns
- Easier testing of individual managers
- Better code organization

### Dependency Injection

Managers receive their dependencies through constructors:
- Observables are passed in rather than created internally
- Callback functions are set after construction
- Configuration objects are passed as parameters

### Backward Compatibility

`GlobalBindings` exposes properties from managers directly for backward compatibility with existing Knockout bindings:

```javascript
// Property delegation example
this.isBeeping = this.audioManager.isBeeping;
this.thisUser = this.userChannelManager.thisUser;
this.selected = this.uiStateManager.selected;
```

Method delegation maintains the same API:

```javascript
// Method delegation example
this.startBeep = () => {
  this.audioManager.startBeep(this.connected());
};
```

## Migration Notes

### Before (God Object Pattern)

```javascript
class GlobalBindings {
  constructor(config) {
    // 1785 lines of mixed responsibilities
    this.audioContext = null;
    this.client = null;
    this.thisUser = ko.observable();
    // ... hundreds more properties and methods
  }
}
```

### After (Modular Pattern)

```javascript
class GlobalBindings {
  constructor(config) {
    // Managers handle specific domains
    this.audioManager = new AudioManager(...);
    this.connectionManager = new ConnectionManager(...);
    this.userChannelManager = new UserChannelManager(...);
    this.uiStateManager = new UIStateManager(...);
    this.messageManager = new MessageManager(...);
    
    // Delegate properties for backward compatibility
    this.isBeeping = this.audioManager.isBeeping;
    this.thisUser = this.userChannelManager.thisUser;
  }
}
```

## Benefits

1. **Maintainability**: Each manager has a clear, focused responsibility
2. **Testability**: Managers can be tested in isolation
3. **Readability**: Easier to find relevant code
4. **Scalability**: New features can be added to appropriate managers
5. **Debugging**: Smaller classes are easier to understand and debug

## Future Improvements

Potential enhancements to the architecture:

1. **Event Bus**: Implement a central event bus for manager communication
2. **Interface Definitions**: Add TypeScript interfaces for manager contracts
3. **Unit Tests**: Add comprehensive unit tests for each manager
4. **State Management**: Consider a formal state management pattern (e.g., Redux-like)
5. **Dependency Injection Container**: Use a DI container for manager instantiation
