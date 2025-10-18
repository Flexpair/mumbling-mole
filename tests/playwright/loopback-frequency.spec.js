/**
 * Loopback Frequency Test
 * 
 * Automated E2E test for the piano button loopback feature.
 * 
 * Test Flow:
 * 1. Activate loopback mode (Audio Test toggle)
 * 2. Connect to Mumble server
 * 3. Wait for beeper initialization
 * 4. Press piano button (🎹)
 * 5. Monitor frequency analyzer
 * 6. Assert ~440 Hz is detected
 * 7. Verify display updates
 * 8. Release button and verify cleanup
 * 
 * Requirements:
 * - Mumble test server running (localhost:64738)
 * - App built and served on localhost:8081
 * - Chromium with fake audio devices
 * 
 * Usage:
 *   npm run test:loopback
 */

import { test, expect } from '@playwright/test';

// Test configuration
const TEST_CONFIG = {
  // App handles Mumble server connection in background
  // We only need to interact with the UI
  EXPECTED_FREQUENCY: 440, // Hz
  FREQUENCY_TOLERANCE: 0.05, // ±5%
  CONNECTION_TIMEOUT: 20000, // 20s
  BEEPER_WAIT: 500, // 500ms for audio to stabilize
  FREQUENCY_READINGS: 5, // Number of samples to average
  READING_INTERVAL: 100 // ms between readings
};

