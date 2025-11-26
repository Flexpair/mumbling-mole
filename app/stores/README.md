# Architecture Diagrams
## Pinia Migration Status

- **Zielbild**: Die bisherigen Zustandsmodule (Connection/Audio/Voice/UI/User) werden vollständig von **Pinia-Stores** unter `app/stores/` getragen.
- **Aktueller Stand**:
  - Alle **acht** Kernmodule sind als Pinia-Stores implementiert:
    - Core: `connectionStore`, `audioStore`, `voiceStore`, `uiStore`, `userStore`
    - Dialog: `connectionDialogStore`, `connectErrorDialogStore`, `connectionInfoStore`
  - `AppState` in `app/stores/AppState.js` bleibt als zentraler **Koordinator** und **Kompatibilitätslayer** bestehen und exponiert `window.mumbleUi` für ältere Tests und Übergangscode.
  - Vue-Komponenten verwenden `storeToRefs()` für reaktive Store-Destrukturierung.
  - Vue 3.5+ Features im Einsatz: `onWatcherCleanup()`, `useTemplateRef()`.
  - Die Diagramme in diesem Dokument beschreiben weiterhin die logischen Module; technisch werden sie inzwischen von Pinia-Stores umgesetzt.
- **Noch ausstehend**:
  - Schrittweise Migration aller verbleibenden Aufrufer von `window.mumbleUi` bzw. `AppState` auf direkte Pinia-Nutzung (z.B. via `useConnectionStore()`, `useUserStore()` usw.).
  - Sobald keine Legacy-Abhängigkeiten mehr existieren, Vereinfachung oder Entfernung des `AppState`-Kompatibilitätslayers und Aktualisierung der Diagramme auf Store-Terminologie (z.B. "ConnectionStore" statt "ConnectionState").

```
┌─────────────────────────────────────────────────────────────┐
│                         AppState                             │
│                    (Main Coordinator)                        │
│                                                              │
│  • Composes all modules                                     │
│  • Provides unified API                                     │
│  • Manages cross-module interactions                        │
│  • Maintains backward compatibility                         │
└──────────────────┬──────────────────────────────────────────┘
                   │
                   │ coordinates
                   │
    ┌──────────────┼──────────────┬──────────────┬──────────────┐
    │              │              │              │              │
    ▼              ▼              ▼              ▼              ▼
┌─────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐
│Connection│ │  Audio   │  │  Voice   │  │    UI    │  │  User    │
│  State   │ │  State   │  │  State   │  │  State   │  │  State   │
└─────────┘  └──────────┘  └──────────┘  └──────────┘  └─────┬────┘
                                                              │
                                                              │ depends on
                                                              │
                                                         ┌────▼────┐
                                                         │ Channel │
                                                         │  State  │
                                                         └─────────┘
```

## Module Responsibilities

```
┌────────────────────────────────────────────────────────────────┐
│ ConnectionState                                                │
├────────────────────────────────────────────────────────────────┤
│ • WebSocket connection via WorkerBasedMumbleConnector         │
│ • Remote host/port tracking                                   │
│ • Client instance lifecycle                                   │
│ • Audio quality settings                                      │
│ • Server-side mute/deaf state                                 │
└────────────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────────────┐
│ AudioState                                                     │
├────────────────────────────────────────────────────────────────┤
│ • AudioContext lifecycle (singleton)                          │
│ • Audio lock state (sample rate warnings)                     │
│ • Microphone permission handling                              │
│ • Beeper/tone generator for latency testing                   │
│ • Autoplay policy handling                                    │
└────────────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────────────┐
│ VoiceState                                                     │
├────────────────────────────────────────────────────────────────┤
│ • Voice handler lifecycle (PTT/continuous)                    │
│ • Loopback test mode management                               │
│ • Voice handler ready state tracking                          │
│ • Voice data routing (normal vs loopback target)              │
└────────────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────────────┐
│ UIState                                                        │
├────────────────────────────────────────────────────────────────┤
│ • Selected channel/user tracking                              │
│ • Message box state                                           │
│ • Modal management (prevent multiple modals)                  │
│ • Settings dialog state                                       │
└────────────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────────────┐
│ UserState                                                      │
├────────────────────────────────────────────────────────────────┤
│ • Current user (thisUser) tracking                            │
│ • Self mute/deaf state                                        │
│ • User registration and event handling                        │
│ • Voice stream playback for users                             │
└────────────────────────────────────────────────────────────────┘

**REMOVED: ChannelState module** - Channel registration now handled directly in AppState._registerChannel() for single-channel mode.

```

