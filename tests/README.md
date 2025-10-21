# 🧪 Testing Guide for Mumbling Mole

Documentation for testing the Mumble web client.

## ⚠️ CRITICAL: Docker Compose Architecture

**This project runs in a multi-container docker-compose environment:**

- **Development container** (`service: mumble`): Where you work (this container, no docker access)
- **Murmur server** (`service: murmur`): Mumble server at `murmur:64738` (separate container)
- **Both containers** are started together via docker-compose

**For Playwright tests to work, the Murmur container MUST be running!**

If tests fail with "Connection refused" to `murmur:64738`:
```bash
# Check if murmur is reachable
curl -v --connect-timeout 2 telnet://murmur:64738 2>&1 | grep -E "Connected|refused"

# If "Connection refused": Restart the ENTIRE Codespace
# (You cannot restart murmur from inside this container)
```

## 📋 Table of Contents

- [Quick Start](#-quick-start)
- [Test Overview](#-test-overview)
- [Playwright Tests](#-playwright-tests)
- [Test Server Management](#-test-server-management)
- [Troubleshooting](#-troubleshooting)

---

## 🚀 Quick Start
```bash
# Run all tests (Playwright loopback + dependency audit)
npm test

# Run Playwright loopback test only
npm run test:loopback

# Run with visible browser (for debugging)
npm run test:loopback:headed

# Run with debugger
npm run test:loopback:debug

# Run dependency audit only
npm run audit:ci
```

---

## 📊 Test Overview

### Available NPM Scripts

| Script | Description |
|--------|-------------|
| `npm test` | Playwright loopback test + dependency audit (main test suite) |
| `npm run test:loopback` | Automated UI loopback test (headless) |
| `npm run test:loopback:headed` | Same test with visible browser |
| `npm run test:loopback:debug` | Step-through debugging mode |
| `npm run test:loopback:ui` | Playwright UI mode |
| `npm run audit:ci` | Dependency vulnerability check |
| `npm run test:server:up` | Start Murmur test server |
| `npm run test:server:down` | Stop Murmur test server |
| `npm run test:server:logs` | Display server logs |

---

## 🎭 Playwright Tests

### Loopback Frequency Test

**Location:** `tests/playwright/loopback-frequency.spec.js`

**What it tests:**
- Complete audio pipeline (Microphone → Encoder → Server → Decoder → Output)
- Piano button frequency detection (~440 Hz)
- Mute/Deaf state handling
- UI frequency display updates
- Event-based beeper initialization

**Test Flow:**
1. Navigate to app with `?mock-auth&debug-audio`
2. Activate loopback mode (Audio Test toggle)
3. Connect to Mumble server
4. Wait for beeper initialization
5. Press piano button (🎹)
6. Monitor frequency analyzer
7. Assert ~440 Hz is detected
8. Verify display updates
9. Test mute/deaf states
10. Verify cleanup

**Detailed Documentation:**
- 📖 See `tests/playwright/README.md` for full details
- 🏗️ Architecture: `app/audio/README.md`
- 🎯 Configuration: `playwright.config.js`

---

## 🖥️ Test Server Management

The Playwright tests require a running Murmur server (Mumble protocol server).

### Start Test Server

```bash
npm run test:server:up
```

This starts the Murmur container in docker-compose. The server is available at `murmur:64738` from inside the dev container.

### Stop Test Server

```bash
npm run test:server:down
```

### View Server Logs

```bash
npm run test:server:logs
```

### Check Server Status

```bash
# From inside the dev container
curl -v --connect-timeout 2 telnet://murmur:64738 2>&1 | grep -E "Connected|refused"
```

**Expected output if running:**
```
* Connected to murmur (172.x.x.x) port 64738 (#0)
```

**If server is not running:**
```
* Failed to connect to murmur port 64738: Connection refused
```

---

## 🔧 Troubleshooting

### Playwright Tests Fail with "Connection Refused"

**Problem:** Tests can't connect to Murmur server at `murmur:64738`

**Solution:**
1. Check if murmur container is running:
   ```bash
   curl -v telnet://murmur:64738
   ```
2. If "Connection refused", restart the entire Codespace
3. You CANNOT restart murmur from inside the dev container

### Tests Pass Locally but Fail in CI

**Problem:** Tests work in Codespaces but fail in GitHub Actions

**Known Issue:** See Issue #176 - This is a known problem with CI environment differences.

**Current Status:** Playwright tests are disabled in CI (commented out in `.github/workflows/docker-image.yml`)

### Audio Tests Report 0 Hz

**Problem:** Frequency analyzer always reports 0 Hz

**Possible Causes:**
1. AudioContext is suspended (check `audioContext.state`)
2. Voice event handler not registered
3. Beeper not initialized
4. Audio permissions not granted

**Debug:**
```bash
# Run with headed mode to see browser
npm run test:loopback:headed

# Run with debug mode to step through
npm run test:loopback:debug
```

### "window.mumbleUi is undefined"

**Problem:** Test can't find the UI object

**Possible Causes:**
1. App failed to initialize
2. JavaScript error during startup
3. Build is broken

**Solution:**
1. Check browser console for errors (run with `--headed`)
2. Rebuild the app: `npm run build`
3. Check if `dist/index.html` exists and is not empty

---

## 📝 Notes

### No Unit Tests (Yet)

This project currently has **no unit tests** - only integration/E2E tests via Playwright.

**Known Technical Debt:** See `.github/copilot-instructions.md` - "No unit tests: Zero test files for application code; only integration tests exist"

**Planned:** Issue #155 - Setup Unit Testing Infrastructure

### Test Strategy

Current testing approach:
- **Integration tests:** Playwright loopback test validates entire audio pipeline
- **Security:** Dependency vulnerability checks via `npm run audit:ci`
- **Validation:** Markdown structure validation via `npm run validate:markdown`

Future plans:
- Add unit tests for critical components (AudioContext, Voice Handler, Buffer Queue)
- Add characterization tests before major refactorings
- Increase test coverage gradually

---

## 🔗 Related Documentation

- **Playwright Tests:** `tests/playwright/README.md`
- **Audio Debugging:** `app/audio/README.md`
- **State Architecture:** `app/state/README.md`
- **Auth Abstraction:** `app/auth/README.md`
- **Copilot Instructions:** `.github/copilot-instructions.md`
