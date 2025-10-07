# 🎤 Mumbling Mole

> A modern, browser-first Mumble voice chat client with no native dependencies

[![Node.js Version](https://img.shields.io/badge/node-%E2%89%A522.0.0-brightgreen)](https://nodejs.org/)

Mumbling Mole brings Mumble voice communication to any modern web browser without requiring native client installation. Built on the upstream `mumble-web` project, it features a reproducible build pipeline, vendor isolation, and tooling optimized for Flexpair deployments.

## ✨ Features

- 🎙️ **Browser-native audio capture** – Uses Web Audio API with Opus encoding
- 🔌 **WebSocket tunneling** – TCP voice streams over WebSocket connections (no WebRTC required)
- 🎨 **Themeable interface** – MetroMumble-inspired Light/Dark themes
- 👷 **Web Worker architecture** – Offloads audio processing from main thread
- 🌍 **English interface** – Optimized English-only localization for performance
- 📦 **Smart build system** – Incremental builds with vendor dependency management
- 🐳 **Docker-ready** – Containerized development and production environments

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

## 🏗️ Architecture

```
┌──────────────────────────────────────────────────────────────┐
│                      Browser Window                          │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌──────────────────────────────┐  ┌──────────────────────┐ │
│  │     Main Thread (UI)          │  │    Web Worker        │ │
│  │                               │  │                      │ │
│  │  • Knockout.js MVVM           │◄─┤  • mumble-client     │ │
│  │  • GlobalBindings state       │  │  • Audio resampling  │ │
│  │  • Netlify Identity auth      │  │  • Opus encoding     │ │
│  │  • Guacamole iframe gating    │  │  • Event dispatch    │ │
│  │  • Localization & Theming     │  │  • ID serialization  │ │
│  └──────────┬───────────────────┘  └──────────┬───────────┘ │
│             │                                  │             │
│  ┌──────────▼───────────────────────────────────┐           │
│  │         AudioContext + AudioWorklet           │           │
│  │     (48 kHz mono PCM, 960 samples/packet)    │           │
│  │  audio-context-manager.js + recorder-worker  │           │
│  └────────────────────────────────────────────────┘          │
│                                                              │
└──────────────────────────────────────────────────────────────┘
                              │
                              ▼
                    ┌──────────────────┐
                    │   WebSocket API   │
                    └──────────────────┘
                              │
                              ▼
                    ┌──────────────────┐
                    │   websockify      │
                    │ (WebSocket→TCP)   │
                    └──────────────────┘
                              │
                              ▼
                    ┌──────────────────┐
                    │   Mumble Server   │
                    │    (TCP:64738)    │
                    └──────────────────┘
```

### Key Components

- **Main Thread** (`app/index.js`): Bootstraps `GlobalBindings`, handles authentication, and dispatches voice controls
- **Web Worker** (`app/worker.js`): Manages `mumble-client`, mirrors channel/user trees via serialized IDs, handles Opus resampling
- **Audio Pipeline**: `audio-context-manager.js` maintains shared `AudioContext`; `voice.js` handles continuous/PTT; `recorder-worker.js` captures 48 kHz mono
- **Worker Communication**: UI and Worker exchange only numeric IDs (not object references) for serialization safety

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

> **Important:** Remember to back up `dist/config.local.js` before clean rebuilds.

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `MUMBLE_SERVER` | Target Mumble server (`host:port`) | Required for tunnel |
| `PORT` | HTTP server port | `80` |
| `SKIP_TUNNEL` | Disable WebSocket tunnel (static only) | `false` |
| `SKIP_PREPARE` | Skip build during `npm install` | `false` |

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

**Build internals:**
- `smart-build.sh` respects `dist/.build-marker` and `dist/.build-mode` for incremental builds
- Auto-compiles `vendors/mumble-client` when `lib/` is missing
- Copies `config.local.js` and `recorder-worker.js` to `dist/`
- Uses Webpack 5: `asset/resource` for images/SVGs, explicit polyfills for `buffer`/`util`/`process`
- `prepare` script runs automatically during `npm install` (skip with `SKIP_PREPARE=1`)

### Testing

| Command | Description |
|---------|-------------|
| `npm run test` | Run E2E tests + security audit |
| `npm run test:full` | Run all tests (E2E + Audio + Audit) |
| `npm run test:audio:system` | Audio system test (no server needed) |
| `npm run test:audio:suite` | Complete audio test suite |
| `./scripts/quick-audio-test.sh` | All-in-one test with auto server setup |

**Test modes:**
- E2E tests support `--mode=container` for CI validation
- Set `PLAIN_TARGET=1` for non-TLS tunneling scenarios

> See **[TESTING.md](./TESTING.md)** for comprehensive testing documentation.

### Development & Analysis

| Command | Description |
|---------|-------------|
| `npm run analyze` | Generate bundle analysis report |
| `npm run check:deps` | Find unused dependencies |

### Maintenance

| Command | Description |
|---------|-------------|
| `npm run audit:baseline` | Update security audit baseline |
| `npm audit` | Check for vulnerabilities |

## 🧪 Testing

Umfassende Dokumentation für alle Test-Szenarien findest du in **[TESTING.md](./TESTING.md)**.

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

Für detaillierte Informationen zu Test-Szenarien, CI/CD-Integration, Troubleshooting und Codespace-spezifischen Anleitungen, siehe **[TESTING.md](./TESTING.md)**.

## 🐛 Troubleshooting

### Common Issues

#### Build fails with "vendors/mumble-client/lib not found"
```bash
# Force rebuild vendored dependencies
npm run build:vendor:mumble-client
npm run build:force
```

#### Audio not working / No microphone access
- Check browser permissions for microphone access
- Verify AudioContext is not suspended (check console)
- Ensure HTTPS or localhost connection (required for getUserMedia)

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
- Remember: Workers and UI exchange only numeric IDs, never object references

### Debug Mode

Enable verbose logging:
```javascript
// In browser console
localStorage.setItem('debug', 'true');
location.reload();
```

Access AudioContext stats:
```javascript
// In browser console
audioContextManager.getStats();
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

- Use ES6+ JavaScript features
- **Worker/UI protocol**: Exchange only numeric IDs (not object references); update `_dispatchEvent` in both `worker-client.js` and `worker.js` when adding events
- **Audio invariants**: 48 kHz mono, 960-sample frames; adjust `voice.js`, worker resampler, and `Settings` together
- **AudioContext**: Always use `ensureAudioContext()` from `audio-context-manager.js` (never instantiate directly)
- **Knockout.js**: Use `ko.observable(value)`, `.subscribe()` for watchers, `ko.computed()` for computed values
- **State persistence**: Store UI state in `GlobalBindings` observables, persist via `localStorage` with `mumble.*` keys
- Update localization strings in `localize/en.json` when adding new UI text
- Keep generated files (`dist/**`, `config.local.js`) out of commits

## 📁 Project Structure

```
mumbling-mole/
├── app/                    # Application source
│   ├── index.js           # UI entry point
│   ├── worker.js          # Web Worker
│   └── voice.js           # Audio processing
├── vendors/               # Vendored packages
│   └── mumble-client/     # Forked client library
├── themes/                # UI themes
├── localize/              # English translations
├── scripts/               # Build & test utilities
├── dist/                  # Build output (generated)
└── *.sh                   # Shell scripts
```

## 📚 Documentation

- [Testing Guide](TESTING.md) – Comprehensive testing documentation
- [Copilot Instructions](.github/copilot-instructions.md) – AI assistant context & development guide
- [Webpack Config](webpack.config.js) – Webpack 5 build configuration

## 🔐 Security

- Regular dependency audits via `npm audit`
- Accepted vulnerabilities tracked in `audit-ci.json`
- WebSocket-only connections (no direct TCP from browser)
- Content Security Policy enforced

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
