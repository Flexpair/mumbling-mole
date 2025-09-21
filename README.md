# Mumbling Mole (Lite Mumble Web Client)

Mumbling Mole is a lightweight, production‑oriented HTML5 [Mumble] client focused on minimal UI footprint and efficient audio tunneling over a single WebSocket. This fork/variant removes the traditional channel tree and continuous on‑screen voice activity display in order to conserve screen space (e.g. when embedded in remote desktop / support tooling) while retaining high‑quality audio and essential chat / presence features.

---

## Contents
1. Overview & Goals
2. Feature Highlights
3. Architecture & Tech Stack
4. Quick Start
5. Installation
6. Environment
7. Development Workflow
8. Configuration
9. Theming
10. Localization
11. Deployment (Summary)
12. Testing & QA
13. Security Notes
14. Contributing

---

## 1. Overview & Goals
Compact web Mumble client optimized for embedding and constrained layouts:
- Minimal surface area: no full channel tree, reduced chrome
- Deterministic build, reproducible assets in `dist/`
- Secure-by-default (TLS WebSocket tunnel, sanitization via `dompurify`)
- Fast startup (tree‑shaken, minified, selective worker usage)

## 2. Feature Highlights
- WebSocket tunneling via `websockify` (or compatible) to a standard Mumble server
- Push‑to‑Talk and Continuous voice modes
- Adjustable audio bitrate (default overridden to 96 kbit/s via `config.local.js`)
- Multi‑language UI (currently: `cs, de, en, es, fr, it, ja, nl, no, ru, zh`)
- MetroMumbleLight derived theming with SCSS pipeline
- Offline‑friendly static asset bundle (no server‑side rendering required)
- Deterministic smart build script with change detection (`smart-build.sh`)

### Improvements / Notable Changes
- Removed heavy `libsamplerate.js` in favor of native browser resamplers (~5 MB saved)
- Added Safari (>=11) support adjustments
- Stable Docker image base & reproducible build steps
- Increased default usable audio bitrate to 96 kbit/s (see `app/config.local.js`)
- Webpack optimization & minimized output
- Integrated upstream patches and removed unused UI stubs

## 3. Architecture & Tech Stack
| Layer | Key Components |
|-------|----------------|
| UI & MVVM | Knockout.js bindings + minimal HTML templates |
| Audio | `libopus.js`, Web Audio API, workers for encode/decode & recording |
| Networking | WebSocket tunnel (websockify) → native Mumble TCP (optionally TLS) |
| Build | Webpack 5, Babel (@babel/preset-env & runtime), SCSS pipeline |
| Security | `dompurify` for chat / user text, content isolation via static hosting |
| Localization | JSON bundles loaded at runtime (`/localize/*.json`) |
| Vendor Bundles | Local vendored `mumble-client`, `netlify-identity-widget` |

Workers (`encode-worker.js`, `decode-worker.js`, `recorder-worker.js`) offload audio processing; `worker-loader` bundles them separately.

## 4. Quick Start

### Dev Container (Recommended)
Run the Dev Container and then inside it:
```
npm install
npm run build
./docker-entrypoint.sh # Requires MUMBLE_SERVER set (unless SKIP_TUNNEL=1)
```
Open your browser at the printed host/port (default: `http://localhost:8081`).

### Bare Local (No Tunnel) for Static UI Testing
```
npm install
npm run build
SKIP_TUNNEL=1 ./docker-entrypoint.sh
open http://localhost:8081   # serve static assets only
```

## 5. Installation
```
git clone https://github.com/Flexpair/mumbling-mole
cd mumbling-mole
npm install
npm run build
```
Non‑root user strongly recommended (npm lifecycle scripts can behave unexpectedly as root).

Result: `dist/` contains `index.html`, `index.js`, `config.js`, `theme.js`, workers, and `config.local.js` (copied on first build if absent).

## 6. Environment
| Variable | Purpose | Default |
|----------|---------|---------|
| `PORT` / `SMOKE_HTTP_PORT` | HTTP + WebSocket listen port | 8081 |
| `HOST` | Bind address | 0.0.0.0 |
| `SKIP_TUNNEL` | If `1`, only serve static files (no WebSocket tunnel) | unset |
| `MUMBLE_SERVER` | Target `<host:port>` for Mumble (required unless `SKIP_TUNNEL=1`) | (none) |
| `PLAIN_TARGET` | If `1`, don't use `--ssl-target` (plain TCP to backend) | unset |
| `E2E_*` | See smoke test section | — |