## Connection Flow

```
User Action: Connect to Server
        │
        ▼
┌───────────────┐
│   AppState    │
│   .connect()  │
└───────┬───────┘
        │
        ├─────────────────────┐
        │                     │
        ▼                     ▼
┌──────────────┐      ┌──────────────┐
│ AudioState   │      │ ConnectionState│
│ - Check ctx  │      │ - Connect WS  │
│ - Check mic  │      │ - Setup client│
└──────────────┘      └───────┬───────┘
        │                     │
        │                     ▼
        │             ┌──────────────┐
        │             │  UserState   │
        │             │ - Register   │
        │             │   users      │
        │             └──────────────┘
        │                     │
        │                     ▼
        │             ┌──────────────┐
        │             │ ChannelState │
        │             │ - Register   │
        │             │   channels   │
        │             └──────────────┘
        │                     │
        ▼                     ▼
┌───────────────────────────────────┐
│          VoiceState               │
│     - Update voice handler        │
│     - Set routing target          │
└───────────────────────────────────┘
```

## Voice Data Flow

```
Microphone Input
     │
     ▼
┌──────────────────┐
│  recorder-worker │
│  (AudioWorklet)  │
└────────┬─────────┘
         │ 960-sample frames
         ▼
┌──────────────────┐
│  VoiceState      │
│  .initVoiceInput │
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│  encode-worker   │
│  (Opus codec)    │
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│  VoiceState      │
│  .voiceHandler   │
└────────┬─────────┘
         │
         ├─────────────────┐
         │                 │
         ▼                 ▼
┌─────────────┐   ┌─────────────────┐
│ target = 0  │   │  target = 31    │
│  (normal)   │   │  (loopback)     │
└──────┬──────┘   └────────┬────────┘
       │                   │
       ▼                   ▼
┌─────────────┐   ┌─────────────────┐
│ Send to     │   │ Server echo     │
│ channel/user│   │ back to sender  │
└─────────────┘   └─────────────────┘
```

## State Synchronization

```
┌────────────────────────────────────────────────────────────┐
│                   Reactive Subscriptions                    │
└────────────────────────────────────────────────────────────┘

UserState.selfMute (observable)
         │
         │ subscribe
         ▼
    VoiceState.setMute()
         │
         ▼
    voiceHandler.setMute()


AudioState.audioLockActive (observable)
         │
         │ when true
         ▼
    VoiceState.setMute(true)
    ConnectionState.setSelfMute(true)
    ConnectionState.setSelfDeaf(true)
```

## Backward Compatibility Layer

```
┌────────────────────────────────────────────────────────────┐
│                Old Code (index.js)                         │
│                                                            │
│  ui.audioContext        // Property access                │
│  ui.startBeep()         // Method call                    │
│  ui.thisUser()          // Observable                     │
└──────────────────┬─────────────────────────────────────────┘
                   │
                   │ via getters & delegation
                   ▼
┌────────────────────────────────────────────────────────────┐
│                    AppState                                │
│                                                            │
│  get audioContext() { return this.audio.audioContext; }   │
│  startBeep() { return this.audio.startBeep(); }           │
│  get thisUser() { return this.user.thisUser; }            │
└──────────────────┬─────────────────────────────────────────┘
                   │
                   │ delegates to
                   ▼
┌────────────────────────────────────────────────────────────┐
│                  State Modules                             │
│                                                            │
│  AudioState.audioContext                                   │
│  AudioState.startBeep()                                    │
│  UserState.thisUser                                        │
└────────────────────────────────────────────────────────────┘
```

