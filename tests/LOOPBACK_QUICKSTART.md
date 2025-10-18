# Loopback Test Automation - Quick Start Guide

## ⚠️ Current Status: Work In Progress

The loopback test automation infrastructure is **partially implemented** but not yet fully functional. Current progress:

**✅ Completed:**
- Playwright configuration with Chromium browser
- MockAuth adapter for automated testing (bypasses Netlify Identity)
- Test suite structure with 4 test scenarios
- Documentation and strategy guides

**🚧 In Progress:**
- WebSocket connection to Mumble server failing in test environment
- Audio components (`beeperReady`, `voiceHandlerReady`) not initializing
- Piano button visibility depends on successful connection

**🔍 Current Blocker:**
Browser test environment cannot establish WebSocket connection to Mumble server, causing test to hang at "Waiting for piano button to appear" step. Investigating websockify proxy configuration and network routing.

---

## 🚀 Installation & Setup

### Step 1: Install Playwright Dependencies
```bash
# Playwright and dependencies are already in package.json
npm install

# Chromium browser was installed via Dockerfile during container build
# To verify: npx playwright --version
```

### Step 2: Verify Test Infrastructure
**Important:** The Mumble test server must be running OUTSIDE the devcontainer.

From your host machine (NOT inside devcontainer):
```bash
# Check if murmur container is running
docker ps | grep murmur

# If not running, start via docker-compose
cd .devcontainer && docker-compose up -d murmur
```

Check network connectivity from devcontainer:
```bash
# Verify murmur is reachable
curl -v telnet://172.18.0.5:64738
```

### Step 3: Build the Application
```bash
npm run build
# Or for quick rebuild during development:
./rebuild-and-restart.sh
```

---

## 🧪 Running Tests

### Basic Test Run (Headless)
```bash
npm run test:loopback
```

This runs all loopback tests in headless mode. You'll see console output showing test progress.

### Headed Mode (Visible Browser)
```bash
npm run test:loopback:headed
```

Watch the browser automation in action! Useful for debugging.

### Debug Mode (Step-by-Step)
```bash
npm run test:loopback:debug
```

Opens Playwright Inspector for step-by-step debugging.

### UI Mode (Interactive)
```bash
npm run test:loopback:ui
```

Opens Playwright UI for interactive test exploration.

---

## 📊 Test Scenarios

### 1. Frequency Detection Test
**What it tests:**
- Connects in loopback mode
- Presses piano button
- Verifies ~440 Hz is detected
- Checks display updates
- Verifies cleanup after release

**Expected result:** ✅ Pass if frequency is 418-462 Hz (±5%)

### 2. Latency Measurement Test
**What it tests:**
- Measures time from button press to frequency detection
- Validates end-to-end audio pipeline latency

**Expected result:** ✅ Pass if latency < 1000ms

### 3. Rapid Button Press Test
**What it tests:**
- Multiple quick press/release cycles
- No crashes or errors
- Proper cleanup between cycles

**Expected result:** ✅ Pass if no errors occur

### 4. Mute/Deaf State Test
**What it tests:**
- Frequency display clears when deaf
- Frequency reappears when deaf disabled

**Expected result:** ✅ Pass if display responds to mute/deaf changes

---

## 🔍 Interpreting Results

### Success Example
```
🎵 TEST: Piano Button Frequency Detection

✅ Loopback mode activated
✅ Connected and beeper ready
🎹 Piano button pressed
📊 Collecting 5 frequency readings...
   Reading 1/5: 439.5 Hz
   Reading 2/5: 440.2 Hz
   Reading 3/5: 440.1 Hz
   Reading 4/5: 439.8 Hz
   Reading 5/5: 440.3 Hz
   Average frequency: 440.0 Hz
✅ Frequency validation passed! (440.0 Hz ≈ 440 Hz)
✅ TEST PASSED: Piano button loopback test completed successfully!
```

### Failure Examples

#### Frequency Out of Range
```
❌ Expected: 418 < 500.2 < 462
```
**Cause:** Wrong tone frequency or FFT analysis issue  
**Fix:** Check oscillator frequency in AudioState.js

#### Connection Timeout
```
❌ Timeout 20000ms exceeded waiting for connection
```
**Cause:** Server not running or WebSocket issues  
**Fix:** Run `npm run test:server:up` and check logs

#### Beeper Not Ready
```
❌ Timeout waiting for beeperReady
```
**Cause:** Audio context suspended or mixer not available  
**Fix:** Check browser audio permissions and autoplay policy

---

## 🛠️ Troubleshooting

### Test Times Out Connecting
```bash
# Check if server is running
docker ps | grep murmur

# Check server logs
npm run test:server:logs

# Restart server
npm run test:server:down
npm run test:server:up
```

