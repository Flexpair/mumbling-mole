# Mumbling Mole

Mumbling Mole is a modernized HTML5 Mumble client tailored for browsers without a native Mumble binary. It wraps the upstream `mumble-web` project with a reproducible build pipeline, vendor isolation, and tooling optimized for Flexpair deployments.

## Highlights

- Browser audio capture via `getUserMedia` with Opus encoding tunneled over WebSockets (no WebRTC peer connection required).
- Smart build script (`smart-build.sh`) that compiles vendored dependencies and validates artifacts.
- Themeable UI based on MetroMumble Light/Dark variants.

## Prerequisites

- Node.js ≥ 22 (matching the devcontainer and the `package.json` `engines` field).
- A reachable Mumble server endpoint (`host:port`) that you can tunnel to.

## Getting started

```bash
git clone https://github.com/Flexpair/mumbling-mole.git
cd mumbling-mole
npm install
```

During installation the `prepare` script runs `smart-build.sh` to generate the contents of `dist/`. If you need a clean rebuild later, run:

```bash
npm run build:force
```

## Running the client locally

The entrypoint wraps `websockify` to tunnel TCP voice/data streams over WebSockets. Export the destination Mumble server address (`host:port`) and start the helper script:

```bash
MUMBLE_SERVER=voice.example.com:64738 ./start-dev-server.sh
```

The script launches `docker-entrypoint.sh`, waits for the static files to compile, opens the WebSocket tunnel via `websockify`, and serves the UI at `http://local.flexpair.app` (mapped to `localhost` inside the devcontainer). To stop the session:

```bash
./stop-dev-server.sh
```

If you only need to serve the static build for testing without the tunnel, you can skip the proxy by setting `SKIP_TUNNEL=1` (no audio transport):

```bash
SKIP_TUNNEL=1 PORT=8081 ./docker-entrypoint.sh
```

## Configuration

Default values live in `app/config.js`. The build copies a mutable `dist/config.local.js`, so you can tweak server presets or UI options without touching source control—just re-run the build after edits. Remember to back up `dist/config.local.js` if you rebuild from a clean workspace.

## Theming

MetroMumble-inspired themes reside under `themes/`. Select a theme by appending `?theme=ThemeName` to the page URL (for example, `theme=MetroMumbleDark`). Derive new themes by extending the Light/Dark variants and include them during the build.

## Useful npm scripts

- `npm run build` – Incremental build via `smart-build.sh`.
- `npm run build:force` – Clean rebuild of the distribution artifacts.
- `npm run analyze` – Generate a static bundle analysis report in `dist/bundle-report.html`.
- `npm run test` – Execute end-to-end smoke checks and dependency audits.
- `npm run check:deps` – Report unused dependencies with `depcheck`.

## License

ISC