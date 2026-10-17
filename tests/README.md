# Testing Mumbling Mole

The repository uses Jest for JavaScript unit tests, Python tests for the authentication service, and Playwright for browser integration tests. The complete local command also runs the dependency audit.

## Prerequisites

The recommended environment is the Dev Container defined in `.devcontainer/`. Its Compose project provides:

- the development container (`mumble`),
- the Murmur server (`murmur`) at `murmur:64738`,
- nginx at the browser-facing local URL, and
- the supporting Guacamole services.

The Playwright suite needs the Murmur service. If `murmur:64738` refuses connections, restart the complete Compose/Codespaces environment rather than trying to start Murmur from inside the development container.

Keep test credentials in the untracked `.env.test` file. The Playwright configuration loads that file but does not provide credential values in the repository.

## Quick start

```bash
# Full local suite: Jest, Python, Playwright, dependency audit
npm test

# JavaScript unit tests
npm run test:unit
npm run test:unit:coverage

# Authentication service tests
npm run test:python

# Browser tests
npm run test:playwright
npm run test:auth
npm run test:loopback
npm run test:loopback:headed
npm run test:loopback:debug

# Dependency and documentation checks
npm run audit:ci
npm run check:deps
npm run validate:markdown
```

## Jest unit tests

Jest uses the jsdom environment and Node's experimental VM module support. It discovers JavaScript tests matching:

```text
**/__tests__/**/*.test.js
```

Playwright files under `tests/playwright/` are excluded from Jest. Coverage is collected from `app/**/*.js` with generated files, entry-point barrels, and AudioWorklet processors excluded. The configured global minimums are 80% for statements, branches, functions, and lines.

The unit runner is:

```bash
node --experimental-vm-modules node_modules/jest/bin/jest.js
```

Use the npm scripts instead of invoking the runner directly so the repository configuration remains applied.

## Python authentication tests

`npm run test:python` runs `auth-server/test_server.py`. These tests cover the server-side authentication and credential endpoint without publishing any credential values.

## Playwright browser tests

Playwright is configured in `playwright.config.js` with `testDir: './tests/playwright'` and Chromium as the test browser. The default base URL is:

```text
https://local.flexpair.app
```

Set `PLAYWRIGHT_BASE_URL` when a different test endpoint is intentional. The configuration grants microphone permission, uses a fake microphone, runs audio tests sequentially with one worker, and stores reports and failure artifacts under `test-results/` and `playwright-report/`.

The main scenarios are:

- invalid authentication credentials;
- audio loopback and 440 Hz frequency detection;
- mute/deaf behavior and recovery.

See [tests/playwright/README.md](playwright/README.md) for the browser-specific workflow.

## CI gates

`.github/workflows/docker-image.yml` runs these gates before building the production Docker image:

1. dependency installation with `npm ci --ignore-scripts`;
2. `npm run audit:ci`;
3. `npm run check:deps`;
4. Jest coverage tests;
5. Python authentication tests;
6. Jest coverage-threshold reporting;
7. Docker `prod` stage build.

The Docker workflow does not run Playwright because the browser suite requires the Compose Murmur service. Run Playwright in the Dev Container or another environment with the required services.

`.github/workflows/validate-markdown.yml` validates Markdown structure on Markdown-only pull requests and on relevant pushes to `lite` and `main`.

## Test artifacts and safety

Playwright traces, videos, screenshots, JSON results, HTML reports, Jest coverage, and generated build output are local artifacts. Do not commit them. Do not copy passwords, JWTs, API keys, or returned Mumble/Guacamole credentials into test output, documentation, or issue comments.