test.describe('Loopback Frequency Test', () => {
  
  test.beforeEach(async ({ page }) => {
    // Enable ALL console logging from the page for debugging
    page.on('console', msg => {
      const type = msg.type();
      const text = msg.text();
      if (type === 'error') {
        console.error(`[PAGE ERROR] ${text}`);
      } else if (type === 'warning') {
        console.warn(`[PAGE WARN] ${text}`);
      } else {
        console.log(`[PAGE ${type.toUpperCase()}] ${text}`);
      }
    });
    
    // Capture page errors
    page.on('pageerror', error => {
      console.error(`[PAGE EXCEPTION] ${error.message}\n${error.stack}`);
    });
    
    // Navigate to app
    console.log('🌐 Navigating to application...');
    
    await page.goto('/', { waitUntil: 'networkidle', timeout: 30000 });
    
    // Handle Netlify Identity Widget login
    console.log('🔐 Checking for Netlify Identity login...');
    try {
      // Wait for iframe to appear
      await page.waitForSelector('iframe', { timeout: 5000 });
      const iframe = page.frameLocator('iframe').first();
      
      // Switch to "Log in" tab
      const loginTab = iframe.locator('button:has-text("Log in")');
      if (await loginTab.isVisible({ timeout: 2000 })) {
        await loginTab.click();
        console.log('✅ Switched to Log in tab');
        await page.waitForTimeout(500);
      }
      
      // Fill in credentials
      const emailInput = iframe.locator('input[type="email"]');
      const passwordInput = iframe.locator('input[type="password"]');
      
      if (await emailInput.isVisible({ timeout: 2000 })) {
        const testEmail = process.env.TEST_EMAIL || 'test@example.com';
        const testPassword = process.env.TEST_PASSWORD || 'testpassword';
        
        console.log(`🔐 Logging in as ${testEmail}...`);
        await emailInput.fill(testEmail);
        await passwordInput.fill(testPassword);
        
        const loginButton = iframe.locator('button[type="submit"]');
        await loginButton.click();
        console.log('✅ Submitted login credentials');
        
        // Wait for login to complete
        await page.waitForTimeout(3000);
      }
    } catch (e) {
      console.log('ℹ️  No Netlify Identity login required or already logged in');
    }
    
    // Wait for app initialization (window.mumbleUi should be defined)
    console.log('⏳ Waiting for UI initialization...');
    
    // Wait for window.mumbleUi to be defined (app uses mumbleUi not ui)
    await page.waitForFunction(
      () => {
        return window.mumbleUi !== undefined && 
               document.querySelector('#container') !== null;
      }, 
      { timeout: 30000 }
    );
    console.log('✅ UI initialized');
  });

  test('should display ~440 Hz when piano button is pressed', async ({ page }) => {
    console.log('\n🎵 TEST: Piano Button Frequency Detection\n');
    
    // STEP 1: Wait for connect dialog to appear (should show after mock login)
    console.log('🔄 Step 1: Waiting for connect dialog...');
    await page.waitForSelector('.connect-dialog', { state: 'visible', timeout: 10000 });
    console.log('✅ Connect dialog visible');
    
    // STEP 2: Activate test mode via toggle
    console.log('🔄 Step 2: Clicking Audio Test toggle...');
    const testToggle = page.locator('.test-toggle-label');
    await expect(testToggle).toBeVisible({ timeout: 5000 });
    await testToggle.click();
    console.log('✅ Test toggle clicked');
    
    // Verify test mode is active
    const isTestActive = await page.evaluate(() => {
      return window.mumbleUi?.connectDialog?.isTestActive() || false;
    });
    expect(isTestActive).toBe(true);
    console.log('✅ Test mode activated');
    
    // STEP 3: Wait for audio components to initialize
    console.log('⏳ Step 3: Waiting for audio components to initialize...');
    console.log('   (This may take a few seconds)');
    
    await page.waitForFunction(
      () => {
        const ui = window.mumbleUi;
        if (!ui) return false;
        
        // Check if audio context is ready
        const audioContextReady = ui.audio?.audioContext?.state === 'running';
        
        // Check if test mode components are ready
        const testModeReady = ui.connectDialog?.isTestActive() === true;
        
        return audioContextReady && testModeReady;
      },
      { timeout: 15000 }
    );
    
    console.log('✅ Audio components ready');
    
    // STEP 4: Wait for piano button to appear
    console.log('🎹 Step 4: Waiting for piano button to appear...');
    const pianoButton = page.locator('.beep-test-button');
    await expect(pianoButton).toBeVisible({ timeout: 10000 });
    console.log('✅ Piano button visible');
    
    // STEP 5: Press piano button (simulate mousedown)
    console.log('🎹 Step 5: Pressing piano button...');
    await pianoButton.dispatchEvent('mousedown');
    console.log('✅ Piano button pressed (mousedown event dispatched)');
    
    // STEP 6: Wait for audio to stabilize
    console.log(`⏳ Step 6: Waiting ${TEST_CONFIG.BEEPER_WAIT}ms for audio to stabilize...`);
    await page.waitForTimeout(TEST_CONFIG.BEEPER_WAIT);
    
    // STEP 7: Collect multiple frequency readings
    console.log(`📊 Step 7: Collecting ${TEST_CONFIG.FREQUENCY_READINGS} frequency readings...`);
    const frequencies = [];
    
    for (let i = 0; i < TEST_CONFIG.FREQUENCY_READINGS; i++) {
      const freq = await page.evaluate(() => {
        return window.mumbleUi?.voice?.loopbackDominantFrequency() || 0;
      });
      frequencies.push(freq);
      console.log(`   Reading ${i + 1}/${TEST_CONFIG.FREQUENCY_READINGS}: ${freq} Hz`);
      
      if (i < TEST_CONFIG.FREQUENCY_READINGS - 1) {
        await page.waitForTimeout(TEST_CONFIG.READING_INTERVAL);
      }
    }
    
    // STEP 8: Validate frequency readings
    console.log('📊 Step 8: Validating frequency readings...');
    
    const validFrequencies = frequencies.filter(f => f > 0);
    console.log(`   Valid readings: ${validFrequencies.length}/${TEST_CONFIG.FREQUENCY_READINGS}`);
    
    expect(validFrequencies.length).toBeGreaterThan(0);
    
    const avgFrequency = validFrequencies.reduce((a, b) => a + b, 0) / validFrequencies.length;
    console.log(`   Average frequency: ${avgFrequency.toFixed(1)} Hz`);
    
    const minFreq = TEST_CONFIG.EXPECTED_FREQUENCY * (1 - TEST_CONFIG.FREQUENCY_TOLERANCE);
    const maxFreq = TEST_CONFIG.EXPECTED_FREQUENCY * (1 + TEST_CONFIG.FREQUENCY_TOLERANCE);
    
    console.log(`   Expected range: ${minFreq.toFixed(1)} - ${maxFreq.toFixed(1)} Hz`);
    
    expect(avgFrequency).toBeGreaterThan(minFreq);
    expect(avgFrequency).toBeLessThan(maxFreq);
    
    console.log(`✅ Frequency validation passed! (${avgFrequency.toFixed(1)} Hz ≈ ${TEST_CONFIG.EXPECTED_FREQUENCY} Hz)`);
    
    // STEP 9: Verify frequency display is visible in UI
    console.log('👁️  Step 9: Verifying frequency display...');
    const frequencyDisplay = page.locator('.loopback-frequency-display');
    await expect(frequencyDisplay).toBeVisible();
    
    const displayText = await frequencyDisplay.textContent();
    console.log(`   Display text: "${displayText}"`);
    expect(displayText).toContain('Hz');
    console.log('✅ Frequency display visible and contains Hz');
    
    // STEP 10: Release button
    console.log('🎹 Step 10: Releasing piano button...');
    await pianoButton.dispatchEvent('mouseup');
    console.log('✅ Piano button released (mouseup event dispatched)');
    
    // STEP 11: Verify frequency display clears
    console.log('🧹 Step 11: Verifying frequency display clears...');
    await page.waitForFunction(
      () => (window.mumbleUi?.voice?.loopbackDominantFrequency() || 0) === 0,
      { timeout: 1000 }
    );
    
    const finalFreq = await page.evaluate(() => {
      return window.mumbleUi?.voice?.loopbackDominantFrequency() || 0;
    });
    expect(finalFreq).toBe(0);
    console.log('✅ Frequency display cleared after button release');
    
    console.log('\n✅ TEST PASSED: Piano button loopback test completed successfully!\n');
  });

  test('should measure end-to-end latency', async ({ page }) => {
    console.log('\n⏱️  TEST: End-to-End Latency Measurement\n');
    
    // Setup: Connect in loopback mode
    console.log('🔧 Setup: Connecting in loopback mode...');
    await page.click('.test-toggle-label');
    await page.click('#connect-dialog_controls_connect');
    
    await page.waitForFunction(
      () => window.mumbleUi?.beeperReady() === true && window.mumbleUi?.voiceHandlerReady() === true,
      { timeout: TEST_CONFIG.CONNECTION_TIMEOUT }
    );
    console.log('✅ Setup complete');
    
    const pianoButton = page.locator('.beep-test-button');
    await expect(pianoButton).toBeVisible();
    
    // Measure latency: time from button press to frequency detection
    console.log('⏱️  Measuring latency...');
    const startTime = Date.now();
    await pianoButton.dispatchEvent('mousedown');
    
    // Wait for significant frequency to appear (> 100 Hz threshold)
    await page.waitForFunction(
      () => (window.mumbleUi?.voice?.loopbackDominantFrequency() || 0) > 100,
      { timeout: 5000 }
    );
    
    const latency = Date.now() - startTime;
    console.log(`📊 End-to-end latency: ${latency}ms`);
    
    // Assert latency is reasonable (< 1000ms)
    expect(latency).toBeLessThan(1000);
    console.log('✅ Latency within acceptable range (<1000ms)');
    
    // Cleanup
    await pianoButton.dispatchEvent('mouseup');
    
    console.log('\n✅ TEST PASSED: Latency measurement completed!\n');
  });

  test('should handle rapid button presses without errors', async ({ page }) => {
    console.log('\n🚀 TEST: Rapid Button Press Handling\n');
    
    // Setup
    console.log('🔧 Setup: Connecting in loopback mode...');
    await page.click('.test-toggle-label');
    await page.click('#connect-dialog_controls_connect');
    
    await page.waitForFunction(
      () => window.mumbleUi?.beeperReady() === true && window.mumbleUi?.voiceHandlerReady() === true,
      { timeout: TEST_CONFIG.CONNECTION_TIMEOUT }
    );
    console.log('✅ Setup complete');
    
    const pianoButton = page.locator('.beep-test-button');
    
    // Track any errors
    const errors = [];
    page.on('pageerror', error => {
      errors.push(error.message);
      console.error(`❌ Page error: ${error.message}`);
    });
    
    // Rapid press/release cycle
    console.log('🚀 Performing rapid button presses...');
    for (let i = 0; i < 3; i++) {
      console.log(`   Cycle ${i + 1}/3`);
      await pianoButton.dispatchEvent('mousedown');
      await page.waitForTimeout(200); // Short press (200ms)
      await pianoButton.dispatchEvent('mouseup');
      await page.waitForTimeout(200); // Short gap (200ms)
    }
    
    // Should not crash and should eventually clear
    console.log('🧹 Waiting for frequency to clear...');
    await page.waitForFunction(
      () => (window.mumbleUi?.voice?.loopbackDominantFrequency() || 0) === 0,
      { timeout: 2000 }
    );
    
    // Assert no errors occurred
    expect(errors.length).toBe(0);
    console.log('✅ Handled rapid button presses without errors');
    
    console.log('\n✅ TEST PASSED: Rapid press test completed!\n');
  });

  test('should handle mute/deaf states correctly', async ({ page }) => {
    console.log('\n🔇 TEST: Mute/Deaf State Handling\n');
    
    // Setup
    console.log('🔧 Setup: Connecting in loopback mode...');
    await page.click('.test-toggle-label');
    await page.click('#connect-dialog_controls_connect');
    
    await page.waitForFunction(
      () => window.mumbleUi?.beeperReady() === true && window.mumbleUi?.voiceHandlerReady() === true,
      { timeout: TEST_CONFIG.CONNECTION_TIMEOUT }
    );
    console.log('✅ Setup complete');
    
    const pianoButton = page.locator('.beep-test-button');
    
    // Press button
    console.log('🎹 Pressing button...');
    await pianoButton.dispatchEvent('mousedown');
    await page.waitForTimeout(500);
    
    // Verify frequency is detected
    let freq = await page.evaluate(() => window.mumbleUi?.voice?.loopbackDominantFrequency() || 0);
    console.log(`📊 Frequency before deaf: ${freq} Hz`);
    expect(freq).toBeGreaterThan(100);
    
    // Enable self-deaf
    console.log('🔇 Enabling self-deaf...');
    await page.evaluate(() => {
      window.mumbleUi?.user?.setSelfDeaf(true);
    });
    await page.waitForTimeout(200);
    
    // Verify frequency display clears when deaf
    freq = await page.evaluate(() => window.mumbleUi?.voice?.loopbackDominantFrequency() || 0);
    console.log(`📊 Frequency while deaf: ${freq} Hz`);
    expect(freq).toBe(0);
    console.log('✅ Frequency cleared when deaf');
    
    // Disable self-deaf
    console.log('🔊 Disabling self-deaf...');
    await page.evaluate(() => {
      window.mumbleUi?.user?.setSelfDeaf(false);
    });
    await page.waitForTimeout(500);
    
    // Verify frequency reappears
    freq = await page.evaluate(() => window.mumbleUi?.voice?.loopbackDominantFrequency() || 0);
    console.log(`📊 Frequency after deaf disabled: ${freq} Hz`);
    expect(freq).toBeGreaterThan(100);
    console.log('✅ Frequency reappeared after deaf disabled');
    
    // Cleanup
    await pianoButton.dispatchEvent('mouseup');
    
    console.log('\n✅ TEST PASSED: Mute/deaf handling test completed!\n');
  });
});
