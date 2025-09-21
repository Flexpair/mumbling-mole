# Mumbling Mole (Lite Mumble Web Client)

[![Project Status: Active](https://img.shields.io/badge/status-active-success.svg)](https://github.com/Flexpair/mumbling-mole/)
[![GitHub Issues](https://img.shields.io/github/issues/Flexpair/mumbling-mole.svg)](https://github.com/Flexpair/mumbling-mole/issues)
[![License](https://img.shields.io/badge/license-ISC-blue.svg)](https://github.com/Flexpair/mumbling-mole/blob/lite/LICENSE)

Mumbling Mole is a lightweight, production-oriented HTML5 [Mumble](https://www.mumble.info/) client. It focuses on a minimal UI footprint and efficient audio tunneling over a single WebSocket.

This fork removes the traditional channel tree and on-screen voice activity display to conserve screen space, making it ideal for embedding in remote desktop or support tools while retaining high-quality audio and essential features.

---

## Why Mumbling Mole?

This project began as a fork of the original `mumble-web` client, but has since evolved significantly. Key improvements include:

-   **Modernization:** The entire codebase has been migrated to a modern Webpack 5 build system with Babel, replacing the legacy Grunt setup.
-   **Performance:** Removed heavy dependencies like `libsamplerate.js` (~5MB saved) in favor of native browser resampling, leading to faster load times.
-   **Determinism:** Builds are fully deterministic, ensuring that the same source code always produces the exact same output in the `dist/` directory.
-   **Security:** Integrated `dompurify` to sanitize all user-generated content and prevent XSS attacks.
-   **Stability:** Runs on a stable Docker image base with reproducible build steps, making deployment predictable and reliable.
-   **Developer Experience:** Added a "smart" build script (`smart-build.sh`) that only rebuilds assets when changes are detected, speeding up the development cycle.

## Contents

1.  [Overview & Goals](#1-overview--goals)
2.  [Feature Highlights](#2-feature-highlights)
3.  [Architecture & Tech Stack](#3-architecture--tech-stack)
4.  [Quick Start](#4-quick-start)
5.  [Installation](#5-installation)
6.  [Environment Variables](#6-environment-variables)
7.  [Development Workflow](#7-development-workflow)
8.  [Configuration](#8-configuration)
9.  [Theming](#9-theming)
10. [Localization](#10-localization)
11. [Deployment](#11-deployment-summary)
12. [Testing & QA](#12-testing--qa)
13. [Security Notes](#13-security-notes)
14. [Contributing](#14-contributing)
15. [License](#15-license)

---

## 1. Overview & Goals

A compact web Mumble client optimized for embedding and constrained layouts.

-   **Minimal Footprint:** No full channel tree, reduced UI chrome.
-   **Reproducible Builds:** Deterministic build process produces identical assets in `dist/`.
-   **Secure by Default:** Enforces a secure WebSocket tunnel and sanitizes inputs with `dompurify`.
-   **Fast Startup:** Tree-shaken, minified, and uses workers for heavy audio processing.

## 2. Feature Highlights

-   WebSocket tunneling via `websockify` (or a compatible proxy) to a standard Mumble server.
-   Push-to-Talk and Continuous voice modes.
-   Adjustable audio bitrate (default overridden to 96 kbit/s via `config.local.js`).
-   Multi-language UI (currently: `cs, de, en, es, fr, it, ja, nl, no, ru, zh`).
-   Theming support via a simple SCSS pipeline.
-   Offline-friendly static asset bundle (no server-side rendering required).
-   Deterministic smart build script with change detection (`smart-build.sh`).

## 3. Architecture & Tech Stack

| Layer          | Key Components                                                       |
| -------------- | -------------------------------------------------------------------- |
| **UI & MVVM**  | Knockout.js bindings + minimal HTML templates                        |
| **Audio**      | `libopus.js`, Web Audio API, workers for encode/decode & recording   |
| **Networking** | WebSocket tunnel (websockify) → native Mumble TCP (optionally TLS) |
| **Build**      | Webpack 5, Babel (`@babel/preset-env` & runtime), SCSS pipeline      |
| **Security**   | `dompurify` for chat/user text, content isolation via static hosting |
| **Localization** | JSON bundles loaded at runtime (`/localize/*.json`)                  |
| **Vendor**     | Local vendored `mumble-client` and `netlify-identity-widget`         |

Audio processing is offloaded to Web Workers (`encode-worker.js`, `decode-worker.js`, `recorder-worker.js`) to keep the main thread responsive.

## 4. Quick Start

This is the fastest way to get Mumbling Mole running for development or testing.

### Dev Container (Recommended)

1.  Open this project in the provided Dev Container.
2.  Run the setup and start the server:
    ```bash
    npm install
    npm run build
    # Set MUMBLE_SERVER or the script will exit, unless you only want to test the UI
    export MUMBLE_SERVER="your.mumble.server:64738"
    ./docker-entrypoint.sh
    ```
3.  Open your browser to the printed host/port (default: `http://localhost:8081`).

### Local UI-Only Testing (No Tunnel)

If you only need to work on the UI and don't need to connect to a Mumble server:

```bash
npm install
npm run build
SKIP_TUNNEL=1 ./docker-entrypoint.sh
```

This will serve the static assets at `http://localhost:8081`.

## 5. Installation

Follow these steps to clone the repository and build the project from source.

```bash
git clone https://github.com/Flexpair/mumbling-mole
cd mumbling-mole
npm install
npm run build
```

The build artifacts, including `index.html`, JavaScript bundles, and assets, will be located in the `dist/` directory.

**Note:** It is strongly recommended to run these commands as a non-root user, as npm lifecycle scripts can behave unexpectedly when run as root.

## 6. Environment Variables

| Variable          | Purpose                                                              | Default   |
| ----------------- | -------------------------------------------------------------------- | --------- |
| `PORT`            | HTTP + WebSocket listen port                                         | `8081`    |
| `HOST`            | Bind address for the server                                          | `0.0.0.0` |
| `SKIP_TUNNEL`     | If `1`, only serves static files (no WebSocket tunnel)               | unset     |
| `MUMBLE_SERVER`   | Target `<host:port>` for Mumble (required unless `SKIP_TUNNEL=1`)    | (none)    |
| `PLAIN_TARGET`    | If `1`, use plain TCP for the backend connection (no `--ssl-target`) | unset     |
| `E2E_*`           | See the smoke test section for E2E testing variables.                | —         |

**Note:** The Docker image exposes ports 8081 and 8082 for CI compatibility. For normal use, you only need port 8081.

## 7. Development Workflow

Key scripts available in `package.json`:

| Script                | Description                                                      |
| --------------------- | ---------------------------------------------------------------- |
| `npm run build`       | Smart build with change detection (rebuilds only if needed).     |
| `npm run build:force` | Forces a clean rebuild by clearing the `dist/` directory first.  |
| `npm test`            | Runs E2E smoke tests and a security audit.                       |
| `npm run test:e2e`    | Runs only the local E2E tunnel smoke test.                       |
| `npm run audit:ci`    | Compares dependencies against the `audit-baseline.json`.         |
| `npm run audit:baseline` | Regenerates the security baseline to pin reviewed vulnerabilities. |

The build script ensures the vendored `mumble-client` is compiled with Babel before being bundled.

## 8. Configuration

The client can be configured through `config.js` and `config.local.js`.

-   **`app/config.js`**: Contains the primary default settings for the application (`window.mumbleWebConfig`).
-   **`app/config.local.js`**: Use this file for local overrides. It is copied to `dist/` on build if it doesn't exist there.

To customize your configuration:

1.  Edit `dist/config.local.js` (or create it by copying `app/config.local.js`).
2.  Adjust settings as needed (e.g., `config.settings.audioBitrate = 96000;`).
3.  Serve the updated `dist/` assets.

You can also override settings at runtime using URL query parameters:

```
https://voice.example.com/?address=voice.example.com/mumble&port=443&theme=MetroMumbleLight
```

## 9. Theming

The default theme is `MetroMumbleLight`, located in `themes/MetroMumbleLight/`. To create a new theme:

1.  Duplicate the `MetroMumbleLight` folder and rename it (e.g., `themes/YourThemeName`).
2.  Modify the SCSS files (`main.scss`, `loading.scss`) and replace assets as needed.
3.  Rebuild the project: `npm run build`.
4.  Activate the theme by setting the `theme` query parameter in the URL (e.g., `?theme=YourThemeName`) or by changing `defaults.theme` in your configuration.

## 10. Localization

Language bundles are located in `localize/`. To add a new language:

1.  Create a new file, `localize/<lang>.json`.
2.  Translate the keys from `en.json`.
3.  Rebuild the assets.

A UI for language selection is a potential future enhancement.

## 11. Deployment (Summary)

Common deployment patterns:

-   **Standalone:** Use `websockify` to serve the `dist/` directory and tunnel traffic to your Mumble server.
    ```bash
    websockify --ssl-only --ssl-target --web=dist 443 <mumbleserver>:64738
    ```
-   **Reverse Proxy (Recommended):** Run `websockify` without the `--web` flag and use a reverse proxy like NGINX or Caddy to serve the static files and proxy the WebSocket connection.
    -   Run `websockify --ssl-target 64737 <mumbleserver>:64738`.
    -   Proxy requests for `/mumble` to `localhost:64737`.

## 12. Testing & QA

-   **E2E / Smoke Tests:**
    ```bash
    npm run test:e2e
    ```
    You can override test parameters with environment variables: `E2E_WS_PORT`, `E2E_TCP_PORT`, `E2E_BIND_HOST`, `E2E_TARGET_HOST`.

-   **Security Audit:**
    ```bash
    npm run audit:ci
    ```

## 13. Security Notes

-   **Content Sanitization:** All user-generated content is sanitized with `dompurify` to mitigate XSS.
-   **Theme Security:** Avoid running untrusted custom themes unless you have reviewed the code.
-   **Production:** Always run behind HTTPS with a secure WebSocket (WSS) connection.
-   **Dependencies:** Regularly audit dependencies with `npm run audit:ci`. Baseline exceptions are tracked in `audit-baseline.json`.

## 14. Contributing

We welcome contributions! Please follow these steps:

1.  Fork and clone the repository.
2.  Create a feature branch for your changes.
3.  Run `npm install && npm test` to ensure everything is working correctly.
4.  Submit a pull request with a concise description of your changes.

Please keep pull requests focused on a single feature or bug fix.

---

## 15. License

This project is licensed under the **ISC License**. See the [LICENSE](LICENSE) file for details.

The original upstream portions were previously distributed under a different license. All new contributions are licensed under ISC.

---

**References:**

-   [Mumble](https://www.mumble.info/)
-   [websockify](https://github.com/novnc/websockify)
-   [MetroMumble](https://github.com/Johni0702/MetroMumble)

