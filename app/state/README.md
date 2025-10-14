# State Management Architecture

## Overview

The state management has been refactored from a monolithic 1785-line `GlobalBindings` god object into a modular architecture with clear separation of concerns. This improves maintainability, testability, and makes the codebase easier to understand.

## Architecture

### Module Hierarchy

```
AppState (coordinator)
├── ConnectionState   - Server connection management
├── AudioState        - Audio context, locks, beeper
├── VoiceState        - Voice handler, loopback mode
├── UIState           - UI state, modals
├── UserState         - User management, mute/deaf
└── ChannelState      - Channel tree, links
```

### Module Responsibilities

#### AppState (`app/state/AppState.js`)
**Main coordinator** that composes all state modules and provides a unified API.

- Composes all sub-modules
- Delegates operations to appropriate modules
- Provides backward-compatible API
- Manages cross-module interactions
- Exposes module properties via getters

**Usage:**
```javascript
import AppState from './state/AppState';
const appState = new AppState(config, log);
```

#### ConnectionState (`app/state/ConnectionState.js`)
Manages Mumble server connection lifecycle.

**Responsibilities:**
- WebSocket connection via `WorkerBasedMumbleConnector`
- Remote host/port tracking
- Client instance lifecycle
- Audio quality settings
- Server-side mute/deaf state

**Key Methods:**
- `connect(host, port, username, password, tokens)` - Connect to server
- `resetClient()` - Disconnect and reset
- `setAudioQuality(bitrate, samples)` - Set audio parameters
- `setSelfMute(muted)` / `setSelfDeaf(deafened)` - Server state

**Properties:**
- `client` - Current MumbleClient instance
- `remoteHost` / `remotePort` - Observable connection params
- `connector` - WorkerBasedMumbleConnector instance

#### AudioState (`app/state/AudioState.js`)
Manages audio context, permissions, and beeper functionality.

**Responsibilities:**
- AudioContext lifecycle (singleton pattern)
- Audio lock state (sample rate warnings)
- Microphone permission handling
- Beeper/tone generator for latency testing
- Autoplay policy handling

**Key Methods:**
- `initializeAudioContext()` - Create/resume AudioContext
- `resumeAudioContext()` - Resume if suspended
- `activateAudioLock(reason, details)` - Disable audio features
- `clearAudioLock(options)` - Re-enable audio
- `attemptMicrophonePermission()` - Request mic access
- `initializePersistentBeeper()` - Create beeper oscillator
- `startBeep()` / `stopBeep()` - Control beeper

**Properties:**
- `audioContext` - Web Audio API AudioContext
- `audioLockActive` - Observable lock state
- `micPermissionDenied` - Observable permission state
- `isBeeping` - Observable beeping state
- `beeperReady` - Observable beeper initialization

#### VoiceState (`app/state/VoiceState.js`)
Manages voice handler and loopback testing.

**Responsibilities:**
- Voice handler lifecycle (PTT/continuous)
- Loopback test mode management
- Voice handler ready state tracking
- Voice data routing (normal vs loopback target)

**Key Methods:**
- `initVoiceInput(onData, onError)` - Initialize voice capture
- `updateVoiceHandler(client, settings, callbacks)` - Create/update handler
- `setMute(muted)` - Control mute state
- `writeVoiceData(data)` - Send voice data
- `endVoiceHandler()` - Cleanup handler
- `reset()` - Reset all voice state

**Properties:**
- `voiceHandler` - Current voice handler instance
- `isLoopbackMode` - Observable loopback test mode
- `voiceHandlerReady` - Observable ready state

#### UIState (`app/state/UIState.js`)
Manages UI-specific state and modal management.

**Responsibilities:**
- Selected channel/user tracking
- Message box state
- Modal management (prevent multiple modals)
- Settings dialog state

**Key Methods:**
- `select(element)` - Select channel/user
- `openSettings(settings, DialogClass)` - Open settings
- `closeSettings()` - Close settings
- `submitMessageBox(sendFn, target)` - Send message
- `reset()` - Reset UI state

**Properties:**
- `currentOpenModal` - Observable modal tracking
- `selected` - Observable selected element
- `messageBox` - Observable message content
- `settingsDialog` - Observable dialog instance

#### UserState (`app/state/UserState.js`)
Manages user-related state and operations.

**Responsibilities:**
- Current user (thisUser) tracking
- Self mute/deaf state
- User registration and event handling
- Voice stream playback for users

**Key Methods:**
- `registerUser(user, contextMenuFn, getMenu)` - Register user with UI
- `requestMute(user)` / `requestUnmute(user)` - Mute control
- `requestDeaf(user)` / `requestUndeaf(user)` - Deaf control
- `reset()` - Reset user state

