# Playwright Browser Tests

Playwright validates the browser-facing audio and authentication flows. The configuration is in `playwright.config.js` and uses `tests/playwright/` as its test directory.

## Commands

```bash
# All Playwright specs
npm run test:playwright

# Authentication scenario
npm run test:auth

# Audio loopback scenario
npm run test:loopback
npm run test:loopback:headed
npm run test:loopback:debug
```

The headed command needs a browser display. The debug command starts Playwright's debugger. The default run is headless Chromium.

## Environment

The default base URL is:

```text
https://local.flexpair.app
```

Override it deliberately with `PLAYWRIGHT_BASE_URL`. The config loads `.env.test` for the local test account; keep that file untracked and never place passwords, tokens, or other credential values in this document or in committed test fixtures.

The browser context:

- grants microphone permission;
- uses Chromium's fake microphone and fake media UI;
- disables the user-gesture requirement for audio playback;
- maps `local.flexpair.app` to the nginx Compose address;
- runs one worker and serializes audio tests;
- retries twice in CI and forbids `test.only` in CI;
- retains traces on failure and captures screenshots/videos for diagnosis.

The application is normally reached through nginx on HTTPS port `443`. The application/websockify service listens on `8081`, the authentication service on `8082`, and the Compose Murmur server is reachable as `murmur:64738`.

## Test coverage

### `auth-invalid-credentials.spec.js`

Checks that invalid credentials are rejected through the Netlify Identity login flow without exposing the value being tested.

### `loopback-frequency.spec.js`

Checks the browser audio path:

```text
fake microphone
  → AudioWorklet capture
  → Opus encoder
  → WebSocket/Mumble loopback
  → Opus decoder
  → playback buffer
  → frequency display
```

The loopback test also covers the 440 Hz test tone and mute/deaf state transitions. It validates the local user's complete path; it does not prove client-to-client remote-user lifecycle behavior.

## Required services

Start the Dev Container/Compose environment before running the suite. The Murmur service must be available at `murmur:64738`; otherwise the browser test fails with a connection error. The normal development entry point is:

```bash
npm run build:dev
./start-dev-server.sh
```

If the application is not reachable, check the server and authentication logs:

```bash
tail -f /tmp/entrypoint.log
tail -f /tmp/auth-server.log
```

The local application URL is `https://local.flexpair.app`. Do not expose the local password variables or test credentials while diagnosing a failure.

## Reports and debugging

Playwright writes its HTML report to `playwright-report/` and JSON results to `test-results/results.json`. Failure screenshots, videos, and traces are placed under `test-results/`. These paths are generated artifacts and must not be committed.

For a visible run:

```bash
npm run test:loopback:headed
```

For step-through debugging:

```bash
npm run test:loopback:debug
```

A passing loopback test confirms the local capture/encode/transport/decode/playback chain. Use two browser contexts when investigating problems that only affect remote-user audio.
