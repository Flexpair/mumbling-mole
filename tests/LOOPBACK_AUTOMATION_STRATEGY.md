# Loopback Test Automation Strategy

## Executive Summary

This document outlines a comprehensive strategy to automate the piano button loopback test, which validates that when the 🎹 "Play an A (440 Hz)" button is pressed, the frequency analyzer displays approximately 440 Hz.

**Goal:** Automate end-to-end validation of audio loopback including frequency analysis.

---

## Current Manual Test Flow

### User Actions
1. Open Connect Dialog
2. Click "Audio Test" toggle → activates loopback mode
3. Fill in connection details (server/username)
4. Click "Connect" → connects to server with `target=31` (loopback)
5. Wait for connection + beeper initialization
6. Press and hold 🎹 button → starts 440 Hz tone
7. Observe frequency display showing ~440 Hz
8. Release button → tone stops

### Technical Flow
```
User mousedown on 🎹 button
    ↓
AudioState.startBeep()
    ↓
Persistent oscillator (440 Hz) → gain ramps to 0.4
    ↓
Split output: 
    - Local: localGain → destination (speakers)
    - Remote: beepGain → mixer → encode-worker
    ↓
Worker thread: Opus encoding + resampling
    ↓
WebSocket → Mumble server (target=31 loopback)
    ↓
Server echoes back to same client
    ↓
Worker thread: Opus decoding
    ↓
decoder-stream.js → BufferQueueNode
    ↓
UserState voice stream → AnalyserNode (FFT 32768)
    ↓
Frequency analysis (100ms interval)
    ↓
VoiceState.loopbackDominantFrequency updated
    ↓
UI displays frequency (~440 Hz)
```

