# Copilot Instructions · mumbling-mole

## Quick context
- Browser-first Mumble client: Knockout.js UI orchestrates audio + Guacamole remote desktop, while Web Workers host the real `mumble-client` sessions.
- Bundle is produced by `smart-build.sh` + Webpack 5 into `dist/`; generated artifacts (`dist/**`, `config.local.js`) are never committed.

## Architecture & data flow
- `app/index.js` bootstraps `GlobalBindings`, drives auth, Guacamole iframe gating, and proxies UI events to `WorkerBasedMumbleConnector` (`app/worker-client.js`).
- `app/worker.js` runs inside a Web Worker, creates Mumble connections, resamples outbound audio, and emits events serialized by ID—keep `_dispatchEvent` handlers in sync on both sides.
- Audio capture path: `audio-context-manager` manages a single `AudioContext` → `voice.js` selects continuous/PTT handlers → `recorder-worker.js` AudioWorklet streams 48 kHz mono frames of 960 samples to the worker for Opus encoding.
- Knockout templates in `app/index.html` assume observable-backed state; add UI fields via `GlobalBindings` so localization (`translateEverything`) keeps them current.

## Build & dependency workflow
- `npm run build` / `npm run build:force` call `smart-build.sh`, which rebuilds `vendors/mumble-client` with Babel when `lib/` is stale and validates `dist/index.html` size before exiting.
- Incremental builds hinge on `dist/.build-marker`; touching files under `app/` forces recompilation. Set `SKIP_PREPARE=1` before `npm install` to skip the prepare build.
- Vendored packages under `vendors/` are `file:` dependencies—after edits run `npm run build:vendor:mumble-client` (or a full build) so `lib/` stays in sync with `src/`.

## Local dev & runtime
- `MUMBLE_SERVER=host:port ./start-dev-server.sh` launches `docker-entrypoint.sh`, compiles assets, opens the websockify tunnel, and serves at `http://local.flexpair.app`; stop with `./stop-dev-server.sh`.
- For static-only smoke tests run `SKIP_TUNNEL=1 PORT=8081 ./docker-entrypoint.sh`; follow runtime logs in `/tmp/entrypoint.log`.
- Runtime config defaults come from `app/config.js`; modify the generated `dist/config.local.js` (copied on build) instead of editing source, and rebuild to propagate changes.

## Testing & quality gates
- `npm run test` executes `scripts/e2e-check.cjs` (WebSocket roundtrip using `docker-entrypoint.sh`) and `scripts/audit-ci.cjs` (security audit); keep both green before merging.
- `npm run analyze` writes `dist/bundle-report.html`; `npm run check:deps` surfaces unused deps, and `npm run audit:baseline` refreshes accepted vulnerabilities.

## Implementation conventions & gotchas
- `GlobalBindings` persists settings in `localStorage`; when adding UI state, expose a Knockout observable so templates and localization stay reactive.
- Audio settings (`samplesPerPacket`, bitrate) live in `Settings`; if packet size changes, adjust `setupOutboundVoice` in `voice.js` and the worker resampler to match.
- AudioContext creation is centralized through `ensureAudioContext` with autoplay fallbacks—avoid instantiating `AudioContext` elsewhere.
- Worker/UI protocol exchanges numeric IDs, not object references—extend both sides together and respect the serialization helpers.
- Localization keys reside in `localize/*.json`; add new strings to every locale to prevent runtime warnings.

## Key references
- UI + bindings: `app/index.js`, `app/index.html`, `app/localize.js`
- Worker bridge: `app/worker.js`, `app/worker-client.js`
- Audio stack: `app/voice.js`, `app/audio-context-manager.js`, `app/recorder-worker.js`
- Build/runtime scripts: `smart-build.sh`, `start-dev-server.sh`, `docker-entrypoint.sh`
- Vendored client: `vendors/mumble-client/` (`src/` for code, `lib/` generated)
