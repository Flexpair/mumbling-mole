# Copilot Instructions · mumbling-mole

## Quick context
Browser-first Mumble voice client: Knockout.js UI delegates audio transport to a Web Worker (`mumble-client`). Audio capture uses Web Audio AudioWorklet; UI also gates Guacamole iframe after Netlify Identity auth.

## Architecture & threading
**Main thread** (`app/index.js`): Bootstraps `GlobalBindings` observables (1474 lines, god object pattern—all UI state centralized here), handles Netlify Identity, Guacamole iframe, dispatches voice controls to worker  
**Worker thread** (`app/worker.js`): Manages `mumble-websocket.js` connection, mirrors channel/user trees via serialized IDs (never objects), owns Opus resampling in `setupOutboundVoice`  
**Audio path**: `audio-context-manager` maintains single shared `AudioContext`; `voice.js` chooses continuous/PTT handlers; `recorder-worker.js` streams 48 kHz mono 960-sample packets to worker  
**Worker instantiation**: Use native `new Worker(new URL('./worker.js', import.meta.url), {type: 'classic'})` syntax (Webpack 5 compatible); avoid worker-loader wrappers  
**Decoder pool**: `decoder-stream.js` uses `reuse-pool` to recycle decode workers; keeps first worker warm on init  
**Event synchronization**: Worker events use `_dispatchEvent` (worker-client.js) → `registerEventProxy` (worker.js); property updates use `_setProp` → `pushProp`; both systems must stay in sync

