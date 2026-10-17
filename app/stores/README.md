# Pinia Store Architecture

The application state layer is implemented with Vue 3 and Pinia. Stores live in `app/stores/` and are installed when the Vue application is created in `app/index.js`. Components use Pinia actions for mutations and `storeToRefs()` when destructuring reactive state.

## Stores

The current store set has seven logical stores:

| Store | Responsibility |
| --- | --- |
| `connectionStore` | WebSocket/Mumble connection lifecycle, server settings, and connection state |
| `audioStore` | Shared `AudioContext`, microphone permission state, audio lock state, and test tone |
| `voiceStore` | Voice-handler lifecycle, mute routing, and loopback mode |
| `uiStore` | Selection, settings, message-box, and general UI state |
| `userStore` | Current user, mute/deaf state, user registration, and remote voice playback |
| `settingsStore` | User-facing audio and connection preferences |
| `dialogStore` | Connection, error, information, and sample-rate warning dialogs |

The four older dialog concerns are represented by `dialogStore`; compatibility exports may remain for callers that have not moved to the consolidated store. They are not separate state owners.

## State flow

```text
Vue component
    │  action / storeToRefs()
    ▼
Pinia store
    ├─ connectionStore ── WebSocket/Mumble worker
    ├─ audioStore ─────── AudioContext and microphone lifecycle
    ├─ voiceStore ─────── encoder and voice routing
    ├─ userStore ──────── user and remote-stream events
    ├─ uiStore/dialogStore ── visible application state
    └─ settingsStore ─── persisted preferences
```

The Mumble protocol and codec work remain in workers. Stores coordinate browser state and call the worker bridge; they do not move the protocol into Vue components.

## Connection and audio lifecycle

1. The app creates the Pinia instance and initializes the authentication boundary.
2. A connection action prepares the shared audio context and microphone path.
3. `connectionStore` starts the WebSocket/Mumble client and subscribes to worker events.
4. `userStore` registers the current and remote users.
5. `voiceStore` creates or updates the voice handler and selects normal or loopback routing.
6. `uiStore` and `dialogStore` expose connection progress, errors, settings, and audio warnings to Vue components.

Audio initialization is shared. Code must use the existing audio-context manager rather than constructing an unrelated `AudioContext`, otherwise browser autoplay and sample-rate handling can diverge between stores.

## Compatibility boundary

Some older integrations expose a compatibility surface through the application UI object. That surface delegates to Pinia-backed state and should not be extended for new features. New code should import and use the relevant `use*Store()` function directly. Remove a compatibility alias only together with its remaining callers and tests.

## Testing

Store behavior is covered by Jest tests under `__tests__/`, which are discovered by:

```text
**/__tests__/**/*.test.js
```

Run the unit suite or its coverage variant with:

```bash
npm run build:local
npm run test:unit
npm run test:unit:coverage
```

The Playwright loopback suite validates the cross-store audio path in a real Chromium context. It is separate from Jest and lives under `tests/playwright/`; see [../../tests/playwright/README.md](../../tests/playwright/README.md).

## Adding or changing a store

1. Keep one domain responsibility per store.
2. Expose state through Pinia state/getters and mutations through named actions.
3. Use `storeToRefs()` in components when destructuring reactive values.
4. Preserve the shared audio-context and 48 kHz / 960-sample voice contract.
5. Add or update Jest coverage for state transitions and cleanup.
6. Add a Playwright assertion when the change affects the user-visible audio or connection flow.