### What We're Testing
- ✅ Audio capture (even though it's synthetic)
- ✅ Opus encoding
- ✅ Worker communication
- ✅ WebSocket transport
- ✅ Server loopback functionality
- ✅ Opus decoding
- ✅ Audio playback
- ✅ **Frequency analysis accuracy** (the key validation)
- ✅ End-to-end latency

---

## Recommended Automation Strategy

### **Option 1: Playwright E2E Test (PRIMARY RECOMMENDATION)**

#### Why This Approach?
- Tests the **actual user flow** (most realistic)
- Uses **real browser AudioContext** (no mocking)
- Validates **UI integration** (buttons, observables, display)
- Supports **screenshot debugging** (visual verification)
- Integrates with **existing test infrastructure**
- Can measure **actual latency** (user experience metric)

#### Implementation Steps

##### 1. Install Playwright
```bash
npm install -D @playwright/test
npx playwright install chromium
```

##### 2. Create Playwright Config
```javascript
// playwright.config.js
import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/playwright',
  timeout: 60000, // 60s for audio tests
  use: {
    baseURL: 'http://localhost:8081',
    launchOptions: {
      args: [
        '--use-fake-ui-for-media-stream', // Auto-grant mic permission
        '--use-fake-device-for-media-stream', // Fake microphone
        '--autoplay-policy=no-user-gesture-required' // Allow audio
      ]
    },
    permissions: ['microphone'], // Grant microphone access
    video: 'retain-on-failure', // Debug failed tests
    screenshot: 'only-on-failure'
  },
  webServer: {
    command: 'SKIP_TUNNEL=1 PORT=8081 ./docker-entrypoint.sh',
    port: 8081,
    reuseExistingServer: !process.env.CI,
    timeout: 30000
  },
  projects: [
    {
      name: 'chromium',
      use: { 
        browserName: 'chromium',
        channel: 'chromium' // Use system Chromium
      }
    }
  ]
});
```

##### 3. Create Loopback Test Spec
```javascript
// tests/playwright/loopback-frequency.spec.js
import { test, expect } from '@playwright/test';

test.describe('Loopback Frequency Test', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to app
    await page.goto('/');
    
    // Wait for app initialization
    await page.waitForFunction(() => window.ui !== undefined);
  });

  test('should display ~440 Hz when piano button is pressed', async ({ page }) => {
    // STEP 1: Activate loopback mode
    await page.click('.test-toggle-label');
    
    // STEP 2: Fill connection details (or use defaults)
    const serverInput = page.locator('#address');
    const usernameInput = page.locator('#username');
    
    if (await serverInput.isVisible()) {
      await serverInput.fill('localhost:64738');
    }
    if (await usernameInput.isVisible()) {
      await usernameInput.fill('AutomatedTestBot');
    }
    
    // STEP 3: Connect in loopback mode
    await page.click('#connect-dialog_controls_connect');
    
    // STEP 4: Wait for connection + beeper initialization
    await page.waitForFunction(
      () => window.ui && 
            window.ui.connection.thisUser() !== null && 
            window.ui.beeperReady() === true &&
            window.ui.voiceHandlerReady() === true,
      { timeout: 20000 }
    );
    
    console.log('✅ Connected and beeper ready');
    
    // STEP 5: Press piano button (simulate mousedown)
    const pianoButton = page.locator('.beep-test-button');
    await expect(pianoButton).toBeVisible({ timeout: 5000 });
    
    // Start beeping
    await pianoButton.dispatchEvent('mousedown');
    
    console.log('🎹 Piano button pressed');
    
    // STEP 6: Wait for frequency analysis to stabilize (300-500ms)
    await page.waitForTimeout(500);
    
    // STEP 7: Check frequency display multiple times for stability
    const frequencies = [];
    for (let i = 0; i < 5; i++) {
      const freq = await page.evaluate(() => {
        return window.ui?.voice?.loopbackDominantFrequency() || 0;
      });
      frequencies.push(freq);
      console.log(`Frequency reading ${i + 1}: ${freq} Hz`);
      await page.waitForTimeout(100); // 100ms between readings
    }
    
    // STEP 8: Validate frequencies
    const validFrequencies = frequencies.filter(f => f > 0);
    expect(validFrequencies.length).toBeGreaterThan(0); // At least one valid reading
    
    const avgFrequency = validFrequencies.reduce((a, b) => a + b, 0) / validFrequencies.length;
    console.log(`📊 Average frequency: ${avgFrequency.toFixed(1)} Hz`);
    
    // Assert frequency is approximately 440 Hz (±5% tolerance)
    expect(avgFrequency).toBeGreaterThan(418); // 440 - 5%
    expect(avgFrequency).toBeLessThan(462);    // 440 + 5%
    
    // STEP 9: Verify frequency display is visible
    const frequencyDisplay = page.locator('.loopback-frequency-display');
    await expect(frequencyDisplay).toBeVisible();
    
    const displayText = await frequencyDisplay.textContent();
    console.log(`📊 Display text: ${displayText}`);
    expect(displayText).toContain('Hz');
    
    // STEP 10: Release button
    await pianoButton.dispatchEvent('mouseup');
    console.log('🎹 Piano button released');
    
    // STEP 11: Verify frequency display clears (within 500ms)
    await page.waitForFunction(
      () => window.ui?.voice?.loopbackDominantFrequency() === 0,
      { timeout: 1000 }
    );
    
    const finalFreq = await page.evaluate(() => {
      return window.ui?.voice?.loopbackDominantFrequency() || 0;
    });
    expect(finalFreq).toBe(0);
    console.log('✅ Frequency display cleared after release');
  });

  test('should measure end-to-end latency', async ({ page }) => {
    // Setup: Connect in loopback mode (same as above)
    await page.click('.test-toggle-label');
    await page.click('#connect-dialog_controls_connect');
    await page.waitForFunction(
      () => window.ui?.beeperReady() === true && window.ui?.voiceHandlerReady() === true,
      { timeout: 20000 }
    );
    
    const pianoButton = page.locator('.beep-test-button');
    
    // Measure latency: time from button press to frequency detection
    const startTime = Date.now();
    await pianoButton.dispatchEvent('mousedown');
    
    // Wait for frequency to appear (non-zero)
    await page.waitForFunction(
      () => (window.ui?.voice?.loopbackDominantFrequency() || 0) > 100,
      { timeout: 5000 }
    );
    
    const latency = Date.now() - startTime;
    console.log(`⏱️  End-to-end latency: ${latency}ms`);
    
    // Assert latency is reasonable (< 1000ms)
    expect(latency).toBeLessThan(1000);
    
    // Cleanup
    await pianoButton.dispatchEvent('mouseup');
  });

  test('should handle rapid button presses', async ({ page }) => {
    // Setup
    await page.click('.test-toggle-label');
    await page.click('#connect-dialog_controls_connect');
    await page.waitForFunction(
      () => window.ui?.beeperReady() === true,
      { timeout: 20000 }
    );
    
    const pianoButton = page.locator('.beep-test-button');
    
    // Rapid press/release cycle
    for (let i = 0; i < 3; i++) {
      await pianoButton.dispatchEvent('mousedown');
      await page.waitForTimeout(200); // Short press
      await pianoButton.dispatchEvent('mouseup');
      await page.waitForTimeout(200); // Short gap
    }
    
    // Should not crash and should eventually clear
    await page.waitForFunction(
      () => (window.ui?.voice?.loopbackDominantFrequency() || 0) === 0,
      { timeout: 2000 }
    );
    
    console.log('✅ Handled rapid button presses without errors');
  });
});
```

##### 4. Add NPM Script
```json
// package.json
{
  "scripts": {
    "test:loopback": "playwright test loopback-frequency.spec.js",
    "test:loopback:headed": "playwright test loopback-frequency.spec.js --headed",
    "test:loopback:debug": "playwright test loopback-frequency.spec.js --debug"
  }
}
```

##### 5. Integration with Existing Tests
```bash
# Update scripts/run-all-tests.sh
#!/bin/bash
set -e

echo "Running E2E tests..."
npm run test:e2e

echo "Running audio system tests..."
npm run test:audio:system

echo "Running loopback frequency test..."
npm run test:loopback

echo "Running security audit..."
npm run audit:ci

echo "✅ All tests passed!"
```

---

### **Option 2: Programmatic Test (ALTERNATIVE)**

For faster CI runs or when UI testing isn't required.

#### Implementation
```javascript
// tests/loopback-programmatic.test.js
import { chromium } from 'playwright';

async function testLoopbackProgrammatically() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    permissions: ['microphone']
  });
  const page = await context.newPage();
  
  await page.goto('http://localhost:8081');
  
  // Inject test controller
  const result = await page.evaluate(async () => {
    // Wait for UI initialization
    while (!window.ui) await new Promise(r => setTimeout(r, 100));
    
    // Connect in loopback mode programmatically
    await window.ui.connectLoopback('localhost:64738', '64738', 'TestBot', '');
    
    // Wait for connection
    while (!window.ui.connection.thisUser()) {
      await new Promise(r => setTimeout(r, 100));
    }
    
    // Wait for beeper
    while (!window.ui.beeperReady()) {
      await new Promise(r => setTimeout(r, 100));
    }
    
    // Start beep
    window.ui.startBeep();
    
    // Collect frequency readings
    const readings = [];
    for (let i = 0; i < 10; i++) {
      await new Promise(r => setTimeout(r, 100));
      const freq = window.ui.voice.loopbackDominantFrequency();
      readings.push(freq);
    }
    
    // Stop beep
    window.ui.stopBeep();
    
    // Calculate average
    const validReadings = readings.filter(f => f > 0);
    const avg = validReadings.reduce((a, b) => a + b, 0) / validReadings.length;
    
    return { readings, avg };
  });
  
  console.log('Frequency readings:', result.readings);
  console.log('Average:', result.avg);
  
  // Assert
  if (result.avg < 418 || result.avg > 462) {
    throw new Error(`Frequency out of range: ${result.avg} Hz (expected ~440 Hz)`);
  }
  
  await browser.close();
  console.log('✅ Programmatic test passed!');
}

testLoopbackProgrammatically().catch(console.error);
```

---

## Test Infrastructure Setup

### 1. Test Server Configuration
```bash
# .devcontainer/docker-compose.yml (already exists)
# Ensure Murmur is configured for loopback
services:
  murmur:
    image: mumblevoip/mumble-server:latest
    ports:
      - "64738:64738/tcp"
      - "64738:64738/udp"
    volumes:
      - ./murmur.ini:/etc/murmur/murmur.ini
```

### 2. CI/CD Integration
```yaml
# .github/workflows/test.yml
name: Automated Tests

on: [push, pull_request]

jobs:
  loopback-test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '22'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Install Playwright
        run: npx playwright install --with-deps chromium
      
      - name: Build application
        run: npm run build
      
      - name: Start test server
        run: |
          npm run test:server:up
          sleep 5 # Wait for server to start
      
      - name: Run loopback test
        run: npm run test:loopback
      
      - name: Upload test artifacts
        if: failure()
        uses: actions/upload-artifact@v3
        with:
          name: test-results
          path: test-results/
      
      - name: Cleanup
        if: always()
        run: npm run test:server:down
```

---

## Test Execution Matrix

| Test Type | Environment | Duration | Frequency | Purpose |
|-----------|-------------|----------|-----------|---------|
| **Quick Smoke** | Local dev | ~10s | On save | Fast feedback |
| **Full E2E** | Local/CI | ~30s | Pre-commit | Comprehensive validation |
| **Latency Benchmark** | CI | ~20s | Nightly | Performance tracking |
| **Stress Test** | CI | ~60s | Weekly | Stability validation |

---

## Success Criteria

### Functional Requirements
- ✅ Test connects to server in loopback mode
- ✅ Beeper initializes successfully
- ✅ Piano button triggers 440 Hz tone
- ✅ Frequency analyzer detects ~440 Hz (±5%)
- ✅ Display updates within 500ms
- ✅ Frequency clears after button release
- ✅ No audio artifacts or crashes

### Performance Requirements
- ✅ End-to-end latency < 1000ms
- ✅ Frequency detection accuracy ≥95%
- ✅ Test completes in < 30s

### Reliability Requirements
- ✅ Test passes 100% in stable environment
- ✅ Handles edge cases (rapid clicks, network delays)
- ✅ Provides clear error messages on failure

---

## Implementation Timeline

### Phase 1: Setup (Week 1)
- [ ] Install Playwright
- [ ] Create basic test spec
- [ ] Configure test server
- [ ] Validate manual execution

### Phase 2: Core Test (Week 2)
- [ ] Implement frequency validation test
- [ ] Add latency measurement test
- [ ] Add edge case tests
- [ ] Integrate with npm scripts

### Phase 3: CI/CD (Week 3)
- [ ] Add GitHub Actions workflow
- [ ] Configure artifact uploads
- [ ] Add test reporting
- [ ] Document for team

### Phase 4: Optimization (Week 4)
- [ ] Tune timeouts
- [ ] Add retry logic
- [ ] Improve error messages
- [ ] Add performance benchmarks

---

## Troubleshooting Guide

### Common Issues

#### 1. AudioContext Suspended
**Symptom:** Beeper doesn't initialize  
**Fix:** Ensure `--autoplay-policy=no-user-gesture-required` in Playwright config

#### 2. Frequency Not Detected
**Symptom:** loopbackDominantFrequency stays at 0  
**Fix:** 
- Check AnalyserNode FFT size (32768 for 1.46 Hz resolution)
- Verify amplitude threshold (>50)
- Increase wait time after beep start (500ms)

#### 3. Connection Timeout
**Symptom:** Test times out waiting for connection  
**Fix:**
- Verify Murmur server is running (`docker ps`)
- Check WebSocket tunnel (`tail -f /tmp/entrypoint.log`)
- Increase timeout in `page.waitForFunction()`

#### 4. Flaky Test Results
**Symptom:** Test passes sometimes, fails others  
**Fix:**
- Take multiple frequency readings (5-10)
- Calculate average instead of single reading
- Allow ±10% tolerance instead of ±5%

---

## Alternative Approaches (Not Recommended)

### ❌ Mock AudioContext
**Why not:** Defeats purpose of testing real audio pipeline

### ❌ Synthetic Frequency Injection
**Why not:** Doesn't test actual encoding/decoding

### ❌ Server-Side Validation Only
**Why not:** Misses browser-specific issues (see `app/audio/README.md` line 7-18)

---

## References

- **Existing Tests:** `scripts/audio-test.cjs` (Node.js CLI test)
- **Loopback Implementation:** `app/audio/voice.js` (target=31)
- **Frequency Analysis:** `app/state/UserState.js` (lines 150-250)
- **Beeper Logic:** `app/state/AudioState.js` (initializePersistentBeeper)
- **Test Infrastructure:** `tests/README.md`
- **Playwright Docs:** https://playwright.dev/

---

## Next Steps

1. **Review this strategy** with the team
2. **Install Playwright:** `npm install -D @playwright/test`
3. **Create test spec:** Copy code from Option 1, Section 3
4. **Run manually:** `npm run test:loopback:headed` to see it work
5. **Iterate:** Tune timeouts and tolerances based on results
6. **Integrate:** Add to CI/CD pipeline

**Estimated effort:** 2-3 days for full implementation and testing

---

## Conclusion

The **Playwright E2E test approach** is the most comprehensive and realistic way to automate the loopback frequency test. It validates the entire user flow, uses real browser APIs, and provides excellent debugging capabilities through screenshots and videos.

The test will:
1. ✅ Connect to server in loopback mode
2. ✅ Press the piano button programmatically
3. ✅ Monitor the frequency analyzer
4. ✅ Assert ~440 Hz is detected
5. ✅ Measure end-to-end latency
6. ✅ Handle edge cases

This gives you **confidence that your audio pipeline works end-to-end**, not just the server loopback, but the entire browser-based audio processing chain including frequency analysis.