## Testing Strategy

```
┌────────────────────────────────────────────────────────────┐
│                   Unit Tests (Future)                      │
└────────────────────────────────────────────────────────────┘

ConnectionState
  ├─ connect() ─> Mock WebSocket
  ├─ resetClient() ─> Verify cleanup
  └─ setAudioQuality() ─> Verify client call

AudioState
  ├─ initializeAudioContext() ─> Mock AudioContext
  ├─ initializePersistentBeeper() ─> Mock oscillator
  └─ startBeep() ─> Verify gain changes

VoiceState
  ├─ updateVoiceHandler() ─> Mock client & settings
  ├─ setMute() ─> Verify handler call
  └─ Loopback mode ─> Verify target=31

UIState
  ├─ select() ─> Verify observable update
  ├─ openSettings() ─> Verify modal state
  └─ Modal prevention ─> Verify blocking

UserState
  ├─ registerUser() ─> Mock user events
  ├─ requestMute() ─> Verify state change
  └─ Voice playback ─> Mock audio node

ChannelState
  ├─ registerChannel() ─> Mock channel events
  ├─ updateLinks() ─> Verify link detection
  └─ Channel tree ─> Verify hierarchy

┌────────────────────────────────────────────────────────────┐
│              Integration Tests (Existing)                  │
└────────────────────────────────────────────────────────────┘

npm run test:audio:system
  └─ Validates build artifacts, codecs, worker syntax

npm run test:e2e
  └─ WebSocket smoke test (full connection flow)

npm run test:audio
  └─ Live roundtrip test with real server
```

## Migration Path

```
Phase 1: CREATE MODULES ✅
  ├─ ConnectionState.js
  ├─ AudioState.js
  ├─ VoiceState.js
  ├─ UIState.js
  ├─ UserState.js
  └─ AppState.js (coordinator, includes channel registration)

Phase 2: UPDATE INDEX.JS ⏳
  ├─ Import AppState
  ├─ Replace GlobalBindings instantiation
  └─ Keep all other code intact

Phase 3: VERIFY COMPATIBILITY ⏳
  ├─ Run test suite
  ├─ Manual testing
  └─ Fix any issues

Phase 4: CLEANUP ⏳
  ├─ Remove old GlobalBindings class
  ├─ Update documentation
  └─ Add unit tests

Phase 5: ENHANCE 🔮
  ├─ Add TypeScript types
  ├─ Add event bus
  └─ Add immutable state
```
# Migration Guide: GlobalBindings → AppState

## Overview

This guide explains how to complete the migration from the monolithic `GlobalBindings` class to the new modular `AppState` architecture.

## What Has Been Done ✅

1. **Created 5 Pinia Stores** in `app/stores/`:
   - `connectionStore.js` - Server connection management
   - `audioStore.js` - Audio context & beeper
   - `voiceStore.js` - Voice handler & loopback
   - `uiStore.js` - UI state & modals
   - `userStore.js` - User management
   - `AppState.js` - Main coordinator (compatibility layer)

2. **Created Documentation**:
   - `README.md` - Architecture & API reference

3. **Backward Compatibility**:
   - `AppState` exposes same API as `GlobalBindings`
   - All properties accessible via getters
   - All methods delegated to appropriate modules

## What Remains To Do ⏳

### Step 1: Update `app/index.js`

The `app/index.js` file needs minimal changes:

#### Before:
```javascript
class GlobalBindings {
  constructor(config) {
    // ... 1785 lines ...
  }
}

var ui = new GlobalBindings(window.mumbleWebConfig);
```

#### After:
```javascript
import AppState from "./stores/AppState";

// Remove the entire GlobalBindings class definition
// (it's been replaced by the stores in app/stores/)

var ui = new AppState(window.mumbleWebConfig, log);
```

