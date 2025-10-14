# AppState Quick Reference

## Module Access Pattern

```javascript
// Access modules via appState instance
appState.connection   // ConnectionState
appState.audio        // AudioState
appState.voice        // VoiceState
appState.ui           // UIState
appState.user         // UserState
appState.channel      // ChannelState
```

## Common Operations

### Connection
```javascript
// Connect to server
await appState.connect(host, port, username, password, tokens, channel);

// Connect in loopback mode
await appState.connectLoopback(host, port, username, password);

// Start loopback test
await appState.startLoopbackTest();

// Disconnect
appState.resetClient();

// Check if connected
const connected = appState.connected();
```

### Audio
```javascript
// Start/stop beeper
appState.startBeep();
appState.stopBeep();

// Check beeper ready
if (appState.beeperReady()) { ... }

// Initialize AudioContext
await appState.initializeAudioContext();

// Check audio lock
if (appState.audioLockActive()) {
  appState.notifyAudioLock();
}

// Retry microphone permission
appState.retryMicrophonePermission();
```

### Voice
```javascript
// Check loopback mode
if (appState.isLoopbackMode()) { ... }

// Check voice handler ready
if (appState.voiceHandlerReady()) { ... }

// Access voice handler
const handler = appState.voiceHandler;
```

### UI
```javascript
// Select channel/user
appState.select(channelOrUser);

// Get selected
const selected = appState.selected();

// Message box
appState.messageBox("Hello world");
appState.submitMessageBox();

// Settings
appState.openSettings(SettingsDialog);
appState.applySettings();
appState.closeSettings();
```

### User
```javascript
// Get current user
const user = appState.thisUser();

// Mute/unmute
appState.requestMute(user);
appState.requestUnmute(user);

// Deaf/undeaf
appState.requestDeaf(user);
appState.requestUndeaf(user);

// Check mute/deaf state
if (appState.selfMute()) { ... }
if (appState.selfDeaf()) { ... }
```

### Channel
```javascript
// Get root channel
const root = appState.root();

// Send message
appState.sendMessage(target, message);
```

## Module-Specific APIs

### ConnectionState
```javascript
// Direct module access
const conn = appState.connection;

// Methods
await conn.connect(host, port, username, password, tokens);
conn.resetClient();
conn.setAudioQuality(bitrate, samples);
conn.setSelfMute(muted);
conn.setSelfDeaf(deafened);

// Properties
conn.client          // MumbleClient instance
conn.remoteHost()    // Observable
conn.remotePort()    // Observable
conn.connector       // WorkerBasedMumbleConnector
```

### AudioState
```javascript
// Direct module access
const audio = appState.audio;

// Methods
await audio.initializeAudioContext();
await audio.resumeAudioContext();
audio.activateAudioLock(reason, details);
audio.clearAudioLock({ resetStates: true });
audio.attemptMicrophonePermission();
audio.retryMicrophonePermission();
await audio.initializePersistentBeeper();
audio.startBeep();
audio.stopBeep();
audio.resetBeeper();

// Properties
audio.audioContext              // AudioContext
audio.audioLockActive()         // Observable
audio.audioLockReason()         // Observable
audio.audioLockDetails()        // Observable
audio.micPermissionDenied()     // Observable
audio.micPermissionErrorMessage() // Observable
audio.isBeeping()               // Observable
audio.beeperReady()             // Observable
```

### VoiceState
```javascript
// Direct module access
const voice = appState.voice;

// Methods
voice.initVoiceInput(onData, onError);
voice.updateVoiceHandler(client, settings, onStart, onStop);
voice.setMute(muted);
voice.writeVoiceData(data);
voice.endVoiceHandler();
voice.reset();

// Properties
voice.voiceHandler          // Handler instance
voice.isLoopbackMode()      // Observable
voice.voiceHandlerReady()   // Observable
```

### UIState
```javascript
// Direct module access
const ui = appState.ui;

// Methods
ui.select(element);
ui.openSettings(settings, DialogClass);
ui.closeSettings();
ui.submitMessageBox(sendFn, target);
ui.reset();

// Properties
ui.currentOpenModal()   // Observable
ui.selected()           // Observable
ui.messageBox()         // Observable
ui.settingsDialog()     // Observable
```

### UserState
```javascript
// Direct module access
const user = appState.user;

// Methods
user.registerUser(user, contextMenuFn, getMenu);
user.requestMute(user, onLocked);
user.requestUnmute(user, onLocked);
user.requestDeaf(user, isLoopback);
user.requestUndeaf(user, onLocked);
user.reset();

// Properties
user.thisUser()    // Observable
user.selfMute()    // Observable
user.selfDeaf()    // Observable
```

