# Manager Classes

This directory contains manager classes extracted from the GlobalBindings god object to improve code organization and maintainability.

## Architecture Pattern

We use the **Delegation Pattern** to break down the monolithic GlobalBindings class while maintaining backward compatibility:

- Managers are internal properties of GlobalBindings
- GlobalBindings exposes the same public API (all existing code continues to work)
- Managers handle specific responsibilities
- GlobalBindings delegates to managers but exposes their observables directly

## Manager Classes

### AudioManager.js (386 lines)
**Responsibility**: Audio system management

Handles:
- AudioContext initialization and lifecycle
- Beeper (latency testing tone generator)
- Microphone permissions
- Audio lock state (sample rate validation)
- Loopback test mode

Key observables:
- `micPermissionDenied`, `micPermissionErrorMessage`
- `audioLockActive`, `audioLockReason`, `audioLockDetails`
- `isLoopbackMode`
- `isBeeping`, `beeperReady`, `voiceHandlerReady`

### ConnectionManager.js (50 lines)
**Responsibility**: Mumble connection state

Handles:
- Client connection lifecycle
- Connection state tracking
- Remote host/port management

Key observables:
- `thisUser`, `root`
- `remoteHost`, `remotePort`

Key properties:
- `connector` - WorkerBasedMumbleConnector instance
- `client` - Active Mumble client instance

### ChannelManager.js (273 lines)
**Responsibility**: Channel and user tree management

Handles:
- Channel creation and updates
- User creation and updates  
- Channel/user tree structure
- Link management between channels
- Context menus

Key observables:
- `channelContextMenu`, `userContextMenu`

Methods:
- `newChannel(channel, requestMethods)` - Create UI binding for channel
- `newUser(user, requestMethods)` - Create UI binding for user
- `updateLinks(rootObservable, thisUserObservable)` - Update channel links

### UIStateManager.js (43 lines)
**Responsibility**: UI state and dialog management

Handles:
- Modal tracking (prevents multiple modals)
- Selected channel/user
- Message box state
- Settings dialog state

Key observables:
- `currentOpenModal`
- `selected`
- `messageBox`, `messageBoxHint`
- `settingsDialog`

## Usage Example

```javascript
// In GlobalBindings constructor
this.audioManager = new AudioManager();
this.connectionManager = new ConnectionManager();
this.uiStateManager = new UIStateManager();
this.channelManager = new ChannelManager();

// Expose manager observables for backward compatibility
this.audioLockActive = this.audioManager.audioLockActive;
this.isBeeping = this.audioManager.isBeeping;
this.thisUser = this.connectionManager.thisUser;
this.selected = this.uiStateManager.selected;

// Delegate methods to managers
this.startBeep = () => {
  this.audioManager.startBeep(this.connected());
};

this._updateLinks = () => {
  this.channelManager.updateLinks(this.root, this.thisUser);
};
```

## Benefits

1. **Separation of Concerns**: Each manager has a single, well-defined responsibility
2. **Easier Testing**: Managers can be unit tested independently
3. **Better Maintainability**: Related code is grouped together
4. **Reduced Complexity**: GlobalBindings reduced from ~1190 lines to ~910 lines (23.5% reduction)
5. **Backward Compatible**: No changes required to existing code using GlobalBindings

## Future Improvements

1. Extract VoiceHandler management into a VoiceManager
2. Extract dialog management (ConnectDialog, SettingsDialog, etc.) into DialogManager
3. Add unit tests for manager classes
4. Consider extracting Guacamole integration into GuacamoleManager
5. Document dependencies between managers

## Dependencies

### Manager Dependencies
- AudioManager: `ko`, `audioContextManager`
- ConnectionManager: `ko`, `WorkerBasedMumbleConnector`
- UIStateManager: `ko`
- ChannelManager: `ko`

### GlobalBindings Dependencies on Managers
- Uses all four managers
- Synchronizes state between managers (e.g., `client` property)
- Provides callbacks for manager operations (e.g., `requestMute`, `requestDeaf`)

## Testing

Managers are tested indirectly through existing integration tests:
- `npm run test:audio:system` - Validates audio system functionality
- `npm run test:e2e` - End-to-end WebSocket and connection tests

Direct unit tests for managers are planned for future implementation.