#### Detailed Changes:

1. **Add import at top of file** (after other imports):
```javascript
import AppState from "./stores/AppState";
```

2. **Find the `class GlobalBindings` definition** (starts around line 474):
```javascript
class GlobalBindings {
  constructor(config) {
    // ... entire class ...
  }
}
```

3. **Delete the entire GlobalBindings class** (from `class GlobalBindings {` to the closing `}`)

4. **Update the instantiation** (around line 1666):
```javascript
// OLD:
var ui = new GlobalBindings(window.mumbleWebConfig);

// NEW:
var ui = new AppState(window.mumbleWebConfig, log);
```

5. **Keep everything else**:
   - `ConnectDialog` class - stays as-is
   - `ConnectErrorDialog` class - stays as-is  
   - `SampleRateWarningDialog` class - stays as-is
   - `GuacamoleFrame` class - stays as-is
   - `ConnectionInfo` class - stays as-is
   - `Settings` class - stays as-is
   - `SettingsDialog` class - REMOVED (integrated into ConnectionInfoDialog)
   - Helper functions - stay as-is
   - `initializeUI()` function - stays as-is
   - `main()` function - stays as-is

### Step 2: Wire Up Dependencies

Some classes need to be attached to the `AppState` instance:

In `app/index.js`, after creating the `ui` instance, add:

```javascript
var ui = new AppState(window.mumbleWebConfig, log);

// Initialize dependent objects
ui.settings = new Settings(window.mumbleWebConfig.settings);
ui.connectDialog = new ConnectDialog();
ui.connectErrorDialog = new ConnectErrorDialog(ui.connectDialog);
ui.sampleRateWarningDialog = new SampleRateWarningDialog(ui);
ui.guacamoleFrame = new GuacamoleFrame();
ui.connectionInfo = new ConnectionInfo(ui);

// Initialize auth
const authConfig = window.mumbleWebConfig?.auth || { provider: 'netlify' };
ui.auth = AuthFactory.create(authConfig);
ui.netlifyIdentity = ui.auth; // Backward compatibility
```

### Step 3: Verify Knockout Bindings

The `app/index.html` file should **not need changes** because `AppState` exposes the same properties and methods as `GlobalBindings`.

However, verify these bindings still work:

#### Connection State:
```html
<span data-bind="text: remoteHost"></span>
<span data-bind="text: remotePort"></span>
<div data-bind="visible: connected()"></div>
```

#### Audio State:
```html
<button data-bind="click: startBeep, enable: beeperReady"></button>
<button data-bind="click: stopBeep"></button>
<div data-bind="visible: audioLockActive"></div>
<div data-bind="visible: micPermissionDenied"></div>
```

#### Voice State:
```html
<div data-bind="visible: isLoopbackMode"></div>
<div data-bind="visible: voiceHandlerReady"></div>
```

#### UI State:
```html
<input data-bind="value: messageBox"></input>
<button data-bind="click: submitMessageBox"></button>
<div data-bind="with: settingsDialog"></div>
```

#### User State:
```html
<div data-bind="with: thisUser"></div>
<button data-bind="click: function() { requestMute(thisUser()); }"></button>
<button data-bind="click: function() { requestDeaf(thisUser()); }"></button>
```

#### Channel State:
```html
<div data-bind="with: root"></div>
```

All these should work without modification because `AppState` uses getters to expose the same properties.

### Step 4: Test the Changes

Run the test suite to verify everything works:

```bash
# Fast validation (audio system + e2e + audit)
npm run test:quick

# Full test suite
npm run test

# Individual tests
npm run test:audio:system  # Offline validation
npm run test:e2e           # WebSocket smoke test
npm run test:audio         # Live roundtrip test
```

### Step 5: Manual Testing

Test these features manually:

#### Connection Flow:
1. Open the app
2. Log in with Netlify Identity
3. Connect to a Mumble server
4. Verify connection succeeds
5. Verify channel tree appears
6. Verify user list appears

