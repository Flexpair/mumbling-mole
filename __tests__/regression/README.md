# Regression Tests

This directory contains Jest regression tests for behavior that has previously failed in the application. Jest discovers files below `__tests__/` when they end in `.test.js`.

Run the regression suite with:

```bash
npm run build:local
npm run test:unit -- __tests__/regression
```

Run the complete unit suite, including coverage, with:

```bash
npm run test:unit
npm run test:unit:coverage
```

## Scope

Regression tests should cover observable behavior at the same boundary where a defect was found. Typical areas include:

- Pinia store state transitions and cleanup;
- authentication-service validation and error handling;
- WebSocket/Mumble connection lifecycle;
- AudioContext and voice-handler initialization;
- 48 kHz audio processing with 960-sample frames;
- loopback routing and mute/deaf state changes.

Use Playwright for behavior that requires a real browser, AudioWorklet, fake microphone, or the Compose Murmur service. Those tests belong under `tests/playwright/`, not in Jest's unit-test directory.

Keep regression fixtures deterministic and free of passwords, JWTs, API keys, connection strings, or returned credentials. Generated coverage and browser artifacts stay outside Git.