## Build system
- `npm run build` or `WEBPACK_MODE=development ./smart-build.sh` uses `dist/.build-marker` for incremental builds
- `smart-build.sh --force` wipes `dist/` entirely; auto-babels `vendors/mumble-client` when `lib/` missing
- `prepare` hook runs smart-build unless `SKIP_PREPARE=1`; **never commit** `dist/**` (it's generated)
- Webpack 5 config: `babel-loader` for ES6+ **except** AudioWorklet processors (`recorder-worker.js`, `playback-buffer-processor.js`) which must stay ES5-compatible and are copied verbatim
- **Critical validation**: build fails if `dist/index.html` < 1 KB; checks for empty/corrupted artifacts
- **Vendor rebuild**: `npm run build:vendor:mumble-client` transpiles `vendors/mumble-client/src/` → `lib/` (required after editing vendored source)
- `dist/config.local.js` copied from `app/config.local.js` if missing; **back up before clean builds**
- **AudioWorklet exclusion**: webpack.config.js explicitly excludes `recorder-worker.js` and `playback-buffer-processor.js` from babel-loader; AudioWorklet processors can't use imports/requires

## Dev & test workflows
**Local dev**: `MUMBLE_SERVER=host:port ./start-dev-server.sh` → builds in dev mode, spawns `docker-entrypoint.sh`, opens `http://local.flexpair.app`, logs to `/tmp/entrypoint.log`  
**Static-only**: `SKIP_TUNNEL=1 PORT=8081 ./docker-entrypoint.sh` serves files via Python http.server (used by smoke tests)  
**Testing** (no unit tests exist; only integration/E2E):
  - `npm run test:audio:system` = fastest; validates build artifacts, codecs, worker syntax (no server required)
  - `npm run test:e2e` = WebSocket smoke test (checks websockify tunnel + HTTP serving)
  - `npm run test` = runs `./scripts/run-all-tests.sh` (E2E + audio + audit combined)
  - `npm run test:audio` = single roundtrip test (sends 440 Hz sine wave to live server)
  - `./scripts/quick-audio-test.sh` = all-in-one (starts test server, runs tests, cleans up)
**E2E modes**: `node scripts/e2e-check.cjs` (local) vs `--mode=container` (CI); set `PLAIN_TARGET=1` for non-TLS echo servers  
**Analysis**: `npm run analyze` → `dist/bundle-report.html`; `npm run check:deps` flags unused modules  
**Test server**: `npm run test:server:up` starts Murmur in docker-compose; `test:server:down` stops it; `test:server:logs` tails logs  
**Markdown validation**: `npm run validate:markdown` enforces one README.md per folder (except `.github/copilot-instructions.md`); runs in git pre-commit hook via `./scripts/setup-git-hooks.sh`

## Implementation conventions
**UI state**: All observables live in `GlobalBindings` (never scattered); persist via `localStorage` (`mumble.*` keys); wire to Knockout bindings in `app/index.html`. Example pattern:
```javascript
// GlobalBindings centralization (index.js line 421+)
class GlobalBindings {
  constructor() {
    this.connected = ko.observable(false);
    this.isLoopbackMode = ko.observable(false);
    // ... 100+ more observables
  }
}
```
**Worker events**: Must update both `_dispatchEvent` in `worker-client.js` AND `registerEventProxy` in `worker.js`; only pass numeric IDs across thread boundary (never serialize full objects)  
**Audio invariants**: 48 kHz mono, 960-sample frames (20ms @ 48 kHz), `samplesPerPacket` in settings—changing requires coordinated updates to `voice.js`, worker resampler, `Settings` serialization  
**AudioContext**: **Always** `ensureAudioContext()` from `audio-context-manager.js`; never `new AudioContext()` directly (breaks singleton pattern). Manager handles autoplay policies, state changes, resume retries with exponential backoff (MAX_RESUME_ATTEMPTS=5)  
**AudioWorklet**: `recorder-worker.js` is AudioWorklet processor (not Web Worker); runs in audio thread; accumulates input blocks → posts 960-sample frames via `port.postMessage`. **Critical**: Can't use imports; must be vanilla ES5  
**Sample-rate modal**: Blocks connection until acknowledged; `ui._performConnect({audioEnabled:false})` bypasses audio for "join without audio"  
**Loopback testing**: `target=31` in `voice.js` creates server loopback streams (echoes audio back to sender); `isLoopbackMode` observable controls UI/behavior; Test button recreates voice handler with loopback target. **Warning**: loopback tests audio encode/decode but NOT client-to-client playback initialization (see `app/audio/README.md`)  
**User object migration**: When server assigns self ID, migrate `_users[undefined]` → `_users[actualID]` in `worker-client.js` `_setProp()` to preserve event listeners (critical for loopback voice events)  
**Authentication**: Uses provider-agnostic abstraction layer (`app/auth/`); `AuthFactory` instantiates providers based on config. Current production: `NetlifyIdentityAdapter` (deprecated upstream, migrating to Supabase Auth in Q1 2026). See `app/auth/README.md` for migration roadmap. All UI code references `this.auth` (not `this.netlifyIdentity`)

## Vendored dependencies
- `vendors/mumble-client` is `file:` protocol dep (not npm registry); after editing `src/`, run `npm run build:vendor:mumble-client` to refresh `lib/`
- `vendors/netlify-identity-widget` ships as-is; UI expects `window.netlifyIdentity` global before auth flows
- `vendors/mumble-streams` used internally by mumble-client
- **Deprecated**: `vendors/web-audio-buffer-queue` (replaced by native `app/audio/buffer-queue-node.js` using AudioWorklet instead of deprecated ScriptProcessorNode)

## Config, localization, theming
**Config**: Source defaults in `app/config.js`; runtime overrides in generated `dist/config.local.js` (back up before clean builds!)  
**Localization**: English-only since PR #140 (multilanguage support disabled); UI strings in `localize/en.json`; missing keys log warnings  
**Themes**: SCSS sources under `themes/MetroMumbleLight`; Webpack compiles to CSS; runtime selection via `?theme=` query param; supports Light/Dark variants

## Debugging patterns
**Tunnel issues**: `tail -f /tmp/entrypoint.log`; verify websockify with `ps aux | grep websockify`; docker-entrypoint.sh uses websockify to bridge WebSocket ↔ TCP Mumble protocol  
**Audio state**: Browser console → `audioContextManager.getStats()` shows context lifecycle; `[AudioContext]` logs state changes, sample rate, latencies  
**Audio debugging sequence** (client-to-client playback):
  1. Sender: `[VOICE]` logs in voice.js → `[DEBUG-WORKER]` encoder logs  
  2. Receiver: `[DEBUG-WORKER] Voice stream started` → `Voice data received` → `[DEBUG-DECODER] Transform called` → `Decoded audio` → `[DEBUG-VOICE] Received voice stream` → `BufferQueueNode created` → `Received audio data packet`  
**Container tests**: `node scripts/e2e-check.cjs --mode=container` validates inside CI; uses `docker exec` for connectivity checks  
**Worker crashes**: Check browser DevTools → Sources → worker.js for exceptions; worker errors don't always surface in main console  
**Console logging**: Production builds minimize logs; prefix debug logs with context tags like `[LOOPBACK]`, `[DEBUG-WORKER]`, `[DEBUG-DECODER]`, `[DEBUG-VOICE]`  
**Known issue**: Loopback mode misleads debugging—tests same-client playback path, NOT cross-client network/audio playback (see `app/audio/README.md` line 7-18)

## Key file map
**UI/session**: `app/index.js` (GlobalBindings + ConnectDialog + GuacamoleFrame), `app/index.html` (Knockout templates), `app/localize.js` (i18n)  
**Worker bridge**: `app/worker.js` (worker entry + registerEventProxy), `app/worker-client.js` (proxy + user migration + _dispatchEvent/_setProp), `app/mumble-websocket.js` (WebSocket → MumbleClient adapter)  
**Audio stack**: `app/audio/audio-context-manager.js` (singleton + autoplay handling), `app/audio/voice.js` (PTT/continuous + target param), `app/audio/recorder-worker.js` (AudioWorklet processor), `app/audio/decoder-stream.js` (worker pool), `app/audio/encode-worker.js` + `app/audio/decode-worker.js` (Opus codec workers), `app/audio/buffer-queue-node.js` (replaces deprecated ScriptProcessorNode)  
**Build/runtime**: `smart-build.sh` (incremental build logic), `webpack.config.js`, `start-dev-server.sh`, `docker-entrypoint.sh` (websockify launcher), `scripts/e2e-check.cjs` (smoke test)  
**Testing**: `scripts/audio-system-test.cjs` (offline validation), `scripts/audio-test.cjs` (live roundtrip), `scripts/audio-monitor.cjs` (realtime VU meter), `scripts/run-all-tests.sh` (primary test runner)  
**Documentation**: `app/audio/README.md` (production audio debugging), `tests/README.md` (comprehensive test guide), `app/auth/README.md` (auth abstraction)

## Known technical debt
- **No unit tests**: Zero test files for application code; only integration tests exist (see `tests/README.md`)
- **Build complexity**: `smart-build.sh` + webpack + vendor transpilation creates fragile incremental builds; consider consolidation
- **GlobalBindings anti-pattern**: 1474-line god object centralizes all UI state; refactoring would improve maintainability
- **AudioWorklet constraints**: Processors can't use imports/requires, must be ES5-compatible, copied verbatim during build