#### Audio Features:
1. Test microphone permission request
2. Test mute/unmute
3. Test deaf/undeaf
4. Test voice transmission (talk in channel)
5. Test receiving voice from others
6. Test beeper (if available)

#### Loopback Mode:
1. Click "Test" button
2. Verify loopback mode activates
3. Test voice echo
4. Test beeper latency measurement
5. Switch back to normal mode

#### UI Features:
1. Select channels
2. Select users
3. Send messages
4. Open settings dialog
5. Change settings
6. Apply settings

### Step 6: Troubleshooting

If something doesn't work:

#### Issue: Property not found
**Error:** `Cannot read property 'X' of undefined`

**Solution:** Check if the property is exposed in `AppState` via getter:
```javascript
// In AppState.js, add:
get propertyName() { return this.module.propertyName; }
```

#### Issue: Method not found
**Error:** `ui.methodName is not a function`

**Solution:** Check if the method is delegated in `AppState`:
```javascript
// In AppState.js, add:
methodName(...args) { return this.module.methodName(...args); }
```

#### Issue: Observable not updating
**Error:** UI doesn't react to changes

**Solution:** Verify the property is a Knockout observable:
```javascript
// In the module, ensure:
this.propertyName = ko.observable(initialValue);

// Not:
this.propertyName = initialValue;
```

#### Issue: Missing context menu
**Error:** Context menu doesn't open

**Solution:** Implement `_openContextMenu` in `AppState`:
```javascript
_openContextMenu(event, menu, ui) {
  // Copy implementation from old GlobalBindings
}
```

#### Issue: Settings not persisting
**Error:** Settings reset on reload

**Solution:** Verify `Settings` class is attached:
```javascript
ui.settings = new Settings(window.mumbleWebConfig.settings);
```

## Rollback Plan

If issues arise and you need to rollback:

1. **Revert `app/index.js` changes**:
   - Remove `import AppState` line
   - Restore `class GlobalBindings` definition
   - Change `new AppState(...)` back to `new GlobalBindings(...)`

2. **Keep the new modules**:
   - The `app/stores/` directory can remain
   - It doesn't affect the old code
   - You can retry migration later

3. **Run tests to verify**:
   - `npm run test:quick`
   - Manual testing

## Success Checklist

- [ ] `app/index.js` imports `AppState`
- [ ] `class GlobalBindings` removed from `app/index.js`
- [ ] `ui` instantiated as `new AppState(...)`
- [ ] Dependencies wired up (settings, dialogs, auth)
- [ ] `npm run test:quick` passes
- [ ] Manual testing passes
- [ ] No regressions observed
- [ ] Code committed to git

## Benefits After Migration

✅ **Separation of Concerns** - Each module has one responsibility
✅ **Easier to Test** - Modules can be tested independently  
✅ **Better Organization** - Related code is grouped together
✅ **Reduced Coupling** - Clean interfaces between modules
✅ **Maintainability** - Changes isolated to relevant modules
✅ **Backward Compatible** - Existing code works unchanged

## Next Steps After Migration

Once the migration is complete and stable:

1. **Add Unit Tests** - Test each module in isolation
2. **Extract More Classes** - Convert dialogs to modules
3. **Add Type Safety** - JSDoc or TypeScript types
4. **Refactor Subscriptions** - Use event bus pattern
5. **Update Documentation** - Reflect new architecture

## Getting Help

If you encounter issues during migration:

1. **Check Documentation**:
   - `app/stores/README.md` - API reference and architecture

2. **Compare Implementations**:
   - Look at old `GlobalBindings` code
   - Find equivalent in new modules
   - Ensure delegation is correct

3. **Debug Systematically**:
   - Check browser console for errors
   - Use debugger to trace execution
   - Verify observables are updating
   - Check Knockout bindings

4. **Test Incrementally**:
   - Don't change everything at once
   - Test after each small change
   - Keep git commits small and focused

