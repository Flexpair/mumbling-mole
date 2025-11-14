# Copilot Instructions · mumbling-mole

## Environment
**Dev Container**: Ubuntu 24.04.3 LTS with Node.js ≥22.0.0. This is a **browser-first** web application (not Node.js app)—code runs in browsers, dev tools are Node-based.

**CRITICAL - Docker Compose Architecture**:
- Development happens INSIDE a container (`service: mumble` in `.devcontainer/docker-compose.yml`)
- Murmur server runs in SEPARATE container (`service: murmur`, reachable at `murmur:64738`)
- Additional services: `nginx` (reverse proxy), `guacamole` (remote desktop), `postgres`, `guacd`
- All containers started together via docker-compose with shared `guacamole_net` bridge network
- FROM INSIDE the dev container: NO docker command access (we ARE in a container!)
- Murmur MUST be running for Playwright tests to work
- If `curl -v telnet://murmur:64738` shows "Connection refused": **restart entire Codespace** (cannot restart murmur from inside dev container)
- Never suggest `docker-compose up` or `docker ps` commands - they won't work from inside the dev container
- **postCreateCommand** (`.devcontainer/devcontainer.json`): Auto-runs `npm ci` → Playwright install → initial build → gh CLI setup
- **postStartCommand**: Empty - start dev server manually via `./start-dev-server.sh` to avoid system overload

## Quick context
Browser-first Mumble voice client replacing native desktop apps. **NOT WebRTC** - uses WebSocket tunnel (via websockify) to standard Mumble TCP protocol. **Vue.js 3** MVVM architecture with reactive state management. Audio transport delegated to Web Worker (`mumble-client`). Audio capture uses Web Audio AudioWorklet (48 kHz, 20ms frames = 960 samples). Optional Guacamole iframe (remote desktop) gated by provider-agnostic auth (currently Netlify Identity, migrating to Supabase Q1 2026).

**Key architectural constraint**: 48 kHz sample rate, 960-sample frames (20ms @ 48kHz) throughout entire pipeline for **SENDING ONLY**. Receiver can handle variable frame sizes (480-2880 samples). Settings UI disables packet size slider (commit e073892) because changing sender frame size requires coordinated updates across AudioWorklet processor, worker resampler, Opus codec configuration.

