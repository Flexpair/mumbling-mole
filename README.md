# 🎤 Mumbling Mole

> Browser-first [Mumble](https://en.wikipedia.org/wiki/Mumble_(software)) voice chat client – no native dependencies required

[![Node.js Version](https://img.shields.io/badge/node-%E2%89%A522.0.0-brightgreen)](https://nodejs.org/)

Mumbling Mole brings Mumble voice communication to modern browsers via Vue.js 3, Web Audio API with AudioWorklet, and [WebSocket](https://en.wikipedia.org/wiki/WebSocket) tunneling (NOT [WebRTC](https://en.wikipedia.org/wiki/WebRTC)). Built on [mumble-web](https://github.com/johni0702/mumble-web).

**v4.0.3** · Vue.js 3.5.25 · [esbuild](https://en.wikipedia.org/wiki/Esbuild) 0.27.0 · 1,477 unit tests

## ✨ Features

- 🎙️ **Browser-native audio** – AudioWorklet + [Opus](<https://en.wikipedia.org/wiki/Opus_(audio_format)>) via WASM
- 🔌 **WebSocket tunneling** – TCP over WebSocket (no WebRTC)
- ⚡ **Vue.js 3 + Pinia** – Modern reactive UI with 7 state stores
- 📦 **Fast builds** – esbuild compiles in ~0.3s
- 🐳 **Docker-ready** – Containerized dev and production
- 🔊 **Audio loopback** – Built-in 440Hz test for validation

---

## 🚀 Quick Start

```bash
git clone https://github.com/Flexpair/mumbling-mole.git
cd mumbling-mole && npm install

# Development
./start-dev-server.sh          # Build + serve at http://local.flexpair.app
npm run build:local            # Rebuild + restart server

# Testing  
npm test                       # Full suite: unit + E2E + audit
npm run test:unit              # Jest (1,477 tests)
npm run test:loopback:headed   # Playwright with visible browser

# Production
npm run build                  # Clean build (~0.3s)
```

**Test audio:** Connect → Click **Test** → Speak into mic → Hear echo

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────┐
│  Main Thread                   │    Web Worker               │
│  • Vue.js 3 + Pinia stores     │    • Mumble protocol        │
│  • AppState coordinator        │    • Opus encoding (WASM)   │
│  • AudioContext singleton      │    • Channel/user trees     │
└────────────────────────────────┴─────────────────────────────┘
              │                              │
         AudioWorklet                   WebSocket
        (48kHz capture)                     │
              └────────────websockify───────┘
                               ↓
                     Mumble Server (TCP:64738)
```

### Key Files

| Concern | Files |
|---------|-------|
| **Entry/UI** | `app/index.js` → `app/components/App.vue` |
| **State** | `app/stores/*.js` (7 Pinia stores) |
| **Audio** | `voice.js` → `recorder-worker.js` → `encode-worker.js` |
| **Network** | `worker-client.js` ↔ `worker.js` → `mumble-websocket.js` |

### Audio Pipeline

- **Send**: `recorder-worker.js` (960 samples @ 48kHz) → [Opus](<https://en.wikipedia.org/wiki/Opus_(audio_format)>) WASM → WebSocket
- **Receive**: WebSocket → decoder pool → jitter buffer → speakers
- **⚠️ Critical**: Sender MUST output 960-sample frames (20ms @ 48kHz)

---

## 🐳 Docker

```bash
# Production
docker build --target prod -t mumbling-mole:prod \
  --build-arg GIT_COMMIT=$(git rev-parse HEAD) .

# Development  
docker build --target dev -t mumbling-mole:dev .
```

| Variable | Description | Default |
|----------|-------------|---------|
| `MUMBLE_SERVER` | Target `host:port` | Required |
| `PORT` | HTTP server port | `80` |
| `SKIP_TUNNEL` | Disable websockify | `false` |

---

## 🔧 Configuration

**Runtime config**: `app/config.js` (defaults) + `app/config.local.js` (overrides)

```javascript
window.mumbleWebConfig = {
  defaults: { address: 'voice.example.com', port: '443' }
}
```

**Theming**: `?theme=MetroMumbleLight` or `MetroMumbleDark`

---

## 🐛 Troubleshooting

```bash
# Tunnel logs
tail -f /tmp/entrypoint.log

# Audio state (browser console)  
audioContextManager.getStats()
```

- **No audio?** Check mic permissions (HTTPS required)
- **Worker errors?** Update BOTH `_dispatchEvent` AND `registerEventProxy`
- **AudioWorklet?** Must be ES5 – no imports/requires

---

## 📁 Project Structure

```
app/
├── index.js              # Entry (Pinia + Vue mount)
├── components/           # Vue.js components
├── stores/               # Pinia stores (7 modules)
├── audio/                # AudioWorklet + codec workers
├── worker.js             # Web Worker (Mumble protocol)
├── worker-client.js      # Main↔Worker bridge
└── mumble-client/        # Vendored protocol client
```

---

## 📚 Documentation

| Document | Purpose |
|----------|---------|
| [.github/copilot-instructions.md](.github/copilot-instructions.md) | AI coding agent guide |
| [tests/README.md](tests/README.md) | Testing strategy |
| [app/audio/README.md](app/audio/README.md) | Audio debugging |
| [app/stores/README.md](app/stores/README.md) | Pinia architecture |
| [app/auth/README.md](app/auth/README.md) | Auth abstraction |

---

## ⚠️ Known Issues

- **#201**: Unbounded playback queue (memory leak risk)
- **#202**: No configurable jitter buffer
- **#203**: Missing [Opus](<https://en.wikipedia.org/wiki/Opus_(audio_format)>) PLC (packet loss → clicks)

---

## 🤝 Contributing

1. Fork → `git checkout -b feature/name`
2. Follow conventions: Pinia stores, Vue 3 Composition API, `useXStore()` pattern
3. Test: `npm test`
4. PR with conventional commits (`feat:`, `fix:`, `refactor:`)

**Critical rules:**
- Always `ensureAudioContext()`, never `new AudioContext()`
- Worker events: update BOTH `_dispatchEvent` AND `registerEventProxy`
- Never commit `dist/` – it's generated

---

## 📄 License

mumbling-mole is licensed under the **GNU Affero General Public License, version 3 only ([AGPL](https://en.wikipedia.org/wiki/GNU_Affero_General_Public_License)-3.0-only)**. See the [LICENSE](LICENSE) file for the full text and the [NOTICE](NOTICE) file for copyright and attribution details.

Portions of this project are derived from the [mumble-web](https://github.com/johni0702/mumble-web) project by Jonas Herzig, licensed under the ISC License. The original ISC license text is preserved in [upstream/LICENSE](upstream/LICENSE).

### Contributing

By submitting a pull request, you agree that your contribution is provided under the same license terms as this project: **AGPL-3.0-only**.

## 🙏 Acknowledgments

- [mumble-web](https://github.com/johni0702/mumble-web) – Original project by Jonas Herzig
- [MetroMumble](https://github.com/xPoke/MetroMumble) – Theme inspiration

---

<p align="center">
  Made with ❤️ for the Flexpair community
</p>
