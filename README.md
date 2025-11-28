# 🎤 Mumbling Mole

> A modern, browser-first Mumble voice chat client with no native dependencies

[![Node.js Version](https://img.shields.io/badge/node-%E2%89%A522.0.0-brightgreen)](https://nodejs.org/)

Mumbling Mole brings Mumble voice communication to any modern web browser without requiring native client installation. Built on the upstream [mumble-web](https://github.com/johni0702/mumble-web) project, it features Vue.js 3 with Pinia state management, esbuild for fast builds, and containerized development workflows optimized for the Flexpair ecosystem.

**Key Stats:** 803 commits · Version 4.0.3 · Vue.js 3.5.25 · esbuild 0.27.0

## ✨ Features

- 🎙️ **Browser-native audio capture** – Web Audio API with Opus encoding via AudioWorklet
- 🔌 **WebSocket tunneling** – TCP voice streams over WebSocket (no WebRTC required)
- ⚡ **Vue.js 3 + Pinia** – Modern reactive UI with centralized state management
- 🎨 **Themeable interface** – MetroMumble-inspired Light/Dark themes
- 👷 **Web Worker architecture** – Offloads Mumble protocol & audio encoding
- 📦 **Fast builds** – esbuild compiles in ~0.3 seconds (60x faster than webpack)
- 🐳 **Docker-ready** – Containerized development and production environments
- 🔊 **Audio loopback testing** – Built-in server loopback for audio validation
- 🖥️ **Guacamole integration** – Optional remote desktop after authentication

---

## 🚀 Quick Start

### Prerequisites

- **Node.js** ≥ 22.0.0
- **npm** ≥ 10.0.0
- **Docker** (optional)
- A reachable **Mumble server** (`host:port`)

### Install & Run

```bash
git clone https://github.com/Flexpair/mumbling-mole.git
cd mumbling-mole
npm install

# Start development server
MUMBLE_SERVER=voice.example.com:64738 ./start-dev-server.sh
```

This builds assets, starts websockify tunnel, and serves UI at `http://local.flexpair.app`.

### Test Audio (Loopback)

1. Connect to a Mumble server
2. Click **Test** button (blue, next to Connect)
3. Speak into microphone → audio loops back through server

> ⚠️ Loopback tests encode/decode, NOT cross-client playback. See [app/audio/README.md](./app/audio/README.md).

---

## 🏗️ Architecture

### High-Level Overview

```
┌─────────────────────────────────────────────────────────────┐
│                      Browser Window                         │
├─────────────────────────────────────────────────────────────┤
│  Main Thread (UI)              │    Web Worker              │
│  • Vue.js 3 Components         │    • Mumble protocol       │
│  • Pinia Stores (7 modules)    │    • Audio resampling      │
│  • AppState (coordinator)      │    • Opus encoding         │
└────────────────────────────────┴────────────────────────────┘
              │                              │
              ▼                              ▼
        AudioContext                   WebSocket API
        (48kHz mono)                        │
              │                              ▼
              └──────────────┬───────────────┘
                             ▼
                      Mumble Server (TCP:64738)
                      via websockify tunnel
```

### Threading Model

| Thread | Responsibility | Key Files |
|--------|---------------|-----------|
| **Main Thread** | Vue.js UI, Pinia stores, user interaction | `app/index.js`, `app/components/*.vue` |
| **Web Worker** | Mumble protocol, audio encoding/decoding | `app/worker.js`, `app/mumble-client/` |
| **AudioWorklet** | Real-time audio capture (48kHz, 960 samples) | `app/audio/recorder-worker.js` |

### State Management (Pinia Stores)

| Store | Purpose | Location |
|-------|---------|----------|
| `connectionStore` | WebSocket/client connection state | `app/stores/connectionStore.js` |
| `audioStore` | AudioContext singleton management | `app/stores/audioStore.js` |
| `voiceStore` | Voice handler and loopback mode | `app/stores/voiceStore.js` |
| `uiStore` | Modals, message boxes, UI state | `app/stores/uiStore.js` |
| `userStore` | Current user, mute/deaf status | `app/stores/userStore.js` |

### Vue.js Components

| Component | Purpose |
|-----------|---------|
| `App.vue` | Root component, layout management |
| `ConnectDialog.vue` | Server connection interface |
| `SettingsDialog.vue` | Audio and user preferences |
| `Toolbar.vue` | Main control bar (mute, deaf, test) |
| `ConnectionInfoDialog.vue` | Server and build information |

### Audio Pipeline

**Asymmetric design** optimized for real-time capture and jitter-tolerant playback:

#### Capture Path (Send)

```
Microphone → getUserMedia() → AudioContext (48kHz)
    → AudioWorklet (recorder-worker.js)
        → 960-sample frames every 20ms (FIXED constraint)
    → Web Worker (encode-worker.js)
        → Opus encoding (libopus.js WASM)
    → WebSocket → websockify → Mumble Server
```

#### Playback Path (Receive)

```
Mumble Server → websockify → WebSocket
    → Web Worker (decode-worker.js pool)
        → Opus decoding (variable frame sizes)
    → BufferQueueNode (jitter buffer)
    → AudioWorklet → Speakers
```

**Critical Constraint:** `recorder-worker.js` MUST output 960-sample frames. Changing this requires coordinated updates across AudioWorklet, worker resampler, and Opus encoder.

---

## 💻 Browser Compatibility

| Browser | Version | Notes |
|---------|---------|-------|
| **Safari** | 14.1+ | Primary constraint (AudioWorklet) |
| **Chrome** | 66+ | Full support |
| **Firefox** | 76+ | Full support |
| **Edge** | 80+ | Chromium-based |

**Required features:** AudioWorklet API, Web Audio API, getUserMedia, WebSocket, Web Workers, ES2020

---

## 🐳 Docker Deployment

### Build Images

```bash
# Production with version info
docker build \
  --build-arg GIT_COMMIT=$(git rev-parse HEAD) \
  --target prod \
  -t mumbling-mole:prod .

# Development with full tooling
docker build --target dev -t mumbling-mole:dev .
```

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `MUMBLE_SERVER` | Target server (`host:port`) | Required |
| `PORT` | HTTP server port | `80` |
| `BUILD_MODE` | `development` / `production` | `production` |
| `SKIP_TUNNEL` | Disable websockify | `false` |
| `GIT_COMMIT` | Build version info | auto-detected |

---

## 🔧 Configuration

### Runtime Config

Default settings in `app/config.js`. Override in `app/config.local.js` (copied to `dist/` during build):

```javascript
window.mumbleWebConfig = {
  defaults: {
    address: 'voice.example.com',
    port: '443',
    username: '',
    password: ''
  }
}
```

### Theming

Select via URL parameter: `?theme=MetroMumbleLight` or `?theme=MetroMumbleDark`

---

## 📜 NPM Scripts

### Building

| Command | Description |
|---------|-------------|
| `npm run build` | Clean production build (~0.3s) |
| `npm run build:dev` | Development build with source maps |
| `npm run build:local` | Build + restart dev server |

### Testing

| Command | Description |
|---------|-------------|
| `npm test` | Full suite (unit + Playwright + audit) |
| `npm run test:unit` | Jest unit tests (1,477 tests) |
| `npm run test:unit:coverage` | Generate coverage reports |
| `npm run test:loopback` | Playwright E2E (headless) |
| `npm run test:loopback:headed` | Playwright with visible browser |

### Analysis

| Command | Description |
|---------|-------------|
| `npm run check:deps` | Find unused dependencies |
| `npm run audit:ci` | Security vulnerability check |
| `npm run validate:markdown` | Validate markdown structure |

---

## 🧪 Testing

### Test Coverage

| Module | Coverage |
|--------|----------|
| AudioState | 93.6% |
| ConnectionState | 100% |
| UIState | 100% |
| UserState | 94.47% |
| VoiceState | 97.82% |
| worker-client.js | 92.92% |
| voice.js | 96.02% |

### E2E Tests (Playwright)

- 440 Hz loopback frequency validation
- Mute/deaf state testing
- Guacamole iframe verification
- Real Netlify Identity authentication

See **[tests/README.md](./tests/README.md)** for comprehensive testing documentation.

---

## 🐛 Troubleshooting

### Audio Issues

```javascript
// Check AudioContext state in browser console
audioContextManager.getStats()
```

- Verify microphone permissions (HTTPS required)
- Check for `[AudioContext]` logs showing state changes
- AudioWorklet processors must be ES5-compatible

### WebSocket Issues

```bash
# Check tunnel status
ps aux | grep websockify
tail -f /tmp/entrypoint.log

# Test without tunnel
SKIP_TUNNEL=1 PORT=8081 ./docker-entrypoint.sh
```

### Worker Errors

- Check browser console for serialization errors
- Worker events: update BOTH `_dispatchEvent` (worker-client.js) AND `registerEventProxy` (worker.js)
- Only pass numeric IDs across thread boundary

### Debug Mode

```javascript
localStorage.setItem('debug', 'true');
location.reload();
```

---

## 📁 Project Structure

```
mumbling-mole/
├── app/                           # Application source
│   ├── index.js                   # Entry point (Pinia + Vue mount)
│   ├── components/                # Vue.js components
│   ├── stores/                    # Pinia stores (7 modules)
│   ├── audio/                     # Audio processing pipeline
│   ├── worker.js                  # Web Worker
│   ├── worker-client.js           # Worker bridge
│   └── mumble-client/             # Vendored protocol client
├── themes/                        # SCSS themes
├── localize/                      # Translation files (en.json)
├── tests/                         # Jest + Playwright tests
├── scripts/                       # Build & test utilities
├── build-esbuild.mjs              # Build configuration
└── dist/                          # Generated output (never commit)
```

---

## 🤝 Contributing

1. Fork and clone the repository
2. Create feature branch: `git checkout -b feature/amazing-feature`
3. Follow coding conventions (see below)
4. Test: `npm test`
5. Commit with descriptive messages
6. Open a Pull Request

### Coding Conventions

- **ES6+ JavaScript** for all files (except AudioWorklet processors → ES5)
- **Pinia stores** for state management (`useXStore()` pattern)
- **Vue 3 Composition API** with `<script setup>`
- **Conventional commits**: `feat:`, `fix:`, `refactor:`, `docs:`
- **Worker protocol**: Update both `_dispatchEvent`/`registerEventProxy` for events
- **AudioContext**: Always use `ensureAudioContext()`, never `new AudioContext()`
- **Console logs**: Prefix with `[LOOPBACK]`, `[DEBUG-WORKER]`, etc.

---

## 👥 Team & Contributors

### Current Maintainers (2025)

| Contributor | Role | Focus |
|-------------|------|-------|
| **Jens Fielenbach** | Primary Developer | Architecture, Vue.js, audio |
| **Flexpair.com** | Organization | CI/CD, infrastructure |
| **Dependabot** | Automation | Security updates |

### Historical Contributors

| Contributor | Era | Contributions |
|-------------|-----|---------------|
| **Jonas Herzig** | 2016-2022 | Original mumble-web creator |
| **healideal** | 2020-2021 | Major features |
| **Jafudi** | 2020 | Fork initialization |

---

## ⚠️ Known Limitations

- **AudioWorklet constraints**: Processors must be ES5-compatible, no imports
- **Unbounded playback queue**: Memory leak risk ([#201](https://github.com/Flexpair/mumbling-mole/issues/201))
- **No configurable jitter buffer**: Fixed latency ([#202](https://github.com/Flexpair/mumbling-mole/issues/202))
- **Missing Opus PLC**: Packet loss causes clicks ([#203](https://github.com/Flexpair/mumbling-mole/issues/203))

---

## 🔐 Security

- Regular dependency audits via `npm run audit:ci`
- Vulnerabilities tracked in `audit-baseline.json`
- WebSocket-only connections (no direct TCP)
- Netlify Identity for authentication
- Content Security Policy enforced

---

## 📚 Documentation

| Document | Purpose |
|----------|---------|
| [Copilot Instructions](.github/copilot-instructions.md) | AI assistant patterns & architecture |
| [Testing Guide](tests/README.md) | Comprehensive testing docs |
| [Audio Debug Guide](app/audio/README.md) | Production audio debugging |
| [Auth Guide](app/auth/README.md) | Authentication architecture |
| [Stores Guide](app/stores/README.md) | Pinia migration status |

---

## 📄 License

The upstream mumble-web project is licensed under the ISC License - see [upstream/LICENSE](upstream/LICENSE).

Licensing for modifications in this fork is pending.

## 🙏 Acknowledgments

- [mumble-web](https://github.com/johni0702/mumble-web) – Original project by Jonas Herzig
- [MetroMumble](https://github.com/xPoke/MetroMumble) – Theme inspiration
- [libsamplerate.js](https://github.com/aolsenjazz/libsamplerate-js) – Audio processing

---

<p align="center">
  Made with ❤️ for the Flexpair community
</p>