### ChannelState
```javascript
// Direct module access
const channel = appState.channel;

// Methods
channel.registerChannel(channel, contextFn, getMenu, updateFn);
channel.updateLinks();
channel.reset();

// Properties
channel.root()     // Observable
```

## Knockout Bindings

### Connection
```html
<span data-bind="text: remoteHost"></span>
<span data-bind="text: remotePort"></span>
<div data-bind="visible: connected()"></div>
```

### Audio
```html
<button data-bind="click: startBeep, enable: beeperReady"></button>
<button data-bind="click: stopBeep, visible: isBeeping"></button>
<div data-bind="visible: audioLockActive"></div>
<div data-bind="visible: micPermissionDenied"></div>
<button data-bind="click: retryMicrophonePermission"></button>
```

### Voice
```html
<div data-bind="visible: isLoopbackMode"></div>
<div data-bind="visible: voiceHandlerReady"></div>
<button data-bind="click: startLoopbackTest"></button>
```

### UI
```html
<input data-bind="value: messageBox, valueUpdate: 'afterkeydown'"/>
<button data-bind="click: submitMessageBox"></button>
<button data-bind="click: openSettings"></button>
<div data-bind="with: settingsDialog"></div>
```

### User
```html
<div data-bind="with: thisUser">
  <span data-bind="text: name"></span>
  <button data-bind="click: $root.requestMute"></button>
  <button data-bind="click: $root.requestUnmute"></button>
  <button data-bind="click: $root.requestDeaf"></button>
  <button data-bind="click: $root.requestUndeaf"></button>
</div>
<div data-bind="visible: selfMute"></div>
<div data-bind="visible: selfDeaf"></div>
```

### Channel
```html
<div data-bind="with: root">
  <span data-bind="text: name"></span>
  <!-- channel tree -->
</div>
```

## Computed Observables

```javascript
// Message box hint
appState.messageBoxHint()  // Observable computed

// Mail to desktop
appState.mailToDesktop()   // Observable
```

## Event Handlers

```javascript
// Unmute click
appState.handleUnmuteClick()

// Undeaf click
appState.handleUndeafClick()

// Apply settings
appState.applySettings()

// Logout
appState.logoutUser()

// Open source code
appState.openSourceCode()
```

## Module Lifecycle

```javascript
// Initialize (in main)
const appState = new AppState(config, log);

// Set up dependencies
appState.settings = new Settings(config.settings);
appState.connectDialog = new ConnectDialog();
appState.auth = AuthFactory.create(authConfig);
// ... etc

// Use throughout app
appState.connect(...);
appState.startBeep();
appState.requestMute(...);

// Clean up
appState.resetClient();
```

## Testing

```javascript
// Mock a module for testing
const mockAudio = {
  audioContext: mockAudioContext,
  startBeep: jest.fn(),
  stopBeep: jest.fn(),
  // ...
};

const appState = new AppState(config, log);
appState.audio = mockAudio;

// Test
appState.startBeep();
expect(mockAudio.startBeep).toHaveBeenCalled();
```

## File Locations

```
app/state/
├── index.js                  # Module exports
├── AppState.js               # Main coordinator
├── ConnectionState.js        # Connection management
├── AudioState.js             # Audio & beeper
├── VoiceState.js             # Voice handler
├── UIState.js                # UI state
├── UserState.js              # User management
├── ChannelState.js           # Channel tree
├── README.md                 # Full documentation
├── MIGRATION_GUIDE.md        # Migration steps
├── ARCHITECTURE.md           # Visual diagrams
├── REFACTORING_SUMMARY.md    # Project overview
└── QUICK_REFERENCE.md        # This file
```

## Import Examples

```javascript
// Import main coordinator
import AppState from './state/AppState';

// Import specific module
import AudioState from './state/AudioState';

// Import all
import * as State from './state';
const appState = new State.AppState(config, log);
```

## Common Patterns

### Checking Ready States
```javascript
if (appState.connected() && 
    appState.voiceHandlerReady() && 
    appState.beeperReady()) {
  // Everything is ready
}
```

### Handling Audio Lock
```javascript
if (appState.audioLockActive()) {
  const reason = appState.audioLockReason();
  const details = appState.audioLockDetails();
  console.log(`Audio locked: ${reason}`, details);
  appState.notifyAudioLock();
}
```

### Safe Unmute
```javascript
function safeUnmute() {
  if (appState.audioLockActive()) {
    appState.notifyAudioLock();
    return;
  }
  const user = appState.thisUser();
  if (user) {
    appState.requestUnmute(user);
  }
}
```

### Message Sending
```javascript
function sendMessage(message) {
  const target = appState.selected() || appState.thisUser();
  if (target) {
    appState.sendMessage(target, message);
  }
}
```