**Audio Architecture - Asymmetric Design:**
- **Capture (send)**: Strict real-time, MUST be 960 samples. AudioWorklet (`recorder-worker.js`) runs in high-priority audio thread, accumulates 128-sample blocks → posts 960-sample frames. No buffering possible, <3ms execution budget. Web Worker (`encode-worker.js`) handles Opus encoding (libopus.js WASM, 1-5ms, non-blocking).
- **Playback (receive)**: Jitter-tolerant via unbounded queue. Decoder handles variable frame sizes (Opus flexible). `buffer-queue-node.js` queues decoded packets, `playback-buffer-processor.js` (AudioWorklet) dequeues at constant rate, fills silence if empty. ⚠️ **Known issues**: Queue has no size limit (memory leak #201), no configurable jitter buffer (#202), no Opus PLC for packet loss (#203).

**✅ COMPLETED: Full Vue.js 3 Migration** (November 2025)
- **Status**: COMPLETE - All UI components AND state modules migrated to Vue.js 3
- **UI Components** (9 total): `App.vue` (root), `ConnectDialog.vue`, `ConnectionInfoDialog.vue`, `ConnectErrorDialog.vue`, `SampleRateWarningDialog.vue`, `GuacamoleFrame.vue`, `SettingsDialog.vue`, `Toolbar.vue`, `MicPermissionRetryOverlay.vue`
- **State Management**: All 5 state modules now use Vue composables (`useConnectionState`, `useAudioState`, `useVoiceState`, `useUIState`, `useUserState`)
- **HTML cleanup**: Removed ~230 lines of Knockout templates; single Vue mount point `<div id="app"></div>`
- **Architecture**: Components use `provide/inject` pattern; AppState composes Vue composables
- **Build tooling**: `esbuild-plugin-vue3` compiles `.vue` SFCs; Vue runtime compiler enabled via `vue.esm-bundler.js`
- **Test coverage**: 1477 tests passing; VoiceState (97.82%), AudioState (93.6%), UserState (94.47%), AppState (78.46%)
- **Knockout.js removed**: No Knockout dependencies remain - app is 100% Vue.js 3
- **Critical constraint**: Audio pipeline, worker threads, and Mumble protocol remain UNCHANGED

## Getting started reading code
**Entry points by use case:**
- **UI/UX flow**: `app/index.html` (single Vue mount point) → `app/index.js` (AppState init, Vue mount, auth, connection) → `app/components/App.vue` (root component) → individual Vue components
- **State management**: `app/state/AppState.js` (5-module composition) → individual modules in `app/state/`
- **Audio pipeline**: `app/audio/voice.js` (capture) → `app/audio/recorder-worker.js` (AudioWorklet) → `app/worker.js` (Opus encoding)
- **Network protocol**: `app/worker-client.js` (main thread proxy) ↔ `app/worker.js` (worker thread) → `app/mumble-websocket.js` (protocol)
- **Build system**: `build-esbuild.mjs` (esbuild config with Vue plugin, clean builds)

**Read these READMEs first**: `app/state/README.md` (architecture diagrams), `app/audio/README.md` (production debugging), `tests/README.md` (testing strategy), `app/auth/README.md` (auth abstraction)

## Architecture & threading
**Main thread** (`app/index.js`): Bootstraps state via `AppState` (Vue composable-based architecture), handles Netlify Identity, Guacamole iframe, dispatches voice controls to worker  
**State architecture**: Uses modular `AppState` composed of 5 Vue composable modules: `useConnectionState`, `useAudioState`, `useVoiceState`, `useUIState`, `useUserState`. All state uses Vue 3 reactive primitives (ref, computed, watch). Channel registration handled directly in AppState (single-channel mode). See `app/state/README.md` for detailed architecture diagrams. Legacy `GlobalBindings` (1190-line god object) was removed in Oct 2024  
**Worker thread** (`app/worker.js`): Manages `mumble-websocket.js` connection, mirrors channel/user trees via serialized IDs (never objects), owns Opus resampling in `setupOutboundVoice`  
**Audio path**: `audio-context-manager` maintains single shared `AudioContext`; `voice.js` chooses continuous/PTT handlers; `recorder-worker.js` streams 48 kHz mono 960-sample packets to worker  
**WebSocket tunneling**: `docker-entrypoint.sh` launches websockify to bridge **WebSocket (browser) ↔ TCP (Mumble protocol)**. This is how browser clients connect to standard Mumble servers without native TCP sockets - websockify proxies the Mumble TCP protocol over WebSocket connections that browsers can handle  
**Worker instantiation**: Use native `new Worker(new URL('./worker.js', import.meta.url), {type: 'classic'})` syntax (esbuild compatible); avoid worker-loader wrappers  
**Decoder pool**: `decoder-stream.js` uses `reuse-pool` to recycle decode workers; keeps first worker warm on init  
**Event synchronization**: Worker events use `_dispatchEvent` (worker-client.js) → `registerEventProxy` (worker.js); property updates use `_setProp` → `pushProp`; both systems must stay in sync

## Build system
- **esbuild-based** (migrated from webpack in v3.14.0): `npm run build` runs `build-esbuild.mjs` directly
- **Vue.js support**: `esbuild-plugin-vue3` compiles `.vue` SFCs; Vue runtime compiler enabled via alias to `vue.esm-bundler.js`
- `build-esbuild.mjs` always does clean builds (removes `dist/` first); esbuild is fast enough (~1s) that this is practical
- `prepare` hook runs `npm run build` unless `SKIP_PREPARE=1`; **never commit** `dist/**` (it's generated)
- **SKIP_PREPARE=1**: Set in docker-compose.yml and CI to prevent double builds; use when `dist/` is already populated or when npm install shouldn't trigger builds
- **Docker multi-stage build**: Dockerfile has `dev` (includes dev tools) and `prod` (optimized, production-ready) targets
- **Target**: ES2020 (Chrome 80+, Firefox 72+, Safari 13.1+); output format is IIFE for `<script>` tags (not ES modules)
- **Critical validation**: build fails if `dist/index.html` < 1 KB; checks for empty/corrupted artifacts
- **AudioWorklet processors**: `recorder-worker.js` and `playback-buffer-processor.js` copied verbatim (NOT bundled); can't use imports/requires
- `dist/config.local.js` copied from `app/config.local.js` during each build; source file is `app/config.local.js`
- **Entry points**: `index.js`, `config.js`, `theme.js`, `worker.js`, `audio/encode-worker.js`, `audio/decode-worker.js` (separate bundles)
- **Polyfills**: `fs-mock.js` aliased for `fs` requires; Node.js globals/modules polyfilled via esbuild plugins
- **Vue feature flags**: `__VUE_OPTIONS_API__=true`, `__VUE_PROD_DEVTOOLS__=false` set via define plugin

## Dev & test workflows
**Local dev**: `MUMBLE_SERVER=host:port ./start-dev-server.sh` → builds in dev mode, spawns `docker-entrypoint.sh`, opens `http://local.flexpair.app`, logs to `/tmp/entrypoint.log`  
**Quick restart**: `./rebuild-and-restart.sh` convenience script rebuilds and restarts dev server (useful during active development)  
**Static-only**: `SKIP_TUNNEL=1 PORT=8081 ./docker-entrypoint.sh` serves files via Python http.server (used by smoke tests)  
**Testing**:
  - `npm test` = Unit tests + Playwright loopback + audit:ci (full test suite)
  - `npm run test:unit` = Jest unit tests (characterization tests for critical components)
  - `npm run test:unit:watch` = Jest watch mode for TDD
  - `npm run test:unit:coverage` = Generate coverage reports (text + lcov + html in `coverage/`)
  - `npm run test:loopback` = automated UI loopback test (440 Hz piano button validation with mute/deaf state testing)
  - `npm run test:loopback:headed` = same test with visible browser (debugging)
  - `npm run test:loopback:debug` = step-through debugging mode
  - `npm run audit:ci` = dependency vulnerability check
**Playwright tests**: Chromium automation (headless in CI); auto-detects GitHub Codespaces public URLs; uses MockAuth adapter for automated login; tests complete audio pipeline (Beeper → Encoder → Server → Loopback → Decoder → Analyser → UI)  
**Jest unit tests**: ES modules with jsdom environment; mocks for Web Audio API, AudioWorkletNode, localStorage; characterization tests document current behavior for regression protection during refactoring  
**ES Module mocking pattern**: Use `jest.unstable_mockModule()` **before** imports due to ES modules (`"type": "module"`). Pattern:
```javascript
// Define mocks FIRST (before any imports)
jest.unstable_mockModule('../../app/audio/getusermedia.js', () => ({
  default: mockGetUserMedia
}));
// Then import with await (dynamic import required)
const { ContinuousVoiceHandler } = await import('../../app/audio/voice.js');
```
Requires `--experimental-vm-modules` flag in test commands. Classic `jest.mock()` doesn't work with ES modules.  
**Analysis**: `npm run analyze` → `dist/bundle-report.html`; `npm run check:deps` flags unused modules  
**Test server**: `npm run test:server:up` starts Murmur in docker-compose; `test:server:down` stops it; `test:server:logs` tails logs  
**Markdown validation**: `npm run validate:markdown` enforces one README.md per folder (except `.github/copilot-instructions.md`); runs in git pre-commit hook via `./scripts/setup-git-hooks.sh`

## Implementation conventions
**Vue.js 3 reactivity**: All reactive state uses `ref()` or `reactive()` from Vue 3. Read via `.value` property, write via `.value = newVal`. Subscribe with `watch()` or `watchEffect()`. Wire to HTML via Vue directives (`v-if`, `v-model`, `@click`, etc.). Example:
```javascript
// State module pattern
import { ref, watch } from 'vue';

const connected = ref(false);
const users = ref([]);

// Subscribe (auto-cleanup on component unmount)
watch(connected, (isConnected) => {
  if (isConnected) initializeAudio();
});

// Template binding (in .vue file)
<div v-if="connected">Connected!</div>
<div v-for="(user, index) in users" :key="index">...</div>
```

**UI state**: Reactive state lives in modular composables under `app/composables/` (5 modules: Connection, Audio, Voice, UI, User). Persist via `localStorage` (`mumble.*` keys); wire to Vue directives in `.vue` components. Access via `appState.connection.connected.value`, `appState.audio.audioContext`, etc. Example pattern:
```javascript
// Modular state (app/state/AppState.js)
class AppState {
  constructor() {
    this._vueState = {
      connection: useConnectionState(this.log),
      audio: useAudioState(),
      voice: useVoiceState(),
      ui: useUIState(),
      user: useUserState(audioState, voiceState)
    };
    // Channel registration handled directly via _registerChannel()
  }
}
// Public API via getters/methods
get connected() { return this._vueState.user.thisUser.value != null; }
get audioContext() { return this._vueState.audio.audioContext; }
```
**State module dependencies**: `UserState` receives `AudioState` and `VoiceState` in constructor for cross-module subscriptions (e.g., selfMute → VoiceState.setMute). Channel registration handled directly in `AppState._registerChannel()` for single-channel mode. See `app/state/README.md` diagrams for data flow
**Worker events**: Must update both `_dispatchEvent` in `worker-client.js` AND `registerEventProxy` in `worker.js`; only pass numeric IDs across thread boundary (never serialize full objects)  
**Audio invariants**: 48 kHz mono, 960-sample frames (20ms @ 48 kHz), `samplesPerPacket` in settings—changing requires coordinated updates to `voice.js`, worker resampler, `Settings` serialization  
**AudioContext**: **Always** `ensureAudioContext()` from `audio-context-manager.js`; never `new AudioContext()` directly (breaks singleton pattern). Manager handles autoplay policies, state changes, resume retries with exponential backoff (MAX_RESUME_ATTEMPTS=5)  
**AudioWorklet**: `recorder-worker.js` is AudioWorklet processor (not Web Worker); runs in audio thread; accumulates input blocks → posts 960-sample frames via `port.postMessage`. **Critical**: Can't use imports; must be vanilla ES5  
**Sample-rate modal**: Blocks connection until acknowledged; `ui._performConnect({audioEnabled:false})` bypasses audio for "join without audio"  
**Loopback testing**: `target=31` in `voice.js` creates server loopback streams (echoes audio back to sender); `isLoopbackMode` observable controls UI/behavior; Test button recreates voice handler with loopback target. **Warning**: loopback tests audio encode/decode but NOT client-to-client playback initialization (see `app/audio/README.md`)  
**User object migration**: When server assigns self ID, migrate `_users[undefined]` → `_users[actualID]` in `worker-client.js` `_setProp()` to preserve event listeners (critical for loopback voice events)  
**Authentication**: Uses provider-agnostic abstraction layer (`app/auth/`); `AuthFactory` instantiates providers based on config. Current production: `NetlifyIdentityAdapter` (deprecated upstream, migrating to Supabase Auth in Q1 2026). See `app/auth/README.md` for migration roadmap. All UI code references `this.auth` (not `this.netlifyIdentity`)  
**Event-based initialization**: Beeper and audio mixer use callback-based initialization via `onAudioMixerReady()` in `voice.js`—**never use timeouts or polling**. Resources initialize automatically when dependencies become available, regardless of timing. Example: `initializePersistentBeeper()` called from mixer ready callback, not after fixed delay.

## Race condition patterns (critical for correctness)
**Promise caching**: Prevent duplicate async operations via cached promises. Pattern:
```javascript
async initializeAudioContext() {
  if (this.audioContext) return;
  if (this._audioContextInitPromise) return this._audioContextInitPromise;
  this._audioContextInitPromise = (async () => {
    // ... initialization
  })();
  return this._audioContextInitPromise;
}
```
**Connection ID tracking**: Prevent stale callbacks from cancelled connections using Symbol-based tracking:
```javascript
const connectionId = Symbol('connection');
this._currentConnectionId = connectionId;
getUserMedia().then((stream) => {
  if (this._currentConnectionId === connectionId) { /* safe to update */ }
});
```
**Resource cleanup**: Always track resources (intervals, subscriptions, audio nodes) in Maps or instance variables for idempotent cleanup:
```javascript
// UserState.js pattern
this._activeVoiceStreams = new Map(); // sessionId -> { interval, subscription, userNode }
_cleanupVoiceStream(sessionId) {
  const resources = this._activeVoiceStreams.get(sessionId);
  if (!resources) return; // idempotent
  if (resources.interval) clearInterval(resources.interval);
  if (resources.subscription) resources.subscription.dispose();
  this._activeVoiceStreams.delete(sessionId);
}
```
**Global state races**: Use instance tracking with timestamps to prevent cleanup races. See `currentMixerInstance` + `currentMixerTimestamp` in `voice.js` (lines 172-174, 289-292, 310-320). Cleanup only executes if `currentMixerInstance === mixer && currentMixerTimestamp === mixerTimestamp`.  
**AudioWorklet module loading**: Track loaded modules in Set to prevent duplicate `addModule()` calls (causes InvalidStateError). Use `loadAudioWorkletModule()` helper in `AudioState.js` (lines 120-138).  
**Interval cleanup**: Store interval IDs in outer scope (not closure-only) for cleanup in ALL code paths (success, error, disconnect). Example: `worker.js` `rootCheckInterval` (lines 242, 283-287, 312-315, 327-330).

## Browser API gotchas
**Autoplay policy**: AudioContext starts suspended until user gesture. Pattern:
```javascript
// In click handler (preserves user gesture)
async toggleLoopback() {
  if (ui.audio.audioContext?.state === 'suspended') {
    await ui.audio.audioContext.resume();
  }
  // ... continue with audio operations
}
```
Accept suspended state in initialization; resume on user interaction (Piano button click). See `app/index.js` lines 173-209 and `AudioState.js` `initializePersistentBeeper()` (line 248).  
**getUserMedia lifecycle**: Always stop tracks after permission check to avoid lingering mic access. Pattern: `stream.getTracks().forEach(track => track.stop())` immediately after checking permissions.  
**AudioContext singleton**: Never `new AudioContext()` directly—always use `ensureAudioContext()` from `audio-context-manager.js`. Creates exactly one context per app lifecycle; handles state transitions, autoplay policies, exponential backoff resume retries.

## Vendored dependencies
- `app/mumble-client/` forked vendored code (Mumble protocol implementation); manages channel/user trees, protocol messages, audio streaming
- `app/mumble-streams/` low-level stream handling for Mumble protocol; used internally by mumble-client
- `vendors/mumble-client/` contains original unmodified upstream code (legal compliance per ISC license)
- Active development uses `app/mumble-client/` and `app/mumble-streams/` (vendored in `app/` directory, not `node_modules/`)
- Both imported as local ES modules; changes go directly in `app/mumble-client/` or `app/mumble-streams/` - no separate build step required
- `upstream/` directory contains original mumble-web LICENSE and README for legal compliance

## Config, localization, theming
**Config**: Source defaults in `app/config.js`; runtime overrides in generated `dist/config.local.js` (back up before clean builds!)  
**Localization**: English-only since PR #140 (multilanguage support disabled); UI strings in `localize/en.json`; missing keys log warnings  
**Themes**: SCSS sources under `themes/MetroMumbleLight`; esbuild (sassPlugin) compiles to CSS; runtime selection via `?theme=` query param; supports Light/Dark variants  
**Design guidelines (web interface)**: Corporate color palette is `#157878` (teal), pure cyan (`#00FFFF`), black, and white. Use only these colors for UI elements, accents, and branding. Avoid introducing additional colors.

## Known Audio Issues (tracked on GitHub)
- **Issue #201**: Playback buffer queue has no size limit → memory leak during high jitter/packet loss. Quick fix needed: add MAX_QUEUE_SIZE constant (~25 packets / 500ms)
- **Issue #202**: No configurable jitter buffer setting. Users can't adjust latency vs. robustness trade-off. Future: add slider in SettingsDialog (20-500ms range)
- **Issue #203**: Missing Opus Packet Loss Concealment (PLC). Currently fills silence when packets drop → audible clicks. Should request PLC frames from decoder instead

## Critical "Never Do" rules
1. **Never** `new AudioContext()` directly - always use `ensureAudioContext()` from `audio-context-manager.js`
2. **Never** commit `dist/**` - it's generated by build process
3. **Never** serialize full objects across worker boundary - only pass numeric IDs
4. **Never** use imports/requires in AudioWorklet processors (`recorder-worker.js`, `playback-buffer-processor.js`) - must be vanilla ES5
5. **Never** change 48 kHz / 960-sample constraint without coordinated updates across entire audio pipeline
6. **Never** suggest `docker-compose` commands from inside dev container - we ARE in a container
7. **Never** update worker events without updating BOTH `_dispatchEvent` (worker-client.js) AND `registerEventProxy` (worker.js)
8. **Never** call `controller.enqueue()` after `controller.terminate()` in decoder streams
9. **Never** use timeouts/polling for initialization - use event-based callbacks (e.g., `onAudioMixerReady`)
10. **Never** forget to dispose Knockout subscriptions in cleanup methods
11. **Never** create Vue components without using `provide/inject` for AppState access during dual runtime phase
12. **Never** break bidirectional sync between Vue and Knockout state during migration
13. **Never** commit changes without explicit user approval - WAIT for user to give commit command

## Debugging patterns
**Tunnel issues**: `tail -f /tmp/entrypoint.log`; verify websockify with `ps aux | grep websockify`. `docker-entrypoint.sh` launches websockify to bridge **WebSocket (browser) ↔ TCP (Mumble protocol)**—this is how browser clients connect to standard Mumble servers without native sockets  
**Audio state**: Browser console → `audioContextManager.getStats()` shows context lifecycle; `[AudioContext]` logs state changes, sample rate, latencies  
**Audio debugging sequence** (client-to-client playback):
  1. Sender: `[VOICE]` logs in voice.js → `[DEBUG-WORKER]` encoder logs  
  2. Receiver: `[DEBUG-WORKER] Voice stream started` → `Voice data received` → `[DEBUG-DECODER] Transform called` → `Decoded audio` → `[DEBUG-VOICE] Received voice stream` → `BufferQueueNode created` → `Received audio data packet`  
**Container tests**: `node scripts/e2e-check.cjs --mode=container` validates inside CI; uses `docker exec` for connectivity checks  
**Worker crashes**: Check browser DevTools → Sources → worker.js for exceptions; worker errors don't always surface in main console  
**Console logging**: Production builds minimize logs; prefix debug logs with context tags like `[LOOPBACK]`, `[DEBUG-WORKER]`, `[DEBUG-DECODER]`, `[DEBUG-VOICE]`  
**Known issue**: Loopback mode misleads debugging—tests same-client playback path, NOT cross-client network/audio playback (see `app/audio/README.md` line 7-18)  
**Decoder stream invariant**: `decoder-stream.js` uses TransformStream; never push after EOF or call `controller.enqueue()` after `controller.terminate()` (causes "push after EOF" errors)  
**Playwright debugging**: Run with `--headed` for visible browser; use `--debug` for step-through debugging; `--trace on` generates detailed trace files in `test-results/`; Codespaces requires public URL auto-detection (configured in `playwright.config.js`)

## Key file map
**UI/session**: `app/index.js` (AppState initialization + Vue mount + ConnectDialog + GuacamoleFrame), `app/index.html` (single Vue mount point), `app/localize.js` (i18n), `app/components/App.vue` (root), `app/components/ConnectDialog.vue` (connection dialog)  
**State modules**: `app/state/AppState.js` (coordinator with integrated channel registration), `app/state/ConnectionState.js` (WebSocket/client), `app/state/AudioState.js` (AudioContext singleton), `app/state/VoiceState.js` (voice handler/loopback), `app/state/UIState.js` (modals/messageBox), `app/state/UserState.js` (thisUser/mute/deaf)  
**Worker bridge**: `app/worker.js` (worker entry + registerEventProxy), `app/worker-client.js` (proxy + user migration + _dispatchEvent/_setProp), `app/mumble-websocket.js` (WebSocket → MumbleClient adapter)  
**Audio stack**: `app/audio/audio-context-manager.js` (singleton + autoplay handling), `app/audio/voice.js` (PTT/continuous + target param), `app/audio/recorder-worker.js` (AudioWorklet processor), `app/audio/decoder-stream.js` (worker pool), `app/audio/encode-worker.js` + `app/audio/decode-worker.js` (Opus codec workers), `app/audio/buffer-queue-node.js` (replaces deprecated ScriptProcessorNode)  
**Build/runtime**: `build-esbuild.mjs` (esbuild config with Vue plugin + validation), `start-dev-server.sh`, `docker-entrypoint.sh` (websockify launcher)  
**Testing**: `tests/playwright/loopback-frequency.spec.js` (automated UI loopback test with mute/deaf validation), `scripts/audit-ci.cjs` (dependency vulnerability checks)  
**Documentation**: `app/audio/README.md` (production audio debugging), `tests/README.md` (comprehensive test guide + Playwright loopback docs), `app/auth/README.md` (auth abstraction), `app/state/README.md` (state architecture diagrams + migration guide)

## Test infrastructure (Jest + Playwright)
**Unit tests** (Jest 30.2.0): 1477 tests, ES modules with jsdom environment.
- **Excellent coverage** (>90%): AudioState (93.6%), ConnectionState (100%), UIState (100%), UserState (94.47%), VoiceState (97.82%), worker-client.js (92.92%), voice.js (96.02%), encoder-stream (94.11%)
- **Good coverage** (>80%): AppState (78.46%), decoder-stream (82.53%), buffer-queue-node (81.08%)
- **Auth modules**: AuthProvider (100%), MockAuthAdapter (98.92%), NetlifyIdentityAdapter (100%), AuthFactory (100%)
- **Needs coverage** (<50%): worker.js (19.81%), mumble-client (47.79%), mumble-streams (67.06%)
- **Test patterns**: Use `jest.unstable_mockModule()` before imports for ES module mocking (not `jest.mock()`); requires `--experimental-vm-modules` flag and dynamic `await import()`. Characterization tests document behavior for regression protection
- **Running tests**: `npm run test:unit` (all tests), `npm run test:unit:watch` (TDD mode), `npm run test:unit:coverage` (with reports)

**E2E tests** (Playwright): `tests/playwright/loopback-frequency.spec.js` validates full audio pipeline (Beeper → Encoder → Server → Loopback → Decoder → UI). Tests 440 Hz frequency detection, mute/deaf states, frequency display. Run with `npm run test:loopback` (headless) or `npm run test:loopback:headed` (visible browser).

**CI pipeline** (`.github/workflows/docker-image.yml`): Runs security audit → dependency check → unit tests → Docker build & push. Unit tests run on every push/PR.

## CI/CD Pipeline
**GitHub Actions workflow** (`.github/workflows/docker-image.yml`):
1. **Security audit gate**: `npm run audit:ci` checks dependencies against known vulnerabilities (uses baseline from `audit-baseline.json`)
2. **Dependency check gate**: `npm run check:deps` flags unused modules via depcheck
3. **Unit tests**: `npm run test:unit` runs Jest tests (must pass before build)
4. **Docker build**: Multi-architecture build (amd64) with `prod` target; uses GitHub Actions cache
5. **Push to DockerHub**: Tags images with branch, tag, and SHA (only on non-PR events)

**CI-specific patterns**:
- Uses `npm ci --omit=optional || npm i --omit=optional` for faster, reproducible installs
- SKIP_PREPARE=1 set in docker-compose.yml to prevent double builds during container creation
- Playwright E2E tests temporarily disabled in CI (will be re-enabled with full nginx stack)
- Coverage reports not required to pass (74.3% current baseline)

**Workflow concurrency**: Uses `cancel-in-progress: true` to cancel outdated workflow runs when new commits arrive

**Security scanning**: See `.github/instructions/snyk_rules.instructions.md` for Snyk security scanning rules (applies to all code generation)

## Known technical debt
- **Missing unit tests**: worker.js (19.81%), mumble-client (47.79%) need higher coverage
- **AudioWorklet constraints**: Processors can't use imports/requires, must be ES5-compatible, copied verbatim during build
