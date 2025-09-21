# Mumbling Mole (Lite Mumble Web Client)

[![Project Status: Active](https://img.shields.io/badge/status-active-success.svg)](https://github.com/Flexpair/mumbling-mole/)
[![GitHub Issues](https://img.shields.io/github/issues/Flexpair/mumbling-mole.svg)](https://github.com/Flexpair/mumbling-mole/issues)

Mumbling Mole is a lightweight, production-oriented HTML5 [Mumble](https://www.mumble.info/) client designed for minimal UI footprint and efficient audio tunneling over a single WebSocket. The name is a pun on Mumble and [Apache Guacamole](https://guacamole.apache.org/), as it is optimized for embedding into remote desktop and support tools where screen space is limited.

This project is a heavily modernized fork of the original `mumble-web`, rebuilt with a focus on performance, security, and a deterministic build process. It removes the traditional channel tree and on-screen voice activity display to create a client that is simple, fast, and ideal for integration.

## Key Features

-   **Minimalist UI:** Designed for embedding, with no channel tree to maximize screen real estate.
-   **WebSocket Tunneling:** Tunnels Mumble's TCP traffic over a standard WebSocket, compatible with `websockify` and reverse proxies.
-   **Modern Build System:** Uses Webpack 5 and Babel for deterministic, tree-shaken, and minified builds.
-   **Performant Audio:** Offloads Opus encoding/decoding to Web Workers and uses native browser resampling, saving ~5MB over legacy solutions.
-   **Secure by Default:** Sanitizes all user-generated content with `dompurify` to prevent XSS attacks.
-   **Voice Modes:** Supports both Push-to-Talk (PTT) and Continuous transmission.
-   **Theming & Localization:** Easily skinnable with SCSS and supports multiple languages.

## Getting Started

### Prerequisites

-   [Node.js](https://nodejs.org/) (LTS version recommended)
-   [Git](https://git-scm.com/)

### 1. Installation

Clone the repository and install the dependencies:

```bash
git clone https://github.com/Flexpair/mumbling-mole
cd mumbling-mole
npm install
```

### 2. Build

Build the static assets for the `dist/` directory. The smart build script detects changes and only rebuilds when necessary.

```bash
npm run build
```

To force a clean rebuild, run `npm run build:force`.

### 3. Running the Server

The `docker-entrypoint.sh` script starts a local web server and, optionally, the WebSocket tunnel.

**With a WebSocket tunnel (requires a Mumble server):**

```bash
# Replace with your Mumble server's address and port
export MUMBLE_SERVER="your.mumble.server:64738"
./docker-entrypoint.sh
```

**Without a tunnel (for UI development only):**

```bash
SKIP_TUNNEL=1 ./docker-entrypoint.sh
```

Once running, the client is available at `http://localhost:8081`.

## Deployment

Mumbling Mole consists of static files and a WebSocket tunnel.

-   **Standalone:** Use `websockify` to serve the `dist/` directory and tunnel traffic.
    ```bash
    websockify --ssl-only --ssl-target --web=dist 443 <mumbleserver>:64738
    ```
-   **Reverse Proxy (Recommended):** Serve the `dist/` directory with a standard web server (like NGINX or Caddy) and use its proxying capabilities to route WebSocket traffic.
    -   Run `websockify` as a standalone tunnel: `websockify --ssl-target 64737 <mumbleserver>:64738`.
    -   Configure your reverse proxy to forward requests from `/mumble` to `localhost:64737`.

## Configuration

-   **Primary Config:** `app/config.js` contains the default application settings.
-   **Local Overrides:** Create or edit `app/config.local.js` to override defaults. This file is copied to `dist/` on build and is not tracked by Git.
-   **URL Parameters:** You can also override settings at runtime with URL query parameters:
    ```
    https://voice.example.com/?address=voice.example.com/mumble&port=443
    ```

## Development

### Build Scripts

| Script                | Description                                                |
| --------------------- | ---------------------------------------------------------- |
| `npm run build`       | Smart build with change detection.                         |
| `npm run build:force` | Forces a clean rebuild of the `dist/` directory.           |
| `npm test`            | Runs E2E smoke tests and a security audit.                 |
| `npm run test:e2e`    | Runs only the local E2E tunnel smoke test.                 |
| `npm run audit:ci`    | Audits dependencies against the `audit-baseline.json`.     |
| `npm run build:vendor:mumble-client` | Rebuilds the vendored `mumble-client` from `src` to `lib`. |

### CSS / SCSS Build Pipeline

Styles werden jetzt mit `mini-css-extract-plugin` gebaut (vorher `file-loader` + `extract-loader`).
Die Datei `app/theme.js` importiert nur noch die SCSS-Dateien; das Plugin extrahiert
versionierte CSS Artefakte (`theme.[contenthash].css`). Der frühere dynamische `<link>`-Insert
ist entfallen. Das Skript `smart-build.sh` erwartet weiterhin ein nicht-leeres `theme.js`,
daher enthält `theme.js` einen kleinen `console.debug` Side-Effect, damit das gebündelte JS
nicht völlig leer weg-optimiert wird.

### Vendored Dependencies & Polyfills

Some critical libraries are vendored in `vendors/` (e.g. `mumble-client`). If you modify
`vendors/mumble-client/src/**`, run:

```bash
npm run build:vendor:mumble-client
```

This regenerates `vendors/mumble-client/lib/`, which is what the application actually
imports at runtime. The repository uses **Webpack 5** with:

- `node-polyfill-webpack-plugin` for broad Node core shims.
- `ProvidePlugin` (injects `process` & `Buffer`).
- `DefinePlugin` setting `process.browser = true` for vendored code which branches on it.

Because of these plugins, manual runtime assignments like `window.process = ...` are not
required. If you introduce new Node core usages (e.g. `crypto`, `path`), add them either
via explicit imports or extend `resolve.fallback` similarly to the existing entries in
`webpack.config.js`.

### Theming

1.  Duplicate `themes/MetroMumbleLight` to `themes/YourThemeName`.
2.  Modify the SCSS files and assets.
3.  Rebuild with `npm run build`.
4.  Activate with the `?theme=YourThemeName` URL parameter.

### Localization

1.  Add `localize/<lang>.json` by translating the keys from `en.json`.
2.  Rebuild the assets.

## Security

-   **Content Sanitization:** All user-generated content is sanitized with `dompurify` to mitigate XSS.
-   **Production:** Always deploy behind HTTPS with a secure WebSocket (WSS) connection.
-   **Dependencies:** Regularly audit dependencies with `npm run audit:ci`.

## Contributing

Contributions are welcome!

1.  Fork and clone the repository.
2.  Create a feature branch.
3.  Run `npm install && npm test` to verify changes.
4.  Submit a pull request with a clear description.

---

**References:**

-   [Mumble](https://www.mumble.info/)
-   [websockify](https://github.com/novnc/websockify)
-   [MetroMumble](https://github.com/Johni0702/MetroMumble)