**Properties:**
- `thisUser` - Observable current user
- `selfMute` - Observable self mute state
- `selfDeaf` - Observable self deaf state

#### ChannelState (`app/state/ChannelState.js`)
Manages channel tree and links.

**Responsibilities:**
- Root channel tracking
- Channel registration and event handling
- Channel linking (linked channels)

**Key Methods:**
- `registerChannel(channel, contextMenuFn, getMenu, updateLinks)` - Register channel
- `updateLinks()` - Update channel link state
- `reset()` - Reset channel state

**Properties:**
- `root` - Observable root channel

## Migration from GlobalBindings

### Before (GlobalBindings anti-pattern)
```javascript
class GlobalBindings {
  constructor(config) {
    // 100+ observables mixed together
    this.client = null;
    this.audioContext = null;
    this.thisUser = ko.observable();
    this.selfMute = ko.observable();
    this.selected = ko.observable();
    this.messageBox = ko.observable();
    // ... 1785 lines of mixed responsibilities
  }
}
```

### After (Modular architecture)
```javascript
class AppState {
  constructor(config, log) {
    // Clean module composition
    this.connection = new ConnectionState(log);
    this.audio = new AudioState();
    this.voice = new VoiceState();
    this.ui = new UIState();
    this.user = new UserState(this.audio);
    this.channel = new ChannelState();
  }
  
  // Expose via getters for backward compatibility
  get audioContext() { return this.audio.audioContext; }
  get thisUser() { return this.user.thisUser; }
  // ...
}
```

## Usage Examples

### Connecting to Server
```javascript
await appState.connect(
  host, 
  port, 
  username, 
  password, 
  tokens, 
  channelName
);
```

### Loopback Testing
```javascript
await appState.connectLoopback(host, port, username, password);
// or on existing connection:
await appState.startLoopbackTest();
```

### Audio Control
```javascript
// Start beeping
appState.startBeep();

// Stop beeping
appState.stopBeep();

// Check audio lock
if (appState.audioLockActive()) {
  appState.notifyAudioLock();
}
```

### User Management
```javascript
// Mute/unmute
appState.requestMute(user);
appState.requestUnmute(user);

// Deaf/undeaf
appState.requestDeaf(user);
appState.requestUndeaf(user);
```

### UI Interaction
```javascript
// Select channel/user
appState.select(channelOrUser);

// Send message
appState.sendMessage(target, message);

// Open settings
appState.openSettings(SettingsDialog);
```

## Benefits

### 1. **Separation of Concerns**
Each module has a single, well-defined responsibility.

### 2. **Easier Testing**
Modules can be tested independently with mocked dependencies.

### 3. **Better Code Organization**
Related functionality is grouped together, making code easier to find and understand.

### 4. **Reduced Coupling**
Modules communicate through well-defined interfaces rather than direct property access.

### 5. **Maintainability**
Changes to one module are less likely to break others.

### 6. **Backward Compatibility**
Getters and delegation maintain the same external API as GlobalBindings.

## Implementation Notes

### Knockout Observables
The modules still use Knockout observables for reactive state management. This maintains compatibility with the existing UI bindings.

### Event Subscriptions
Cross-module subscriptions are set up in `AppState._setupSubscriptions()`:
```javascript
this.user.selfMute.subscribe((mute) => {
  this.voice.setMute(mute);
});
```

### Module Dependencies
- `UserState` depends on `AudioState` (for voice playback audio context)
- Other modules are independent
- `AppState` coordinates all modules

### Backward Compatibility
AppState exposes the same properties and methods as GlobalBindings via:
- Getter properties (`get audioContext() { return this.audio.audioContext; }`)
- Delegation methods (`startBeep() { return this.audio.startBeep(); }`)

This allows the refactoring to be done incrementally without breaking existing code.

## Future Improvements

1. **Add Unit Tests** - Each module can now be tested independently
2. **Extract More Dialogs** - ConnectDialog, SettingsDialog could be modules
3. **Type Safety** - Add TypeScript or JSDoc types
4. **Event Bus** - Replace direct subscriptions with an event bus
5. **Immutable State** - Consider using immutable data structures
6. **State Persistence** - Add save/restore for each module

## File Structure

```
app/state/
├── README.md                 # This file
├── AppState.js              # Main coordinator
├── ConnectionState.js       # Server connection
├── AudioState.js            # Audio context & beeper
├── VoiceState.js            # Voice handler
├── UIState.js               # UI state
├── UserState.js             # User management
└── ChannelState.js          # Channel tree
```

## Related Documentation

- [Audio Pipeline](../audio/README.md) - Audio system architecture
- [Authentication](../auth/README.md) - Auth abstraction layer
- [Testing](../../tests/README.md) - Test infrastructure
