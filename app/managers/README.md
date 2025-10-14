# Managers

This directory contains manager classes extracted from the GlobalBindings god object to improve code organization and maintainability.

## Architecture

The managers follow a delegation pattern where GlobalBindings retains UI state (Knockout observables) but delegates business logic to focused managers:

```
GlobalBindings (UI State & Coordination)
    ├── AudioManager (Audio subsystem)
    ├── ConnectionManager (Client lifecycle)
    └── UserChannelManager (Channel/user tree)
```

## Manager Classes

### AudioManager.js
**Responsibilities:**
- AudioContext lifecycle management
- Beeper (test tone) functionality  
- Microphone permission handling
- Voice handler readiness tracking

**Key Methods:**
- `initializeAudioContext()` - Initialize AudioContext with autoplay policy handling
- `startBeep()` / `stopBeep()` - Control test tone for latency testing
- `retryMicrophonePermission()` - Request microphone access
- `reset()` - Clean up audio state on disconnect

### ConnectionManager.js
**Responsibilities:**
- Mumble client connection lifecycle
- Loopback mode management
- Connection state tracking

**Key Methods:**
- `getClient()` / `setClient()` - Access client instance
- `isConnected()` - Check connection status
- `resetClient()` - Disconnect and clean up

### UserChannelManager.js
**Responsibilities:**
- Creating UI proxies for users (`_newUser`)
- Creating UI proxies for channels (`_newChannel`)  
- Managing channel linking (`_updateLinks`)
- Voice stream event handling

**Key Methods:**
- `_newUser(user, compareUsers, userToState, openContextMenu)` - Initialize user UI
- `_newChannel(channel, compareChannels, openContextMenu)` - Initialize channel UI
- `_updateLinks()` - Update channel link indicators

## Integration Pattern

Managers are instantiated in GlobalBindings constructor and receive references to observables they need:

```javascript
this.audioManager = new AudioManager({
  isBeeping: this.isBeeping,
  beeperReady: this.beeperReady,
  // ... other observables
});
```

GlobalBindings methods delegate to managers:

```javascript
this.startBeep = () => this.audioManager.startBeep();
this._newUser = (user) => this.userChannelManager._newUser(user, compareUsers, userToState, openContextMenu);
```

## Benefits

1. **Separation of Concerns**: Each manager has a single, well-defined responsibility
2. **Testability**: Managers can be unit tested independently  
3. **Maintainability**: Smaller, focused classes are easier to understand and modify
4. **Reusability**: Managers could potentially be reused in other contexts

## Migration Notes

- GlobalBindings still owns all Knockout observables (UI state)
- Managers receive observable references, not values
- Context menus and comparison functions remain in GlobalBindings (UI-specific)
- The refactoring maintains 100% backward compatibility with existing UI bindings
