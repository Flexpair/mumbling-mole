# Copilot Instructions · mumbling-mole

## Quick context
- Browser-first Mumble client that wraps the vendored `mumble-client` library, compiled via Webpack into `dist/`.
- UI lives in `app/index.js` with Knockout viewmodels; audio capture/processing is isolated in workers to keep the UI thread lightweight.

## Architecture map
- `app/index.js` orchestrates auth, server connect, Guacamole iframe, and voice UX; it talks to a background worker through `WorkerBasedMumbleConnector` (`app/worker-client.js`).
- `app/worker.js` runs inside a Web Worker, holds real `mumble-client` instances, proxies events back to the UI, and performs PCM resampling before handing audio to the main thread.
- Audio setup flows through `app/audio-context-manager.js` and `app/voice.js`: managed `AudioContext` + `AudioWorkletNode` (`recorder-worker.js`) capture mic frames that are forwarded to `createVoiceStream` on the worker client.
- Configuration defaults live in `app/config.js`; mutations happen in the generated `dist/config.local.js`. Never edit the built file in source control—`smart-build.sh` overwrites it.
- Themes are in `themes/MetroMumbleLight`; the build copies SVG/PNG assets and SCSS into `dist/` while query param `?theme=` selects variants at runtime.

## Build & bundling workflow
- `npm run build`/`npm run build:force` funnel through `smart-build.sh`. The script auto-builds `vendors/mumble-client` with Babel if `lib/` is missing, runs Webpack 5 with HtmlWebpackPlugin, then sanity-checks `dist/index.html` size.
- Incremental builds rely on `dist/.build-marker`; touching any file under `app/*.js` or `app/*.html` forces a rebuild. Skip the entire build by exporting `SKIP_PREPARE=1` before `npm install`.
- Webpack config (`webpack.config.js`) expects Worker imports via `new Worker(new URL('./worker.js', import.meta.url))`, polyfills `Buffer`/`process`, and pipes styles through `MiniCssExtractPlugin` + Sass.

## Local dev & runtime
- The dev loop uses `./start-dev-server.sh`: set `MUMBLE_SERVER=host:port` to enable the websockify tunnel; logs stream to `/tmp/entrypoint.log`. For static-only testing, run `SKIP_TUNNEL=1 PORT=8081 ./docker-entrypoint.sh`.
- Docker image (`Dockerfile`) installs Node 22.19, Python 3.11, and websockify; prod stage runs `npm run build:force` during image build.
- `app/config.local.js` is copied into `dist/`. To change presets locally, edit the generated file then rerun the build so `start-dev-server.sh` serves the updated bundle.

## Tests & quality gates
- `npm run test` executes the WebSocket smoke test (`scripts/e2e-check.cjs`) and the audit gate (`scripts/audit-ci.cjs`). The e2e script starts `docker-entrypoint.sh` with an echo-server, verifies a roundtrip on port `8081`, and cleans up.
- `npm run audit:baseline` refreshes `audit-baseline.json` after consciously accepting/patching vulnerabilities.
- `npm run check:deps` wraps `depcheck --config .depcheckrc`; a non-zero exit usually means stale dependencies in `package.json`.

## Conventions & gotchas
- Knockout bindings expect observables defined in `GlobalBindings` (`app/index.js`). When adding state, wire it through observables so localization (`app/localize.js`) and templates respond automatically.
- The worker protocol serialises IDs instead of objects. When extending events, update `app/worker.js` *and* the matching `_dispatchEvent` handlers in `WorkerBasedMumbleClient` or you will break the UI proxies.
- Audio capture assumes 48 kHz mono PCM chunks of 960 samples. Changing `samplesPerPacket` needs matching updates in the worker resampler (`setupOutboundVoice`).
- Vendored packages under `vendors/` are shipped via `file:` dependencies. If you touch their sources, rerun `npm run build:vendor:mumble-client` or let `smart-build.sh` trigger Babel to refresh `lib/`.
- Localization strings are in `localize/*.json` keyed by the same identifiers used in `app/localize.js`. Always add new string keys across all locales to avoid runtime warnings.

## Key references
- UI entry: `app/index.html`, `app/index.js`
- Worker bridge: `app/worker-client.js`, `app/worker.js`
- Audio pipeline: `app/voice.js`, `app/audio-context-manager.js`, `app/recorder-worker.js`
- Build scripts: `smart-build.sh`, `webpack.config.js`
- Runtime scripts: `start-dev-server.sh`, `docker-entrypoint.sh`
- Tests: `scripts/e2e-check.cjs`, `scripts/audit-ci.cjs`
