# Mumbling Mole - AI Coding Agent Instructions

This document provides essential guidance for AI coding agents working on the Mumbling Mole codebase.

## 1. Big Picture Architecture

Mumbling Mole is a minimalist, web-based Mumble client designed for embedding. It's a single-page application that communicates with a Mumble server over a single WebSocket.

-   **Frontend Core (`app/`):** The main application logic resides in the `app/` directory.
    -   `app/index.js`: The main entry point. It initializes the Mumble client, UI components, and voice handling.
    -   The UI is built with the **Knockout.js** framework for data binding. Look for `ko.observable` and `data-bind` attributes in the HTML.
-   **WebSocket Communication (`app/mumble-websocket.js`):** The client does not have a traditional backend. It connects directly to a Mumble server by tunneling the Mumble protocol over a WebSocket. `app/mumble-websocket.js` and the `websocket-stream` library manage this connection.
-   **Audio Processing (`app/voice.js`, `app/encode-worker.js`):**
    -   Audio input and voice activation (Push-to-Talk, Continuous) are managed in `app/voice.js`.
    -   To maintain performance, Opus audio encoding is offloaded to a Web Worker defined in `app/encode-worker.js`.
    -   The core Mumble protocol logic is handled by the `mumble-client` library, which is a vendored dependency located in `vendors/mumble-client`.
-   **Build System:** The project uses **Webpack 5** and **Babel** for building, transpiling, and bundling assets. The configuration is in `webpack.config.js`.

## 2. Developer Workflows

-   **Installation:** `npm install`
-   **Building:**
    -   Run `npm run build`. This uses `smart-build.sh`, a script that intelligently rebuilds only what's necessary.
    -   To force a complete, clean rebuild, use `npm run build:force`.
-   **Running the Development Server:** The `docker-entrypoint.sh` script is the primary way to run the local server.
    -   **With a WebSocket tunnel (for full functionality):**
        ```bash
        export MUMBLE_SERVER="your.mumble.server:64738"
        ./docker-entrypoint.sh
        ```
    -   **For UI development only (no Mumble connection):**
        ```bash
        SKIP_TUNNEL=1 ./docker-entrypoint.sh
        ```
    -   The client will be available at `http://localhost:8081`.
-   **Testing:**
    -   `npm test`: Runs the full suite, which includes an E2E smoke test and a security audit.
    -   `npm run test:e2e`: Runs only the end-to-end smoke test defined in `scripts/e2e-check.cjs`.

## 3. Project-Specific Conventions

-   **Configuration System:** The application uses a layered configuration model. When adding or changing configuration, consider all three sources:
    1.  **`app/config.js`:** Contains the default values. This file is tracked by Git.
    2.  **`app/config.local.js`:** Used for local overrides. This file is **not** tracked by Git. This is the preferred place for developers to make changes.
    3.  **URL Query Parameters:** Settings can be overridden at runtime via URL parameters (e.g., `?username=test`).
-   **Theming (`themes/`):**
    -   Theming is managed with SCSS files in the `themes/` directory.
    -   The active theme is loaded in `app/theme.js`. To change the theme, you must modify this file. The default theme is `MetroMumbleLight`.
-   **Vendored Dependencies (`vendors/`):**
    -   Critical dependencies like `mumble-client` are "vendored" (stored directly in the `vendors/` directory) instead of being pulled from npm during every install.
    -   Note that `vendors/mumble-client` has its own build step. The `smart-build.sh` script will automatically run `npx babel` on `vendors/mumble-client/src` if the `lib` directory is missing.

## 4. Key Files & Directories

-   `app/`: The core frontend application source code.
-   `app/index.js`: Main application entry point.
-   `app/config.js` & `app/config.local.js`: Application configuration.
-   `app/voice.js`: Voice handling logic (PTT, etc.).
-   `app/mumble-websocket.js`: WebSocket connection logic.
-   `themes/`: SCSS-based theme files.
-   `scripts/`: Node.js scripts for CI/CD tasks like testing and auditing.
-   `smart-build.sh`: The main build script.
-   `docker-entrypoint.sh`: The script for running the development server and WebSocket tunnel.
-   `webpack.config.js`: Webpack build configuration.
-   `README.md`: Contains detailed setup and deployment instructions.
