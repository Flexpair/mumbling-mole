# Managers

This directory contains manager classes that encapsulate specific responsibilities previously held by the `GlobalBindings` god object in `app/index.js`.

## Architecture

The manager pattern extracts cohesive functionality into focused, single-responsibility classes. Each manager:

- Owns specific observables and state
- Provides a clean API for interaction
- Minimizes coupling with other components
- Makes the codebase more maintainable and testable

## Manager Classes

### ModalManager

**Responsibility**: Manages the state of currently open modals

**Key Features**:
- Ensures only one modal is open at a time
- Provides methods to open, close, and check modal state
- Simple and focused API

**Observables**:
- `currentOpenModal` - Name of currently open modal (null if none)

**Methods**:
- `isModalOpen()` - Check if any modal is currently open
- `openModal(modalName)` - Open a modal if no other is open
- `closeModal(modalName)` - Close a specific modal
- `closeAnyModal()` - Close any currently open modal

### AudioLockManager

**Responsibility**: Manages audio lock state

**Key Features**:
- Prevents audio transmission when sample rate is incompatible
- Stores lock reason and details
- Clean activate/clear interface

**Observables**:
- `audioLockActive` - Whether audio lock is active
- `audioLockReason` - Reason for the lock (e.g., "sample-rate")
- `audioLockDetails` - Additional details about the lock

**Methods**:
- `activate(reason, details)` - Activate audio lock
- `clear({resetStates})` - Clear audio lock
- `isActive()` - Check if lock is active
- `getDetails()` - Get lock details

### BeeperManager

**Responsibility**: Manages the beeper/test tone functionality

**Key Features**:
- Persistent beeper with dual output (local + server echo)
- Latency testing capability
- Automatic initialization and state management

**Observables**:
- `isBeeping` - Whether beeper is currently playing
- `beeperReady` - Whether beeper is initialized and ready
- `voiceHandlerReady` - Whether voice handler is ready (for full system check)

**Methods**:
- `initialize()` - Initialize the persistent beeper
- `checkFullReadiness()` - Check if both beeper and voice handler are ready
- `start(isConnected)` - Start beep if connected
- `stop()` - Stop beep with fadeout

**Implementation Details**:
- Creates permanent oscillator at 440 Hz
- Dual output path: local (immediate) + remote (server echo)
- Enables latency testing by comparing local vs echoed audio
- Uses gain nodes to control volume without stopping oscillator

### VoiceManager

**Responsibility**: Manages voice handler lifecycle and state

**Key Features**:
- Creates appropriate voice handler (continuous or push-to-talk)
- Handles loopback mode routing (target=31)
- Manages handler lifecycle (creation, updates, cleanup)

**Observables**:
- `voiceHandlerReady` - Whether voice handler is initialized

**Methods**:
- `updateVoiceHandler(...)` - Update voice handler based on settings
- `setMute(mute)` - Set mute state on voice handler
- `end()` - End voice handler
- `getHandler()` - Get current voice handler

**Implementation Details**:
- Supports continuous and push-to-talk modes
- Routes voice to loopback (target=31) for testing or normal (target=0)
- Automatically applies mute state to new handlers
- Binds talking indicators to voice handler events

## Usage in GlobalBindings

Managers are initialized in the `GlobalBindings` constructor:

```javascript
// Initialize managers
this.modalManager = new ModalManager();
this.audioLockManager = new AudioLockManager();
this.beeperManager = new BeeperManager(debugLog);
this.voiceManager = new VoiceManager(debugLog, translate, log);

// Expose manager observables for backward compatibility
this.currentOpenModal = this.modalManager.currentOpenModal;
this.audioLockActive = this.audioLockManager.audioLockActive;
// ... etc
```

## Benefits

### Before Refactoring
- `GlobalBindings`: 1785 lines, ~100+ observables and methods
- All responsibilities mixed together
- Difficult to understand and maintain
- Global `voiceHandler` variable

### After Refactoring
- `GlobalBindings`: 1576 lines (209 lines extracted)
- Managers: 421 lines total (4 focused classes)
- Clear separation of concerns
- No global state for voice handler
- Easier to test individual managers
- Better encapsulation

## Future Improvements

Potential additional managers to extract:

1. **ConnectionManager** - Connection/reconnection logic, client lifecycle
2. **ChannelManager** - Channel tree management, linking logic
3. **UserManager** - User state management, UI creation
4. **MessageManager** - Message sending/receiving logic

## Testing

All existing tests pass after the refactoring:
- Build tests: ✅
- Audio system tests: ✅
- No breaking changes to public API

The manager pattern makes it easier to add unit tests for individual components in the future.
