# 🎤 Mumbling Mole

> A modern, browser-first Mumble voice chat client with no native dependencies

[![Node.js Version](https://img.shields.io/badge/node-%E2%89%A522.0.0-brightgreen)](https://nodejs.org/)

Mumbling Mole brings Mumble voice communication to any modern web browser without requiring native client installation. Built on the upstream `mumble-web` project, it features a reproducible build pipeline, vendor isolation, and tooling optimized for Flexpair deployments.

## ✨ Features

- 🎙️ **Browser-native audio capture** – Uses Web Audio API with Opus encoding via AudioWorklet
- 🔌 **WebSocket tunneling** – TCP voice streams over WebSocket connections (no WebRTC required)
- ⚡ **Vue.js 3 architecture** – Modern reactive UI framework with composable state management
- 🎨 **Themeable interface** – MetroMumble-inspired Light/Dark themes
- 👷 **Web Worker architecture** – Offloads Mumble protocol & audio encoding from main thread
- 🌐 **English interface** – Localization system (multilanguage support disabled since v0.5.0)
- 📦 **Smart build system** – Incremental builds with vendor dependency management
- 🐳 **Docker-ready** – Containerized development and production environments
- 🔊 **Audio loopback testing** – Built-in server loopback mode for testing audio encode/decode path
- 🖥️ **Guacamole integration** – Optional remote desktop access after Netlify Identity authentication

## 💻 System Requirements

### Browser Compatibility

**Minimum versions required:**

| Browser | Version | Release Date | Notes |
|---------|---------|--------------|-------|
| **Safari** | 14.1+ | April 2021 | Primary constraint (AudioWorklet support) |
| **Chrome** | 66+ | April 2018 | Full Web Audio API + AudioWorklet |
| **Firefox** | 76+ | May 2020 | AudioWorklet + Opus codec |
| **Edge** | 80+ | February 2020 | Chromium-based versions |
| **Opera** | 53+ | May 2018 | Chromium-based versions |

**Required browser features:**
- ✅ **AudioWorklet API** (audio capture with 20ms frames)
- ✅ **Web Audio API** (audio processing and playback)
- ✅ **getUserMedia** (microphone access)
- ✅ **WebSocket API** (Mumble protocol transport)
- ✅ **Web Workers** (background audio encoding/decoding)
- ✅ **ES2020 JavaScript** (modern syntax features)

**Not supported:**
- ❌ Internet Explorer (any version)
- ❌ Safari < 14.1
- ❌ Old Android browsers (use Chrome/Firefox on mobile)

> **Note:** ~99.9% of users in 2025 have compatible browsers. The AudioWorklet API (Safari 14.1+, April 2021) is the primary constraint—without it, real-time audio capture is not possible.

### Development Environment

## 📋 Prerequisites

- **Node.js** ≥ 22.0.0 (matches devcontainer and `package.json` engine requirement)
- **npm** ≥ 10.0.0
- **Git** for cloning the repository
- **Docker** (optional, for containerized development)
- A reachable **Mumble server** endpoint (`host:port`)

## 🚀 Quick Start

### 1. Clone and Install

```bash
git clone https://github.com/Flexpair/mumbling-mole.git
cd mumbling-mole
npm install

# Setup Git hooks (includes markdown structure validation)
./scripts/setup-git-hooks.sh
```

> **Note:** The `prepare` script automatically runs `npm run build` during installation to generate the `dist/` directory.

### 2. Start Development Server

```bash
# Set your Mumble server address and start the dev server
MUMBLE_SERVER=voice.example.com:64738 ./start-dev-server.sh
```

This will:
- Build the application assets
- Start a WebSocket tunnel via `websockify`
- Serve the UI at `http://local.flexpair.app`
- Display connection logs

### 3. Stop the Server

```bash
./stop-dev-server.sh
```

### 4. Test Audio (Loopback Mode)

Once connected to a Mumble server, you can test your audio setup using the built-in loopback feature:

1. Connect to a Mumble server
2. Click the **Test** button (blue button next to Connect)
3. Speak into your microphone
4. Your audio will be routed back through the server (target 31) and played back to you

This allows you to verify your microphone and audio encoding/decoding without needing a second client.

> **⚠️ Important:** Loopback mode tests same-client playback, NOT cross-client network/audio initialization. For production debugging, see [app/audio/README.md](./app/audio/README.md).

## 🐳 Docker Deployment

### Building Docker Images

The Dockerfile supports multi-stage builds with `dev` and `prod` targets.

#### Production Build with Version Information

To include the git commit hash in the production build (displayed in Connection Info dialog):

```bash
# Build with current git commit
docker build \
  --build-arg GIT_COMMIT=$(git rev-parse HEAD) \
  --target prod \
  -t mumbling-mole:prod \
  .

# Or using docker-compose
GIT_COMMIT=$(git rev-parse HEAD) docker-compose build
```

> **Important:** The `.git` directory is excluded from Docker builds (see `.dockerignore`) for security reasons. Without the `GIT_COMMIT` build argument, the version will show as "unknown" in production.

#### CI/CD Integration

In GitHub Actions or other CI/CD pipelines, pass the commit hash:

```yaml
# Example GitHub Actions workflow
- name: Build Docker image
  uses: docker/build-push-action@v6
  with:
    build-args: |
      GIT_COMMIT=${{ github.sha }}
    target: prod
```

#### Development Build

For local development with full tooling:

```bash
docker build --target dev -t mumbling-mole:dev .
```

### Environment Variables

The build script (`build-esbuild.mjs`) checks for version information in this order:

1. **`GIT_COMMIT` environment variable** (set by Docker build or CI/CD)
2. **Git command** (`git rev-parse HEAD`) - requires `.git` directory
3. **Fallback to "unknown"** if neither is available

### Verifying the Build

After building, you can verify the embedded version:

```bash
# Check build-info.json in the built image
docker run --rm mumbling-mole:prod cat /home/node/dist/build-info.json
```

Expected output:
```json
{
  "commit": "d13f880facc6cf83d6e9dac06b0cfcb3115378d4",
  "buildTime": "2025-11-15T20:09:51.350Z",
  "mode": "production"
}
```

## 🏗️ Architecture

### High-Level Overview

```
┌─────────────────────────────────────────────────────────────┐
│                      Browser Window                         │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌─────────────────────────────┐  ┌──────────────────────┐ │
│  │     Main Thread (UI)         │  │    Web Worker        │ │
│  │                              │  │                      │ │
│  │  • Vue.js 3 Components       │◄─┤  • mumble-client     │ │
│  │  • Vue Composables (State)   │  │  • Audio resampling  │ │
│  │  • AppState (5 modules)      │  │  • Opus encoding     │ │
│  │  • Localization              │  │  • Event dispatch    │ │
│  │  • Theme management          │  │  • Protocol handling │ │
│  └──────────┬──────────────────┘  └──────────┬───────────┘ │
│             │                                 │             │
│  ┌──────────▼──────────────────────────────────┐           │
│  │         AudioContext + AudioWorklet          │           │
│  │     (48kHz mono PCM, 960 samples/packet)    │           │
│  └───────────────────────────────────────────────┘          │
│                                                             │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
                    ┌──────────────────┐
                    │   WebSocket API   │
                    └──────────────────┘
                              │
                              ▼
                    ┌──────────────────┐
                    │    websockify     │
                    └──────────────────┘
                              │
                              ▼
                    ┌──────────────────┐
                    │   Mumble Server   │
                    │    (TCP:64738)    │
                    └──────────────────┘
```

### Audio Pipeline Architecture

The audio system uses an asymmetric design optimized for real-time capture and jitter-tolerant playback:

#### Capture Path (Send) - Strict Real-Time Constraints

```text
Microphone
    ↓
AudioContext.getUserMedia() → 48kHz mono stream
    ↓
AudioWorklet (recorder-worker.js) ← REAL-TIME THREAD! 
    • Accumulates 128-sample blocks
    • Posts exactly 960 samples (20ms @ 48kHz)
    • FIXED frame size (architecture constraint)
    • Must complete in <3ms (no blocking allowed)
    ↓ postMessage (960 Float32 samples)
Main Thread
    ↓
Web Worker (encode-worker.js)
    • Opus encoding via libopus.js WASM
    • Bitrate control (8-96 kbps)
    • Can take 1-5ms (non-blocking)
    ↓
Network (WebSocket → websockify → Mumble TCP)
```

**Critical Constraint:** `recorder-worker.js` MUST output 960-sample frames. This is hard-coded throughout:

- AudioWorklet processor (fixed FRAME constant)
- Worker resampler chunker (expects 960 samples)
- Opus encoder configuration (20ms frames)
- Settings UI (slider disabled, see commit e073892)

Changing this requires coordinated updates across ALL components. See [#201](https://github.com/Flexpair/mumbling-mole/issues/201) for future plans.

#### Playback Path (Receive) - Jitter-Tolerant Buffer

```text
Network (Mumble server → websockify → WebSocket)
    ↓
Main Thread (variable packet arrival times ±5-50ms jitter)
    ↓
Web Worker (decode-worker.js)
    • Opus decoding via libopus.js WASM
    • Handles VARIABLE frame sizes (480-2880 samples)
    • Takes 0.5-3ms per packet (non-critical)
    ↓ postMessage (Float32 samples, any length)
Main Thread
    ↓
BufferQueueNode (buffer-queue-node.js)
    • Queues decoded audio packets
    • ⚠️ Currently UNBOUNDED (see #201 for fix)
    ↓
AudioWorklet (playback-buffer-processor.js)
    • Dequeues buffers at constant rate
    • Fills with silence if queue empty (graceful)
    • Runs in audio thread (128 samples @ 2.67ms)
    ↓
AudioContext → Speakers (smooth playback)
```

**Key Asymmetry:**

- **Sender:** Must maintain strict 960-sample timing (no buffering possible)
- **Receiver:** Uses queue to absorb jitter (200-500ms typical latency)

**Known Issues:**

- [#201](https://github.com/Flexpair/mumbling-mole/issues/201) - Unbounded queue growth (memory leak)
- [#202](https://github.com/Flexpair/mumbling-mole/issues/202) - No configurable jitter buffer
- [#203](https://github.com/Flexpair/mumbling-mole/issues/203) - Missing Opus PLC for packet loss

### Build System

**Tool:** esbuild 0.25.10 (replaced webpack + Babel in October 2025)

**Performance:**
- Build time: **~0.3 seconds** (60x faster than webpack)
- Dependencies: **418 packages** (-70% reduction from 1,400)
- Bundle size: Optimized IIFE format for modern browsers

**Configuration:**
- `build-esbuild.mjs` - Complete build setup with plugins and validation
- Target: ES2020 (Chrome 66+, Firefox 76+, Safari 14.1+)

**Key Features:**
- ⚡ Native Go-based bundler (no transpilation overhead)
- 🧹 Always clean builds (~1s, fast enough to skip incremental logic)
- 📦 SCSS compilation via esbuild-sass-plugin
- 🔌 Node.js polyfills for browser (stream, crypto, path, buffer)
- 🎯 Custom fs-mock for mumble-streams protobuf loading
- 🚀 Build validation with artifact size checks

See [build-esbuild.mjs](./build-esbuild.mjs) for complete configuration.

## 🔧 Configuration

### Runtime Configuration

Default settings are in `app/config.js`. The build creates a mutable `dist/config.local.js` that you can modify without affecting source control:

```javascript
// dist/config.local.js (example)
window.mumbleWebConfig = {
  defaults: {
    address: 'voice.example.com',
    port: '443',
    username: '',
    password: ''
  }
}
```

> **Note:** Since builds always clean `dist/`, runtime configuration should be in `app/config.local.js` (source), which is copied to `dist/config.local.js` during each build.

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `MUMBLE_SERVER` | Target Mumble server (`host:port`) | Required for tunnel |
| `PORT` | HTTP server port | `80` |
| `SKIP_TUNNEL` | Disable WebSocket tunnel (static only) | `false` |
| `SKIP_PREPARE` | Skip build during `npm install` | `false` |
| `BUILD_MODE` | Build mode (`development` or `production`) | `production` |
| `PLAIN_TARGET` | Disable SSL for target server (E2E tests) | `false` |

## 🎨 Theming

Select themes via URL parameter: `?theme=ThemeName`

Available themes:
- `MetroMumbleLight` (default)
- `MetroMumbleDark`

Create custom themes by extending existing ones in `themes/` directory.

## 📜 NPM Scripts

### Building

| Command | Description |
|---------|-------------|
| `npm run build` | Clean build (always rebuilds all artifacts) |
| `npm run build:dev` | Development build (with source maps) |

### Testing

| Command | Description |
|---------|-------------|
| `npm run test` | Run full test suite (unit + Playwright + audit) |
| `npm run test:unit` | Run Jest unit tests (1395 tests) |
| `npm run test:unit:watch` | Jest in watch mode for TDD |
| `npm run test:unit:coverage` | Generate coverage reports |
| `npm run test:loopback` | Playwright loopback test (headless) |
| `npm run test:loopback:headed` | Playwright loopback test (visible browser) |
| `npm run test:loopback:debug` | Step-through debugging mode |
| `npm run test:server:up` | Start Murmur test server (docker-compose) |
| `npm run test:server:down` | Stop Murmur test server |
| `npm run test:server:logs` | View test server logs |
| `npm run audit:ci` | Dependency vulnerability check |

> **📘 Note:** This project uses **Jest unit tests** (1395 tests) + **Playwright E2E tests** for automated audio pipeline validation. See **[tests/README.md](./tests/README.md)** for comprehensive testing documentation.

### Development & Analysis

| Command | Description |
|---------|-------------|
| `npm run analyze` | Generate bundle analysis report |
| `npm run check:deps` | Find unused dependencies |
| `npm run validate:markdown` | Validate markdown structure rules |

### Maintenance

| Command | Description |
|---------|-------------|
| `npm run audit:baseline` | Update security audit baseline |
| `npm audit` | Check for vulnerabilities |

## 🧪 Testing

Umfassende Dokumentation für alle Test-Szenarien findest du in **[tests/README.md](./tests/README.md)**.

### Schnelltest

```bash
# Automatisierter Audio-System-Test (kein Server erforderlich)
npm run test:audio:system

# Vollständige Test-Suite
npm run test:full
```

### Wichtige Test-Kommandos

| Kommando | Beschreibung |
|----------|--------------|
| `npm run test:audio:system` | Audio-Komponenten-Test ohne Live-Server |
| `npm run test:full` | E2E + Audio + Security Tests |
| `npm run test:audio:suite` | Vollständige Audio-Test-Suite mit Server |
| `./scripts/quick-audio-test.sh` | All-in-One Test inkl. Server-Setup |

Für detaillierte Informationen zu Test-Szenarien, CI/CD-Integration, Troubleshooting und Codespace-spezifischen Anleitungen, siehe **[tests/README.md](./tests/README.md)**.

## 🐛 Troubleshooting

### Common Issues

#### Build fails with "vendors/mumble-client/lib not found"
```bash
# Rebuild vendored mumble-client
npm run build:vendor:mumble-client
npm run build
```

> **Note:** `vendors/mumble-client` is a `file:` protocol dependency, not from npm registry. After editing source in `vendors/mumble-client/src/`, you must run `npm run build:vendor:mumble-client` to transpile to `lib/`.

#### Audio not working / No microphone access
- Check browser permissions for microphone access
- Verify AudioContext is not suspended (check console, run `audioContextManager.getStats()`)
- Ensure HTTPS or localhost connection (required for getUserMedia)
- Check for `[AudioContext]` logs showing state changes
- Review browser autoplay policy compliance

#### WebSocket connection fails
```bash
# Check if tunnel is running
ps aux | grep websockify

# Verify logs
tail -f /tmp/entrypoint.log

# Test without tunnel (static only)
SKIP_TUNNEL=1 PORT=8081 ./docker-entrypoint.sh
```

#### Worker communication errors
- Check browser console for serialization errors
- Ensure both worker files are in sync (`app/worker.js` and `app/worker-client.js`)
- **Critical:** When adding worker events, update BOTH `_dispatchEvent` in `worker-client.js` AND `registerEventProxy` in `worker.js`
- Only pass numeric IDs across thread boundary (never serialize full objects)

#### Loopback test not working
- Ensure you're connected to a Mumble server that supports loopback (target 31)
- Check browser console for `[LOOPBACK]` prefixed messages
- Verify microphone permissions are granted
- Check that AudioContext is running (not suspended)
- **Remember:** Loopback only tests encode/decode, NOT client-to-client playback initialization

#### AudioWorklet processor errors
- `recorder-worker.js` and `playback-buffer-processor.js` **must be ES5-compatible**
- These files are **excluded from babel-loader** and copied verbatim to `dist/`
- Cannot use `import`/`require` statements in AudioWorklet processors
- Check webpack.config.js for exclusion rules

### Debug Mode

Enable verbose logging:
```javascript
// In browser console
localStorage.setItem('debug', 'true');
location.reload();
```

## 🤝 Contributing

We welcome contributions! Please follow these guidelines:

1. **Fork and clone** the repository
2. **Create a feature branch**: `git checkout -b feature/amazing-feature`
3. **Make your changes** following the coding conventions
4. **Test thoroughly**: `npm run test`
5. **Commit with descriptive messages**: `git commit -m 'Add amazing feature'`
6. **Push to your fork**: `git push origin feature/amazing-feature`
7. **Open a Pull Request`

### Coding Conventions

- **ES6+ JavaScript** for all files except AudioWorklet processors
- **AudioWorklet processors** (`recorder-worker.js`, `playback-buffer-processor.js`) must stay ES5-compatible
- **Worker protocol**: Update both `_dispatchEvent` (worker-client.js) AND `registerEventProxy` (worker.js) when adding events
- **Worker protocol**: Update both `_setProp` (worker-client.js) AND `pushProp` (worker.js) when adding properties
- **Never serialize objects** across worker boundary—only pass numeric IDs
- **AudioContext**: Always use `ensureAudioContext()` from `audio-context-manager.js`, never `new AudioContext()` directly
- **UI state**: All reactive state uses Vue 3 composables (`ref()`, `computed()`, `watch()`)
- **Localization**: Add strings to `localize/en.json` (multilanguage support is disabled)
- **Console logging**: Prefix debug logs with context tags: `[LOOPBACK]`, `[DEBUG-WORKER]`, `[DEBUG-DECODER]`, `[DEBUG-VOICE]`, `[AudioContext]`
- **Documentation**: Update `.github/copilot-instructions.md` for architectural changes
- **Git**: Never commit generated files (`dist/**`) or `dist/config.local.js`

## 📁 Project Structure

```
mumbling-mole/
├── app/                           # Application source
│   ├── index.js                   # UI entry point (AppState + Vue mount)
│   ├── worker.js                  # Web Worker (registerEventProxy + pushProp)
│   ├── worker-client.js           # Worker bridge (_dispatchEvent + _setProp)
│   ├── voice.js                   # Voice handlers (PTT/continuous + loopback)
│   ├── audio-context-manager.js   # AudioContext singleton (autoplay handling)
│   ├── recorder-worker.js         # AudioWorklet processor (ES5 only!)
│   ├── playback-buffer-processor.js # AudioWorklet processor (ES5 only!)
│   ├── decoder-stream.js          # Decoder worker pool
│   ├── encode-worker.js           # Opus encoder worker
│   ├── decode-worker.js           # Opus decoder worker
│   ├── buffer-queue-node.js       # Audio playback buffer
│   ├── mumble-websocket.js        # WebSocket → MumbleClient adapter
│   └── config.js                  # Default configuration
├── vendors/                       # Vendored packages (file: protocol deps)
│   ├── mumble-client/             # Forked Mumble protocol client
│   ├── mumble-streams/            # Mumble streaming utilities
│   └── netlify-identity-widget/   # Authentication widget
├── themes/                        # UI themes (SCSS)
│   └── MetroMumbleLight/          # Light/Dark theme variants
├── localize/                      # Translation files
│   └── en.json                    # English strings (only language)
├── scripts/                       # Build & test utilities
│   ├── audio-system-test.cjs      # Offline component validation
│   ├── audio-test.cjs             # Live roundtrip test
│   ├── audio-monitor.cjs          # Realtime VU meter
│   ├── e2e-check.cjs              # WebSocket smoke test
│   ├── run-all-tests.sh           # Primary test runner
│   └── quick-audio-test.sh        # All-in-one test wrapper
├── dist/                          # Build output (generated, never commit!)
│   └── config.local.js            # Runtime config (copied from app/config.local.js)
├── build-esbuild.mjs              # esbuild build script with validation
├── start-dev-server.sh            # Dev server launcher
├── docker-entrypoint.sh           # Websockify tunnel launcher
└── *.md                           # Documentation files
```

## 📚 Documentation

### For AI Assistants
- **[Copilot Instructions](.github/copilot-instructions.md)** – Essential patterns, architecture, workflows (start here!)

### Testing & Audio
- **[Testing Guide](tests/README.md)** – Comprehensive testing documentation
- **[Loopback Test Coverage](tests/playwright/README.md)** – What loopback tests can and cannot detect
- **[Audio Debug Guide](app/audio/README.md)** – Production audio debugging guide (client-to-client playback)

### Authentication
- **[Auth Abstraction Layer](app/auth/README.md)** – Authentication system architecture and migration guide

### Build & Configuration
- **[esbuild Build Script](build-esbuild.mjs)** – Build configuration with clean builds and validation
- **[Docker Entrypoint](docker-entrypoint.sh)** – Websockify tunnel setup

### Markdown Structure Rules

This project enforces strict markdown organization:

**Rules:**
1. ✅ Maximum **ONE** markdown file per directory
2. ✅ Must be named `README.md` (except `.github/copilot-instructions.md`)
3. ✅ Automatically validated via Git pre-commit hook

**Validation:**
```bash
# Manual validation
npm run validate:markdown

# Automatically runs on git commit
git commit -m "Your message"
```

**Why these rules?**
- Consistent documentation structure
- Easy navigation (always README.md)
- No confusion about which doc to read
- Enforced via automation (can't commit violations)

## 🔐 Security

- Regular dependency audits via `npm run audit:ci`
- Accepted vulnerabilities tracked in `audit-baseline.json`
- WebSocket-only connections (no direct TCP from browser)
- `websockify` bridges WebSocket ↔ TCP Mumble protocol server-side
- Netlify Identity integration for optional authentication
- Content Security Policy enforced

## ⚠️ Known Limitations

- **No unit tests**: Only integration/E2E tests exist (see [tests/README.md](./tests/README.md))
- **Build complexity**: Multi-stage build with vendor transpilation can be fragile
- **GlobalBindings anti-pattern**: 1474-line god object centralizes all UI state
- **AudioWorklet constraints**: Processors can't use imports, must be ES5-compatible
- **Loopback test limitations**: Tests encode/decode but NOT cross-client playback initialization

## 📄 License

The upstream mumble-web project is licensed under the ISC License - see [upstream/LICENSE](upstream/LICENSE) for details.

The licensing for modifications in this fork is pending.

## 🙏 Acknowledgments

- Built on [mumble-web](https://github.com/johni0702/mumble-web) project
- Theme inspired by [MetroMumble](https://github.com/xPoke/MetroMumble)
- Audio processing powered by [libsamplerate.js](https://github.com/aolsenjazz/libsamplerate-js)

---

<p align="center">
  Made with ❤️ for the Flexpair community
</p>