## Conclusion

The migration is straightforward because `AppState` was designed for backward compatibility. The main work is:

1. Remove old `GlobalBindings` class
2. Import and instantiate `AppState`
3. Wire up dependencies
4. Test thoroughly

The new architecture provides a solid foundation for future development while maintaining full compatibility with existing code.
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
app/stores/
├── index.js                  # Module exports
├── AppState.js               # Main coordinator (compatibility layer)
├── connectionStore.js        # Connection management
├── audioStore.js             # Audio & beeper
├── voiceStore.js             # Voice handler
├── uiStore.js                # UI state
├── userStore.js              # User management
├── README.md                 # Full documentation
├── REFACTORING_SUMMARY.md    # Project overview
└── QUICK_REFERENCE.md        # This file
```

## Import Examples

```javascript
// Import main coordinator
import AppState from './stores/AppState';

// Import specific module
import AudioState from './state/AudioState';

const appState = new AppState(config, log);
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
# State Architecture Migration Summary

## Problem Statement

The `GlobalBindings` class in `app/index.js` was a 1785-line god object that violated the Single Responsibility Principle by managing:
- Server connection lifecycle
- Audio context and beeper functionality  
- Voice handler and loopback testing
- UI state and modal management
- User management and mute/deaf state
- Channel tree and links
- Settings persistence
- Authentication
- Guacamole integration
- Message sending

This made the code:
- **Hard to understand** - Mixed responsibilities made it difficult to find relevant code
- **Hard to test** - Impossible to test components in isolation
- **Hard to maintain** - Changes in one area could break unrelated features
- **Hard to extend** - Adding new features required modifying the monolithic class

## Solution: Modular Architecture

The refactoring breaks down `GlobalBindings` into 7 focused modules:

### 1. **ConnectionState** (133 lines)
- WebSocket connection management
- Remote host/port tracking
- Audio quality settings
- Server-side mute/deaf state

### 2. **AudioState** (264 lines)
- AudioContext lifecycle
- Audio lock state
- Microphone permission handling
- Beeper/tone generator

### 3. **VoiceState** (107 lines)
- Voice handler lifecycle
- Loopback test mode
- Voice data routing

### 4. **UIState** (77 lines)
- Selection tracking
- Message box state
- Modal management
- Settings dialog state

### 5. **UserState** (225 lines)
- Current user tracking
- Self mute/deaf state
- User registration
- Voice stream playback

### 6. **ChannelState** (145 lines)
- Root channel tracking
- Channel registration
- Channel link management

### 7. **AppState** (518 lines)
- Coordinates all modules
- Provides unified API
- Maintains backward compatibility
- Manages cross-module interactions

**Total: ~1470 lines across 7 modules** vs. 1785 lines in one file

## Benefits Achieved

### ✅ Separation of Concerns
Each module has a single, well-defined responsibility.

### ✅ Testability
Modules can be tested independently with mocked dependencies.

### ✅ Maintainability
Related functionality is grouped together, making code easier to navigate.

### ✅ Reduced Coupling
Modules communicate through well-defined interfaces.

### ✅ Backward Compatibility
AppState exposes the same API as GlobalBindings via getters and delegation.

## Migration Strategy

The refactoring was designed for **incremental adoption**:

### Phase 1: Create Modules ✅ COMPLETED
- Created 5 Pinia stores + 1 coordinator (AppState)
- Each module is self-contained and functional
- Comprehensive documentation in this file

### Phase 2: Update index.js ✅ COMPLETED
- Replaced `GlobalBindings` with `AppState` instantiation
- Pinia initialized and stores registered
- Backward compatibility maintained via `AppState`

### Phase 3: Update index.html ✅ COMPLETED
- Knockout bindings removed
- Replaced with Vue 3 root component (`<div id="app">`)

### Phase 4: Test & Validate (IN PROGRESS)
- Run existing test suite: `npm run test:unit`
- Manual testing of:
  - Connection/disconnection
  - Audio features (mute/deaf/beeper)
  - Loopback testing
  - UI interactions
  - Message sending

