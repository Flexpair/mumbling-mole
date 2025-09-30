# Copilot Instructions · mumbling-mole

## Quick context
- Browser-first Mumble client: Knockout.js UI delegates voice transport to a Web Worker backed by the vendored `mumble-client`.
- Audio capture stays in a Web Audio AudioWorklet; the UI also gates a Guacamole iframe after auth/role checks.

## Architecture & threading
- Main thread (`app/index.js`) bootstraps `GlobalBindings`, handles Netlify Identity auth, Guacamole iframe gating, and dispatches voice controls to the worker.
- Worker (`app/worker.js`) talks to `mumble-websocket.js`, mirrors channel/user trees via serialized IDs, and owns outbound Opus resampling in `setupOutboundVoice`.
- Audio path: `audio-context-manager` maintains the one shared `AudioContext`; `voice.js` chooses continuous/PTT handlers and streams 48 kHz mono packets from `recorder-worker.js` (960 samples) to the worker.

## Build & bundles
- `npm run build` / `WEBPACK_MODE=development ./smart-build.sh` respect `dist/.build-marker`; `--force` wipes `dist/` and recompiles.
- `smart-build.sh` auto-babels `vendors/mumble-client` when `lib/` is missing, copies `config.local.js`, and asserts `dist/index.html` ≥ 1 KB.
- `prepare` runs `smart-build.sh` unless `SKIP_PREPARE=1`; keep generated `dist/**` out of commits.

## Dev & test workflows
- `MUMBLE_SERVER=host:port ./start-dev-server.sh` builds in dev mode, spawns `docker-entrypoint.sh`, and opens `http://local.flexpair.app`; logs stream to `/tmp/entrypoint.log`.
- `SKIP_TUNNEL=1 PORT=8081 ./docker-entrypoint.sh` serves static assets only and powers smoke tests.
- `npm run test` = WebSocket roundtrip (`scripts/e2e-check.cjs`) + dependency audit; set `PLAIN_TARGET=1` when tunneling to non-TLS targets.
- `npm run analyze` emits `dist/bundle-report.html`; `npm run check:deps` flags unused modules.

## Implementation conventions
- UI state lives on `GlobalBindings`; persist via `localStorage` (`mumble.*`) and wire to Knockout templates in `app/index.html`.
- Sample-rate warning modal blocks connects until acknowledged; call `ui._performConnect` with `audioEnabled:false` to honor “join without audio”.
- Workers and UI exchange only numeric IDs; when adding events, update `_dispatchEvent` in `worker-client.js` and the matching branch in `worker.js`.
- Respect audio invariants: 48 kHz mono, 960-sample frames, `samplesPerPacket` stored in settings—adjust `voice.js`, worker resampler, and `Settings` serialization together.
- Always use `ensureAudioContext` from `audio-context-manager.js`; never instantiate `AudioContext` directly.

## Vendored dependencies
- `vendors/mumble-client` is a `file:` dep; after editing `src/`, run `npm run build:vendor:mumble-client` or any `smart-build.sh` to refresh `lib/`.
- `vendors/netlify-identity-widget` ships as-is; UI expects `window.netlifyIdentity` before login flows.

## Config, localization, theming
- Source defaults live in `app/config.js`; runtime overrides use generated `dist/config.local.js` (copy before clean rebuilds).
- Every string addition requires updates across `localize/*.json`; missing keys log warnings and break translation expectations.
- Themes sit under `themes/MetroMumbleLight`; SCSS is compiled by Webpack, so keep asset paths relative.

## Debugging hints
- Tail `/tmp/entrypoint.log` for tunnel issues; `ps aux | grep websockify` confirms the proxy process.
- Browser console exposes AudioContext state via `audioContextManager.getStats()` and logs mic permission retries.
- `node scripts/e2e-check.cjs --mode=container` validates connectivity inside CI containers and probes Docker via `docker exec`.

## Key references
- UI/session glue: `app/index.js`, `app/index.html`, `app/localize.js`
- Worker bridge & transport: `app/worker.js`, `app/worker-client.js`, `app/mumble-websocket.js`
- Audio stack: `app/audio-context-manager.js`, `app/voice.js`, `app/recorder-worker.js`
- Build/runtime scripts: `smart-build.sh`, `start-dev-server.sh`, `docker-entrypoint.sh`, `scripts/e2e-check.cjs`