### Browser Doesn't Open in Headed Mode
```bash
# Reinstall browsers
npx playwright install chromium --force
```

### AudioContext Suspended Error
Make sure Playwright config has these flags:
```javascript
args: [
  '--autoplay-policy=no-user-gesture-required',
  '--use-fake-device-for-media-stream'
]
```

### Frequency Display Doesn't Update
Check browser console output in headed mode:
```bash
npm run test:loopback:headed
```

Look for `[LOOPBACK-FREQ]` and `[BEEP]` log messages.

---

## 🔧 Configuration

### Environment Variables

```bash
# Custom Mumble server
MUMBLE_SERVER=myserver.com:64738 npm run test:loopback

# Custom username
TEST_USERNAME=MyTestBot npm run test:loopback

# Server password
TEST_PASSWORD=secret npm run test:loopback
```

### Test Timeouts

Edit `playwright.config.js`:
```javascript
export default defineConfig({
  timeout: 60000, // Test timeout (60s)
  expect: {
    timeout: 10000 // Assertion timeout (10s)
  }
});
```

### Frequency Tolerance

Edit `tests/playwright/loopback-frequency.spec.js`:
```javascript
const TEST_CONFIG = {
  EXPECTED_FREQUENCY: 440,
  FREQUENCY_TOLERANCE: 0.05, // ±5% (change to 0.10 for ±10%)
};
```

---

## 📈 CI/CD Integration

### GitHub Actions Example

```yaml
name: Loopback Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - uses: actions/setup-node@v3
        with:
          node-version: '22'
      
      - run: npm ci
      - run: npx playwright install --with-deps chromium
      - run: npm run build
      - run: npm run test:server:up
      - run: npm run test:loopback
      
      - uses: actions/upload-artifact@v3
        if: failure()
        with:
          name: playwright-report
          path: test-results/
```

---

## 📝 Viewing Test Reports

After tests run, view the HTML report:
```bash
npx playwright show-report test-results/playwright-report
```

This opens an interactive report in your browser showing:
- Test results and timing
- Screenshots of failures
- Video recordings (if enabled)
- Console logs
- Network activity

---

## 🎯 Next Steps

1. **Run your first test:**
   ```bash
   npm run test:loopback:headed
   ```

2. **Watch it work:** You'll see the browser automatically:
   - Click the Audio Test toggle
   - Connect to the server
   - Press the piano button
   - Verify the frequency display

3. **Integrate into your workflow:**
   - Add to pre-commit hook
   - Run in CI/CD pipeline
   - Schedule nightly performance tests

4. **Customize for your needs:**
   - Adjust frequency tolerance
   - Add custom test scenarios
   - Configure different servers

---

## 📚 Additional Resources

- **Full Strategy Document:** `tests/LOOPBACK_AUTOMATION_STRATEGY.md`
- **Playwright Docs:** https://playwright.dev/
- **Test Configuration:** `playwright.config.js`
- **Test Specs:** `tests/playwright/loopback-frequency.spec.js`
- **Audio Testing Guide:** `app/audio/README.md`
- **Overall Test Guide:** `tests/README.md`

---

## ❓ Getting Help

If tests fail or you encounter issues:

1. **Check logs:** Run with `--headed` to see what's happening
2. **Review browser console:** Look for `[LOOPBACK]` and `[BEEP]` messages
3. **Verify server:** Ensure Murmur is running and accessible
4. **Check timeouts:** Increase if running on slow machines
5. **Review strategy doc:** `tests/LOOPBACK_AUTOMATION_STRATEGY.md`

**Common Questions:**

**Q: Why does the test take so long?**  
A: Connection and beeper initialization can take 10-20 seconds. This is normal.

**Q: Can I run tests without a real server?**  
A: No, loopback requires a real Mumble server to echo audio back.

**Q: Why do I need Chromium specifically?**  
A: Audio testing requires real browser AudioContext APIs. Chromium provides the most consistent behavior.

**Q: Can I test on mobile devices?**  
A: Playwright supports mobile emulation, but audio testing is best on desktop browsers.

---

## ✅ Success Checklist

Before considering the automation complete:

- [ ] Tests pass consistently (3+ runs without failures)
- [ ] Frequency detection is accurate (within ±5%)
- [ ] Latency is acceptable (< 1000ms)
- [ ] No browser errors in console
- [ ] Test reports are generated correctly
- [ ] CI/CD integration works
- [ ] Team can run tests locally
- [ ] Documentation is clear

---

**Ready to go? Start with:**
```bash
npm install
npx playwright install chromium
npm run test:server:up
npm run test:loopback:headed
```

Watch the magic happen! 🎹✨
