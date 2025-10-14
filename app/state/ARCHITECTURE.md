# Architecture Diagrams

## Module Dependency Graph

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

┌────────────────────────────────────────────────────────────────┐
│ ChannelState                                                   │
├────────────────────────────────────────────────────────────────┤
│ • Root channel tracking                                       │
│ • Channel registration and event handling                     │
│ • Channel linking (linked channels)                           │
└────────────────────────────────────────────────────────────────┘
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
  ├─ ChannelState.js
  └─ AppState.js (coordinator)

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
