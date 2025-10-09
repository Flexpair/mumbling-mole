# Copilot Instructions · mumbling-mole

## Quick context
Browser-first Mumble voice client: Knockout.js UI delegates audio transport to a Web Worker (`mumble-client`). Audio capture uses Web Audio AudioWorklet; UI also gates Guacamole iframe after Netlify Identity auth.

## Architecture & threading
**Main thread** (`app/index.js`): Bootstraps `GlobalBindings` observables, handles Netlify Identity, Guacamole iframe, dispatches voice controls to worker  
**Worker thread** (`app/worker.js`): Manages `mumble-websocket.js` connection, mirrors channel/user trees via serialized IDs (never objects), owns Opus resampling in `setupOutboundVoice`  
**Audio path**: `audio-context-manager` maintains single shared `AudioContext`; `voice.js` chooses continuous/PTT handlers; `recorder-worker.js` streams 48 kHz mono 960-sample packets to worker  
**Worker instantiation**: Use native `new Worker(new URL('./worker.js', import.meta.url), {type: 'classic'})` syntax (Webpack 5 compatible); avoid worker-loader wrappers  
**Decoder pool**: `decoder-stream.js` uses `reuse-pool` to recycle decode workers; keeps first worker warm on init

## Build system
- `npm run build` or `WEBPACK_MODE=development ./smart-build.sh` uses `dist/.build-marker` for incremental builds
- `smart-build.sh --force` wipes `dist/` entirely; auto-babels `vendors/mumble-client` when `lib/` missing
- `prepare` hook runs smart-build unless `SKIP_PREPARE=1`; **never commit** `dist/**` (it's generated)
- Webpack 5 config: `babel-loader` for ES6+, `MiniCssExtractPlugin` for SCSS, `HtmlWebpackPlugin` for template processing
- **Critical validation**: build fails if `dist/index.html` < 1 KB; checks for empty/corrupted artifacts
- **Vendor rebuild**: `npm run build:vendor:mumble-client` transpiles `vendors/mumble-client/src/` → `lib/` (required after editing vendored source)
- `dist/config.local.js` copied from `app/config.local.js` if missing; **back up before clean builds**

## Dev & test workflows
**Local dev**: `MUMBLE_SERVER=host:port ./start-dev-server.sh` → builds in dev mode, spawns `docker-entrypoint.sh`, opens `http://local.flexpair.app`, logs to `/tmp/entrypoint.log`  
**Static-only**: `SKIP_TUNNEL=1 PORT=8081 ./docker-entrypoint.sh` serves files via Python http.server (used by smoke tests)  
**Testing**:
  - `npm run test:audio:system` = fastest; validates build artifacts, codecs, worker syntax (no server required)
  - `npm run test:e2e` = WebSocket smoke test (checks websockify tunnel + HTTP serving)
  - `npm run test` = E2E + audit (default test suite)
  - `npm run test:audio` = single roundtrip test (sends 440 Hz sine wave to live server)
  - `./scripts/quick-audio-test.sh` = all-in-one (starts test server, runs tests, cleans up)
**E2E modes**: `node scripts/e2e-check.cjs` (local) vs `--mode=container` (CI); set `PLAIN_TARGET=1` for non-TLS echo servers  
**Analysis**: `npm run analyze` → `dist/bundle-report.html`; `npm run check:deps` flags unused modules

## Implementation conventions
**UI state**: All observables live in `GlobalBindings` (never scattered); persist via `localStorage` (`mumble.*` keys); wire to Knockout bindings in `app/index.html`  
**Worker events**: Must update both `_dispatchEvent` in `worker-client.js` AND corresponding handler in `worker.js`; only pass numeric IDs across thread boundary  
**Audio invariants**: 48 kHz mono, 960-sample frames (20ms @ 48 kHz), `samplesPerPacket` in settings—changing requires coordinated updates to `voice.js`, worker resampler, `Settings` serialization  
**AudioContext**: **Always** `ensureAudioContext()` from `audio-context-manager.js`; never `new AudioContext()` directly (breaks singleton pattern). Manager handles autoplay policies, state changes, resume retries  
**AudioWorklet**: `recorder-worker.js` is AudioWorklet processor (not Web Worker); runs in audio thread; accumulates input blocks → posts 960-sample frames via `port.postMessage`  
**Sample-rate modal**: Blocks connection until acknowledged; `ui._performConnect({audioEnabled:false})` bypasses audio for "join without audio"  
**Loopback testing**: `target=31` in `voice.js` creates server loopback streams (echoes audio back to sender); `isLoopbackMode` observable controls UI/behavior; Test button recreates voice handler with loopback target. **Warning**: loopback tests audio encode/decode but NOT client-to-client playback initialization  
**User object migration**: When server assigns self ID, migrate `_users[undefined]` → `_users[actualID]` in `worker-client.js` `_setProp()` to preserve event listeners (critical for loopback voice events)

## Vendored dependencies
- `vendors/mumble-client` is `file:` protocol dep; after editing `src/`, run `npm run build:vendor:mumble-client` to refresh `lib/`
- `vendors/netlify-identity-widget` ships as-is; UI expects `window.netlifyIdentity` global before auth flows
- `vendors/web-audio-buffer-queue` provides `BufferQueueNode` for audio playback (handles both default/named exports via `import BufferQueueNodeDefault, { BufferQueueNode as BufferQueueNodeNamed }`)

## Config, localization, theming
**Config**: Source defaults in `app/config.js`; runtime overrides in generated `dist/config.local.js` (back up before clean builds!)  
**Localization**: Every UI string needs matching keys across all `localize/*.json`; missing keys log warnings and break i18n  
**Themes**: SCSS sources under `themes/MetroMumbleLight`; Webpack compiles to CSS; runtime selection via `?theme=` query param

## Debugging patterns
**Tunnel issues**: `tail -f /tmp/entrypoint.log`; verify websockify with `ps aux | grep websockify`  
**Audio state**: Browser console → `audioContextManager.getStats()` shows context lifecycle; `[AudioContext]` logs state changes, sample rate, latencies  
**Audio debugging sequence** (client-to-client playback):
  1. Sender: `[VOICE]` logs in voice.js → `[DEBUG-WORKER]` encoder logs  
  2. Receiver: `[DEBUG-WORKER] Voice stream started` → `Voice data received` → `[DEBUG-DECODER] Transform called` → `Decoded audio` → `[DEBUG-VOICE] Received voice stream` → `BufferQueueNode created` → `Received audio data packet`  
**Container tests**: `node scripts/e2e-check.cjs --mode=container` validates inside CI; uses `docker exec` for connectivity checks  
**Worker crashes**: Check browser DevTools → Sources → worker.js for exceptions; worker errors don't always surface in main console  
**Console logging**: Production builds minimize logs; prefix debug logs with context tags like `[LOOPBACK]`, `[DEBUG-WORKER]`, `[DEBUG-DECODER]`, `[DEBUG-VOICE]`

## Key file map
**UI/session**: `app/index.js` (GlobalBindings), `app/index.html` (templates), `app/localize.js` (i18n)  
**Worker bridge**: `app/worker.js` (worker entry), `app/worker-client.js` (proxy + user migration), `app/mumble-websocket.js` (WebSocket → MumbleClient adapter)  
**Audio stack**: `app/audio-context-manager.js` (singleton + autoplay handling), `app/voice.js` (PTT/continuous + target param), `app/recorder-worker.js` (AudioWorklet processor), `app/decoder-stream.js` (worker pool), `app/encode-worker.js` + `app/decode-worker.js` (Opus codec workers)  
**Build/runtime**: `smart-build.sh` (incremental build logic), `webpack.config.js`, `start-dev-server.sh`, `docker-entrypoint.sh` (websockify launcher), `scripts/e2e-check.cjs` (smoke test)  
**Testing**: `scripts/audio-system-test.cjs` (offline validation), `scripts/audio-test.cjs` (live roundtrip), `scripts/audio-monitor.cjs` (realtime VU meter), `AUDIO_DEBUG_GUIDE.md` (production debugging guide)
