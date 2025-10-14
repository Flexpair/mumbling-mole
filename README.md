# 🎤 Mumbling Mole

> A modern, browser-first Mumble voice chat client with no native dependencies

[![Node.js Version](https://img.shields.io/badge/node-%E2%89%A522.0.0-brightgreen)](https://nodejs.org/)

Mumbling Mole brings Mumble voice communication to any modern web browser without requiring native client installation. Built on the upstream `mumble-web` project, it features a reproducible build pipeline, vendor isolation, and tooling optimized for Flexpair deployments.

## ✨ Features

- 🎙️ **Browser-native audio capture** – Uses Web Audio API with Opus encoding via AudioWorklet
- 🔌 **WebSocket tunneling** – TCP voice streams over WebSocket connections (no WebRTC required)
- 🎨 **Themeable interface** – MetroMumble-inspired Light/Dark themes
- 👷 **Web Worker architecture** – Offloads Mumble protocol & audio encoding from main thread
- � **English interface** – Localization system (multilanguage support disabled since v0.5.0)
- 📦 **Smart build system** – Incremental builds with vendor dependency management
- 🐳 **Docker-ready** – Containerized development and production environments
- 🔊 **Audio loopback testing** – Built-in server loopback mode for testing audio encode/decode path
- 🖥️ **Guacamole integration** – Optional remote desktop access after Netlify Identity authentication

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

> **Note:** The `prepare` script automatically runs `smart-build.sh` during installation to generate the `dist/` directory.

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

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      Browser Window                         │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌─────────────────────────────┐  ┌──────────────────────┐ │
│  │     Main Thread (UI)         │  │    Web Worker        │ │
│  │                              │  │                      │ │
│  │  • Knockout.js MVVM          │◄─┤  • mumble-client     │ │
│  │  • GlobalBindings facade     │  │  • Audio resampling  │ │
│  │    - AudioManager            │  │  • Opus encoding     │ │
│  │    - ConnectionManager       │  │  • Event dispatch    │ │
│  │    - ChannelManager          │  │                      │ │
│  │    - UIStateManager          │  │                      │ │
│  │  • Localization              │  │                      │ │
│  │  • Theme management          │  │                      │ │
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

> **⚠️ Critical:** Always back up `dist/config.local.js` before running `npm run build:force` or `smart-build.sh --force`, as these commands wipe the entire `dist/` directory. The file is copied from `app/config.local.js` if missing after builds.

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `MUMBLE_SERVER` | Target Mumble server (`host:port`) | Required for tunnel |
| `PORT` | HTTP server port | `80` |
| `SKIP_TUNNEL` | Disable WebSocket tunnel (static only) | `false` |
| `SKIP_PREPARE` | Skip build during `npm install` | `false` |
| `WEBPACK_MODE` | Build mode (`development` or `production`) | `production` |
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
| `npm run build` | Incremental build (checks timestamps) |
| `npm run build:force` | Clean rebuild of all artifacts |
| `npm run build:vendor:mumble-client` | Rebuild vendored mumble-client |

### Testing

| Command | Description |
|---------|-------------|
| `npm run test` | Run full test suite via `run-all-tests.sh` |
| `npm run test:quick` | Fast test: audio-system + E2E + audit |
| `npm run test:audio:system` | Audio system test (no server needed) ⚡ Fastest |
| `npm run test:audio` | Single audio roundtrip test (requires server) |
| `npm run test:audio:suite` | Complete audio test suite |
| `npm run test:e2e` | WebSocket smoke test |
| `npm run test:server:up` | Start Murmur test server (docker-compose) |
| `npm run test:server:down` | Stop Murmur test server |
| `npm run test:server:logs` | View test server logs |
| `./scripts/quick-audio-test.sh` | All-in-one: start server, test, cleanup |

> **📘 Note:** This project has **zero unit tests** (only integration/E2E tests). See **[tests/README.md](./tests/README.md)** for comprehensive testing documentation.

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
# Force rebuild vendored dependencies
npm run build:vendor:mumble-client
npm run build:force
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
- **Manager pattern**: New functionality should be added to appropriate managers (`app/managers/`) instead of GlobalBindings
- **UI state**: Observables should be owned by managers but exposed via GlobalBindings for Knockout bindings
- **Localization**: Add strings to `localize/en.json` (multilanguage support is disabled)
- **Console logging**: Prefix debug logs with context tags: `[LOOPBACK]`, `[DEBUG-WORKER]`, `[DEBUG-DECODER]`, `[DEBUG-VOICE]`, `[AudioContext]`
- **Documentation**: Update `.github/copilot-instructions.md` for architectural changes
- **Git**: Never commit generated files (`dist/**`) or `dist/config.local.js`

## 📁 Project Structure

```
mumbling-mole/
├── app/                           # Application source
│   ├── index.js                   # UI entry point (GlobalBindings facade)
│   ├── managers/                  # Manager classes (extracted from GlobalBindings)
│   │   ├── AudioManager.js        # Audio, beeper, mic permissions (386 lines)
│   │   ├── ConnectionManager.js   # Connection state, client (50 lines)
│   │   ├── ChannelManager.js      # Channel/user tree, context menus (273 lines)
│   │   ├── UIStateManager.js      # UI state, dialogs, modals (43 lines)
│   │   └── README.md              # Manager architecture documentation
│   ├── worker.js                  # Web Worker (registerEventProxy + pushProp)
│   ├── worker-client.js           # Worker bridge (_dispatchEvent + _setProp)
│   ├── audio/                     # Audio subsystem
│   │   ├── voice.js               # Voice handlers (PTT/continuous + loopback)
│   │   ├── audio-context-manager.js # AudioContext singleton (autoplay handling)
│   │   ├── recorder-worker.js     # AudioWorklet processor (ES5 only!)
│   │   ├── playback-buffer-processor.js # AudioWorklet processor (ES5 only!)
│   │   ├── decoder-stream.js      # Decoder worker pool
│   │   ├── encode-worker.js       # Opus encoder worker
│   │   ├── decode-worker.js       # Opus decoder worker
│   │   └── buffer-queue-node.js   # Audio playback buffer
│   ├── auth/                      # Authentication abstraction layer
│   │   ├── AuthFactory.js         # Provider factory
│   │   ├── NetlifyIdentityAdapter.js # Netlify Identity provider
│   │   └── README.md              # Auth migration guide
│   ├── mumble-websocket.js        # WebSocket → MumbleClient adapter
│   └── config.js                  # Default configuration
├── vendors/                       # Vendored packages (file: protocol deps)
│   ├── mumble-client/             # Forked Mumble protocol client
│   ├── mumble-streams/            # Mumble streaming utilities
│   ├── netlify-identity-widget/   # Authentication widget
│   └── web-audio-buffer-queue/    # Deprecated (replaced by buffer-queue-node.js)
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
│   ├── .build-marker              # Incremental build tracker
│   ├── .build-mode                # Current build mode
│   └── config.local.js            # Runtime config overrides (back up!)
├── smart-build.sh                 # Incremental build orchestrator
├── webpack.config.js              # Webpack 5 configuration
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
- **[Webpack Config](webpack.config.js)** – Build configuration (Webpack 5)
- **[Smart Build Script](smart-build.sh)** – Incremental build logic
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