## Code Example Comparison

### Before: GlobalBindings (anti-pattern)
```javascript
class GlobalBindings {
  constructor(config) {
    // Everything mixed together
    this.client = null;
    this.audioContext = null;
    this.thisUser = ko.observable();
    this.selfMute = ko.observable();
    this.selected = ko.observable();
    this.isLoopbackMode = ko.observable(false);
    // ... 100+ more observables
    // ... 1700+ more lines
  }
}
```

### After: Modular Architecture
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
  
  // Backward compatibility via delegation
  get audioContext() { return this.audio.audioContext; }
  get thisUser() { return this.user.thisUser; }
  startBeep() { return this.audio.startBeep(); }
  // ...
}
```

## File Structure

```
app/stores/
├── README.md                 # Architecture documentation
├── index.js                  # Module exports
├── AppState.js               # Main coordinator
├── connectionStore.js        # Connection management
├── audioStore.js             # Audio & beeper
├── voiceStore.js             # Voice handler
├── uiStore.js                # UI state
└── userStore.js              # User management
```

## Metrics

| Metric | Before | After | Improvement |
|--------|--------|-------|-------------|
| Lines per file | 1785 | 77-518 | 70-97% reduction |
| Module count | 1 | 7 | Better organization |
| Avg lines/module | 1785 | ~210 | 88% reduction |
| Testability | ❌ Poor | ✅ Good | Independently testable |
| Coupling | ❌ High | ✅ Low | Clear interfaces |

## Next Steps

1. **Update `app/index.js`**
   - Replace `class GlobalBindings` with `AppState` import
   - Change `var ui = new GlobalBindings(config)` to `var ui = new AppState(config, log)`
   - Remove old `GlobalBindings` class definition
   - Keep all other code (dialogs, helpers, main function)

2. **Verify Backward Compatibility**
   - All existing `ui.property` accesses should still work via getters
   - All existing `ui.method()` calls should still work via delegation
   - No changes needed in Knockout bindings

3. **Run Tests**
   - `npm run test:quick` - Fast test subset
   - `npm run test:audio:system` - Audio validation
   - `npm run test:e2e` - WebSocket smoke test
   - Manual testing of all features

4. **Iterate if Needed**
   - Fix any issues discovered in testing
   - Add missing delegations if needed
   - Update documentation

## Success Criteria

- ✅ All modules created and documented
- ⏳ Tests pass without modification
- ⏳ UI works identically to before
- ⏳ No regressions in functionality
- ✅ Code is more maintainable
- ✅ Modules are independently testable

## Future Enhancements

Once the refactoring is complete and stable:

1. **Add Unit Tests** - Test each module in isolation
2. **Extract Dialogs** - Make dialogs into modules too
3. **Add TypeScript** - Type safety for better maintainability
4. **Event Bus** - Replace subscriptions with event bus pattern
5. **Immutable State** - Consider using immutable data structures

## Conclusion

This refactoring transforms a 1785-line god object into a clean, modular architecture with:
- **7 focused modules** with clear responsibilities
- **70-97% reduction** in lines per file
- **Independent testability** for each module
- **Full backward compatibility** with existing code
- **Comprehensive documentation** for future maintainers

The new architecture follows SOLID principles and modern software engineering best practices while maintaining compatibility with the existing Knockout.js-based UI.

---

# Vue.js Migration History

## Phase 1: Vue Composables Creation (November 7, 2025) ✅

**Status:** Complete and Tested  
**Branch:** `vue-state-migration`

### Summary

Created Vue 3 composables for all 5 state modules, maintaining full backward compatibility with the existing Knockout system. All 1517 unit tests pass.

### Created Composables

- **`app/composables/useConnectionState.js`** - WebSocket connection, client lifecycle
- **`app/composables/useAudioState.js`** - AudioContext, beeper, audio lock
- **`app/composables/useVoiceState.js`** - Voice handler, loopback mode
- **`app/composables/useUIState.js`** - Modal management, message box
- **`app/composables/useUserState.js`** - Current user, mute/deaf state

### Dual-Runtime Architecture

AppState now maintains both Vue and Knockout reactive systems:

```javascript
// Vue refs are source of truth
const selfMute = ref(false);

