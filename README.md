# 🎤 Mumbling Mole

> A modern, browser-first Mumble voice chat client with no native dependencies

[![Node.js Version](https://img.shields.io/badge/node-%E2%89%A522.0.0-brightgreen)](https://nodejs.org/)

Mumbling Mole brings Mumble voice communication to any modern web browser without requiring native client installation. Built on the upstream `mumble-web` project, it features a reproducible build pipeline, vendor isolation, and tooling optimized for Flexpair deployments.

## ✨ Features

- 🎙️ **Browser-native audio capture** – Uses Web Audio API with Opus encoding
- 🔌 **WebSocket tunneling** – TCP voice streams over WebSocket connections (no WebRTC required)
- 🎨 **Themeable interface** – MetroMumble-inspired Light/Dark themes
- 👷 **Web Worker architecture** – Offloads audio processing from main thread
- 🌍 **Multi-language support** – Full localization system
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
┌─────────────────────────────────────────────────────────────┐
│                      Browser Window                         │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌─────────────────────────────┐  ┌──────────────────────┐ │
│  │     Main Thread (UI)         │  │    Web Worker        │ │
│  │                              │  │                      │ │
│  │  • Knockout.js MVVM          │◄─┤  • mumble-client     │ │
│  │  • GlobalBindings state      │  │  • Audio resampling  │ │
│  │  • Localization              │  │  • Opus encoding     │ │
│  │  • Theme management          │  │  • Event dispatch    │ │
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

### Development

| Command | Description |
|---------|-------------|
| `npm run analyze` | Generate bundle analysis report |
| `npm run check:deps` | Find unused dependencies |
| `npm run test` | Run all tests (E2E + security audit) |
| `npm run test:e2e` | Run WebSocket smoke test only |

### Maintenance

| Command | Description |
|---------|-------------|
| `npm run audit:baseline` | Update security audit baseline |
| `npm audit` | Check for vulnerabilities |

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

- Use ES6+ JavaScript features
- Maintain Worker/UI protocol compatibility
- Add localization strings to all locale files
- Update both README.md and CLAUDE.md for architectural changes
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
├── localize/              # Translation files
├── scripts/               # Build & test utilities
├── dist/                  # Build output (generated)
└── *.sh                   # Shell scripts
```

## 📚 Documentation

- [Architecture Details](CLAUDE.md) – In-depth technical documentation
- [Copilot Instructions](.github/copilot-instructions.md) – AI assistant context
- [Webpack Config](webpack.config.js) – Build configuration

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