Two ports (8081/8082) are exposed in the Docker image for CI compatibility. Normally you only need 8081.

## 7. Development Workflow
Key scripts (see `package.json`):
| Script | Description |
|--------|-------------|
| `npm run build` | Smart build with change detection (rebuilds only if needed) |
| `npm run build:force` | Force a clean rebuild (clears `dist/`) |
| `npm test` | Runs E2E smoke + audit security check |
| `npm run test:e2e` | Local E2E tunnel smoke test only |
| `npm run audit:ci` | Dependency audit compared to `audit-baseline.json` |
| `npm run audit:baseline` | Regenerate security baseline (pin reviewed vulnerabilities) |

The build script ensures vendored `mumble-client` is compiled (Babel) prior to bundling.

## 8. Configuration
Primary defaults: `app/config.js` -> `window.mumbleWebConfig` with sections:
- `connectDialog`: toggles visibility of connect form fields
- `settings`: user defaults (`voiceMode`, `pttKey`, `toolbarVertical`, `audioBitrate`, etc.)
- `defaults`: query-parameter overrideable defaults (`address`, `port`, `theme`)

Override pattern:
1. Copy or edit `dist/config.local.js` (auto-copied from `app/config.local.js` if missing)
2. Adjust settings (e.g. `config.settings.audioBitrate = 96000;`)
3. Serve updated `dist/` assets

Runtime URL overrides (example):
```
https://voice.example.com/?address=voice.example.com/mumble&port=443&theme=MetroMumbleLight
```

## 9. Theming
Base theme: `themes/MetroMumbleLight/` (SCSS, images, SVGs). To create a new theme:
1. Duplicate the folder under `themes/YourThemeName`
2. Adjust SCSS (`main.scss`, `loading.scss`) & assets
3. Update references if needed in HTML (the build replaces `/svg/` & `/img/` paths)
4. Rebuild (`npm run build`)
5. Provide `?theme=YourThemeName` in URL or set `defaults.theme`

## 10. Localization
Language bundles in `localize/`: `cs, de, en, es, fr, it, ja, nl, no, ru, zh`.
To add a language:
1. Create `localize/<lang>.json`
2. Mirror keys from `en.json`
3. Rebuild assets
4. Provide selection UI or auto‑detect logic (future enhancement)

## 11. Deployment (Summary)
Common patterns:
- Standalone: `websockify --ssl-only --ssl-target --web=dist 443 <mumbleserver>:64738`
- Reverse proxy (recommended): run `websockify --ssl-target 64737 <mumbleserver>:64738` and proxy `/mumble` → `:64737` (see NGINX/Caddy examples in previous revision if needed)
- Systemd: run as a simple service executing websockify with `--web=dist`
Connecting examples: `address=voice.example.com/mumble&port=443` query parameters can prefill the form.

## 12. Testing & QA
Smoke / E2E:
```
npm run test:e2e
```
Environment overrides: `E2E_WS_PORT`, `E2E_TCP_PORT`, `E2E_BIND_HOST`, `E2E_TARGET_HOST`.
Container mode:
```
node scripts/e2e-check.cjs --mode=container
```
Security/audit:
```
npm run audit:ci
```

## 13. Security Notes
- Web content sanitized with `dompurify` to mitigate XSS via chat/messages
- Avoid running untrusted custom themes unless reviewed
- Run behind HTTPS + secure WebSocket (wss) in production
- Audit dependencies: `npm run audit:ci` (baseline exceptions tracked in `audit-baseline.json`)

## 14. Contributing
1. Fork & clone
2. Create a feature branch
3. Run `npm install && npm test`
4. Submit PR with concise description + any screenshots (if UI changes)

Please keep PRs focused; run the E2E smoke test locally before submission.

---
### License Status (Placeholder)
Licensing for this fork is currently under review. Original upstream portions were previously distributed under the ISC license; final licensing and attribution will be clarified in a future update. Until then, reuse/redistribution terms are not explicitly granted.

---
References:
- [Mumble]
- [websockify GitHub page]
- [MetroMumble]