// Knockout observables sync FROM Vue
this._ko_selfMute = ko.observable(false);
watch(() => v.user.selfMute.value, (val) => this._ko_selfMute(val));
```

**API Surface:**
- **Knockout API** (backward compatible): `appState.selfMute()` 
- **Vue API** (new): `appState.user.selfMute.value`

### Test Results
- ✅ All 1517 unit tests passing
- ✅ Production build successful (682KB index.js)
- ✅ 6 new composable tests added

---

## Phase 2: Dual-Runtime API Fixes (November 8, 2025) ✅

**Status:** Complete and Tested  
**PR:** #195

### Summary

Fixed dual-runtime API inconsistencies and added comprehensive test coverage. All Vue components now correctly use root-level Knockout observables for backward compatibility.

### Key Changes

**Component API Fixes:**
- Fixed all Vue components to use `appState.isBeeping()` not `appState.audio.isBeeping()`
- Root-level API returns Knockout observables (callable functions)
- Nested API returns Vue composables (ref properties)

**Bug Fixes:**
- Fixed `app/index.js` line 265: `ui.voice.isLoopbackMode(false)` → `ui.isLoopbackMode(false)`
- Prevented "not a function" error when exiting loopback test mode

**Test Coverage:**
- Rewrote `__tests_./stores/AppState.test.js` with 35 comprehensive tests (was 1 skipped)
- Fixed Playwright E2E test (`loopback-frequency.spec.js`) for root-level API
- Coverage: AppState 78%, AudioState 94%, VoiceState 98%, UserState 94%

### Test Results
- ✅ 1477 unit tests passing (0 skipped)
- ✅ Playwright E2E test passing (440 Hz frequency detection)
- ✅ All integration tests passing

---

## Phase 3: Complete Knockout Removal (Future) ⏸️

**Status:** Deferred - Complex Refactor Required

### Scope
Would require coordinating changes across:
1. All Vue components (change from `inject('appState')` to direct composable usage)
2. Remove all `_ko_*` observables from state modules
3. Remove bidirectional sync mechanisms (`watch()` and `subscribe()`)
4. Rewrite `app/index.js` legacy classes (ConnectionInfo, SettingsDialog, Settings)
5. Update all Playwright tests
6. Remove Knockout dependency from `package.json`

### Decision
**Keep current dual-runtime architecture.** It's stable, fully tested, and allows gradual migration if needed in the future. The ~100KB Knockout dependency is acceptable given the complexity and risk of complete removal.

---

## Architecture Evolution

### Before Migration (Knockout Only)
```
AppState (1785 lines, god object)
 ConnectionState logic
 AudioState logic
 VoiceState logic  
 UIState logic
 UserState logic
```

### After Phase 1 (Vue Composables + Knockout Bridge)
```
AppState (modular, dual-runtime)
 Vue Composables (source of truth)
   ├── useConnectionState() → ref/reactive
   ├── useAudioState() → ref/reactive
   ├── useVoiceState() → ref/reactive
   ├── useUIState() → ref/reactive
   └── useUserState() → ref/reactive
 Knockout Observables (backward compat)
    ├── _ko_* properties
    ├── Root-level getters (e.g., selfMute())
    └── Bidirectional sync (watch + subscribe)
```

### After Phase 2 (API Fixes + Tests)
- ✅ All components use correct API
- ✅ Comprehensive test coverage
- ✅ E2E tests passing
- ✅ Production-ready

---

**Current Status:** Vue migration Phases 1-2 complete. System is stable with dual-runtime architecture providing full backward compatibility while enabling future Vue-only development.
