# 🎤 Mumbling Mole

> Browser-first [Mumble](https://en.wikipedia.org/wiki/Mumble_(software)) voice client with no native browser dependency.

Mumbling Mole brings Mumble voice communication to modern browsers with Vue 3, Pinia, the Web Audio API, AudioWorklet, Opus compiled to WebAssembly, and a WebSocket tunnel. It is based on [mumble-web](https://github.com/johni0702/mumble-web).

## Current stack

| Area | Implementation |
| --- | --- |
| UI | Vue 3 Single-File Components |
| State | Pinia stores under `app/stores/` |
| Bundling | esbuild (`build-esbuild.mjs`) |
| Audio | Web Audio API, AudioWorklet, Opus/WASM |
| Transport | WebSocket tunnel to Mumble TCP |
| Authentication | Netlify Identity through the identity proxy |
| Unit tests | Jest 30 with jsdom |
| Browser tests | Playwright, Chromium |
| Runtime | Node.js 22 for development and builds |
| Containers | Multi-stage Dockerfile and Dev Container Compose setup |

## Quick start

```bash
git clone https://github.com/Flexpair/mumbling-mole.git
cd mumbling-mole
npm install

# Production-style bundle
npm run build

# Development bundle and local server
npm run build:dev
./start-dev-server.sh
```

The local browser entry point is <https://local.flexpair.app>. The development reverse proxy exposes HTTPS on port `443` and HTTP on port `80`; the application service listens on port `8081` and the authentication service on port `8082` inside the Compose network.

## Build modes and npm scripts

The build is performed by esbuild. `build-esbuild.mjs` resolves the mode from `BUILD_MODE`, then `NODE_ENV`, and otherwise uses `production`.

```bash
npm run build                         # production mode (default)
npm run build:dev                     # BUILD_MODE=development
BUILD_MODE=development npm run build # explicit development mode
BUILD_MODE=production npm run build  # explicit production mode
npm run build:local                   # rebuild and restart the local server
```

Development builds keep names and inline source maps. Production builds minify output and omit source maps. Every build cleans and recreates `dist/`, generates build metadata, bundles the application and workers, copies static assets, and validates the required output files.

Other scripts:

| Command | Purpose |
| --- | --- |
| `npm test` | Jest unit tests, Python auth-server tests, Playwright tests, then the dependency audit |
| `npm run test:unit` | Jest tests matching `**/__tests__/**/*.test.js` |
| `npm run test:unit:coverage` | Jest with coverage and the configured 80% global thresholds |
| `npm run test:python` | Python tests for `auth-server/server.py` |
| `npm run test:playwright` | All Playwright tests in `tests/playwright/` |
| `npm run test:auth` | Invalid-credentials browser test |
| `npm run test:loopback` | Headless audio loopback test |
| `npm run test:loopback:headed` | Loopback test with a visible browser |
| `npm run test:loopback:debug` | Loopback test in Playwright debug mode |
| `npm run audit:ci` | Dependency vulnerability gate |
| `npm run check:deps` | Dependency usage check with `depcheck` |
| `npm run validate:markdown` | Repository Markdown structure check |

See [tests/README.md](tests/README.md) for the test prerequisites and [tests/playwright/README.md](tests/playwright/README.md) for browser-test details.

## Runtime architecture

```text
Browser
  ├─ Vue 3 UI + Pinia stores
  ├─ AudioContext + AudioWorklet capture/playback
  └─ Web Worker for Mumble protocol and codec work
          │
          │ WebSocket
          ▼
  websockify tunnel
          │ TCP
          ▼
  Mumble server (murmur:64738)
```

The browser does not connect to Mumble with WebRTC. The client sends and receives Mumble traffic through the WebSocket tunnel. The normal local path is `https://local.flexpair.app` → nginx → the application service on `8081` → websockify → the Mumble server.

### Audio invariants

- Capture and playback use a `48,000 Hz` audio context.
- The sender emits `960` samples per Opus frame (`20 ms` at `48 kHz`); changing this breaks the voice pipeline.
- Capture runs in `app/audio/recorder-worker.js`.
- Encoding and decoding run in dedicated workers with the Opus WASM codec.
- Received audio passes through the jitter/buffer queue before reaching the audio destination.
- The built-in loopback uses the Mumble server echo target and validates the complete local pipeline; it does not replace a two-client test.

## Authentication

The current browser provider is Netlify Identity. The adapter is selected through `AuthFactory` and sends cross-origin Identity requests through the public identity proxy:

```text
https://welcome.flexpair.com/identity-proxy
```

Recovery, confirmation, and invitation tokens are URL-hash values. The application preserves the hash before the Identity widget loads and restores it after the adapter has been configured, so the widget uses the proxy rather than the current application host. See [app/auth/README.md](app/auth/README.md).

The server-side credential endpoint validates the Identity JWT before returning the credentials needed by the client. Keep local test credentials in untracked environment files; never add their values to documentation or Git.

## Docker and Dev Container

The multi-stage [Dockerfile](Dockerfile) provides:

- `base-runtime`: Ubuntu runtime, Python virtual environment, and websockify;
- `builder`: Node.js 22 and the production bundle;
- `dev`: build tools, GitHub CLI, Playwright Chromium dependencies, and the `codespace` user;
- `prod`: the generated static files, Python authentication server, and websockify without Node.js.

Build either image explicitly:

```bash
docker build --target dev -t mumbling-mole:dev .
docker build --target prod -t mumbling-mole:prod \
  --build-arg GIT_COMMIT="$(git rev-parse HEAD)" .
```

The Dev Container uses [.devcontainer/docker-compose.yml](.devcontainer/docker-compose.yml). It starts the development service together with Murmur, nginx, and the Guacamole services, installs dependencies and Chromium during creation, and forwards port `443`. The Compose file requires the local Mumble and Guacamole password variables but their values must remain outside the repository.

Default production startup runs both the WebSocket tunnel and the authentication service through [docker-entrypoint.sh](docker-entrypoint.sh). Configure these runtime settings:

| Variable | Purpose |
| --- | --- |
| `MUMBLE_SERVER` | Mumble TCP endpoint as `host:port`; the Dev Container uses `murmur:64738`. |
| `MUMBLE_PASSWORD` | Server password matching the Mumble server configuration; also supplied to the authentication service. |
| `GUAC_ADMIN_PASSWORD` | Guacamole credential for the `admin` role, required when the authentication service starts. |
| `GUAC_EDITOR_PASSWORD` | Guacamole credential for the `editor` role, required when the authentication service starts. |
| `GUAC_WATCHER_PASSWORD` | Guacamole credential for the `watcher` role, required when the authentication service starts. |

All three Guacamole role passwords must be nonempty and mutually distinct. [auth-server/server.py](auth-server/server.py) rejects missing or duplicate role passwords; these requirements apply to production as well as the Dev Container.

Supply password values through the deployment's secret configuration, never through committed files or documentation. `SKIP_TUNNEL=1` serves static files only and bypasses both the tunnel and authentication-service startup.

## CI/CD and image publishing

GitHub Actions provides two documentation and delivery paths:

- **Validate Markdown** (`.github/workflows/validate-markdown.yml`) runs the structure validator for Markdown changes on pull requests and on pushes to `lite` or `main` that touch Markdown.
- **Build and push to DockerHub** (`.github/workflows/docker-image.yml`) runs on pull requests targeting `lite` and on pushes to `lite` or tags. It installs dependencies, runs the audit, dependency check, Jest coverage tests, and Python auth-server tests, then builds the Docker `prod` stage. Pull requests build without publishing; branch and tag pushes publish the generated tags to `jafudi/mumbling-mole`.

The Docker workflow does not run the Playwright browser suite. Run that suite in the Dev Container or another environment with the Compose Murmur service available.

## Project structure

```text
app/
├── index.js                 # Vue application entry point
├── components/              # Vue components
├── stores/                  # Pinia stores
├── audio/                   # AudioWorklet and codec workers
├── worker.js                # Mumble protocol worker
├── worker-client.js         # Main-thread/worker bridge
├── auth/                    # Netlify Identity adapter and auth services
└── mumble-client/           # Mumble protocol client
__tests__/                   # Jest tests
tests/playwright/            # Playwright tests
build-esbuild.mjs            # esbuild configuration
playwright.config.js         # Playwright configuration
jest.config.js               # Jest configuration
Dockerfile                   # dev and prod images
```

## Contributing

Use a focused branch and a Conventional Commit such as `feat:`, `fix:`, `refactor:`, or `docs:`. Keep generated `dist/` output out of commits. New UI state belongs in a Pinia store, audio initialization must use the shared audio-context lifecycle, and changes to the 48 kHz / 960-sample audio contract require corresponding tests.

Mumbling Mole is licensed under **AGPL-3.0-only**. See [LICENSE](LICENSE) and [NOTICE](NOTICE).
