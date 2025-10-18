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
  SERVER: process.env.MUMBLE_SERVER || 'localhost:64738',
  USERNAME: process.env.TEST_USERNAME || 'AutomatedTestBot',
  PASSWORD: process.env.TEST_PASSWORD || '',
  EXPECTED_FREQUENCY: 440, // Hz
  FREQUENCY_TOLERANCE: 0.05, // ±5%
  CONNECTION_TIMEOUT: 20000, // 20s
  BEEPER_WAIT: 500, // 500ms for audio to stabilize
  FREQUENCY_READINGS: 5, // Number of samples to average
  READING_INTERVAL: 100 // ms between readings
};

test.describe('Loopback Frequency Test', () => {
  
  test.beforeEach(async ({ page }) => {
    // Enable console logging from the page
    page.on('console', msg => {
      if (msg.type() === 'error') {
        console.error(`[PAGE ERROR] ${msg.text()}`);
      } else if (msg.text().includes('[LOOPBACK') || msg.text().includes('[BEEP]')) {
        console.log(`[PAGE LOG] ${msg.text()}`);
      }
    });
    
    // Navigate to app
    console.log('🌐 Navigating to application...');
    await page.goto('/');
    
    // Wait for app initialization (window.ui should be defined)
    console.log('⏳ Waiting for UI initialization...');
    await page.waitForFunction(() => window.ui !== undefined, { timeout: 10000 });
    console.log('✅ UI initialized');
  });

  test('should display ~440 Hz when piano button is pressed', async ({ page }) => {
    console.log('\n🎵 TEST: Piano Button Frequency Detection\n');
    
    // STEP 1: Activate loopback mode
    console.log('🔄 Step 1: Activating loopback mode...');
    const testToggle = page.locator('.test-toggle-label');
    await expect(testToggle).toBeVisible({ timeout: 5000 });
    await testToggle.click();
    console.log('✅ Loopback mode activated');
    
    // Verify test mode is active
    const isTestActive = await page.evaluate(() => {
      return window.ui?.connectDialog?.isTestActive() || false;
    });
    expect(isTestActive).toBe(true);
    
    // STEP 2: Fill connection details (use existing values if available)
    console.log('🔗 Step 2: Configuring connection...');
    
    const serverInput = page.locator('#address');
    const portInput = page.locator('#port');
    const usernameInput = page.locator('#username');
    const passwordInput = page.locator('#password');
    
    // Only fill if inputs are visible and editable
    if (await serverInput.isVisible().catch(() => false)) {
      await serverInput.fill(TEST_CONFIG.SERVER.split(':')[0]);
    }
    if (await portInput.isVisible().catch(() => false)) {
      await portInput.fill(TEST_CONFIG.SERVER.split(':')[1] || '64738');
    }
    if (await usernameInput.isVisible().catch(() => false) && !await usernameInput.getAttribute('readonly')) {
      await usernameInput.fill(TEST_CONFIG.USERNAME);
    }
    if (await passwordInput.isVisible().catch(() => false)) {
      await passwordInput.fill(TEST_CONFIG.PASSWORD);
    }
    
    console.log(`✅ Connection configured: ${TEST_CONFIG.SERVER} as ${TEST_CONFIG.USERNAME}`);
    
    // STEP 3: Connect in loopback mode
    console.log('🔌 Step 3: Connecting to server...');
    const connectButton = page.locator('#connect-dialog_controls_connect');
    await expect(connectButton).toBeVisible();
    await connectButton.click();
    
    // STEP 4: Wait for connection + beeper initialization
    console.log('⏳ Step 4: Waiting for connection and beeper initialization...');
    console.log('   (This may take up to 20 seconds)');
    
    await page.waitForFunction(
      () => {
        const ui = window.ui;
        if (!ui) return false;
        
        const connected = ui.connection?.thisUser() !== null;
        const beeperReady = ui.beeperReady() === true;
        const voiceReady = ui.voiceHandlerReady() === true;
        
        // Log progress
        if (!connected) console.log('   Waiting for connection...');
        else if (!beeperReady) console.log('   Waiting for beeper...');
        else if (!voiceReady) console.log('   Waiting for voice handler...');
        
        return connected && beeperReady && voiceReady;
      },
      { timeout: TEST_CONFIG.CONNECTION_TIMEOUT }
    );
    
    console.log('✅ Connected and beeper ready');
    
    // Verify loopback mode is active
    const isLoopbackMode = await page.evaluate(() => {
      return window.ui?.voice?.isLoopbackMode() || false;
    });
    expect(isLoopbackMode).toBe(true);
    console.log('✅ Loopback mode confirmed');
    
    // STEP 5: Find and verify piano button is visible
    console.log('🎹 Step 5: Locating piano button...');
    const pianoButton = page.locator('.beep-test-button');
    await expect(pianoButton).toBeVisible({ timeout: 5000 });
    console.log('✅ Piano button visible');
    
    // STEP 6: Press piano button (simulate mousedown)
    console.log('🎹 Step 6: Pressing piano button...');
    await pianoButton.dispatchEvent('mousedown');
    console.log('✅ Piano button pressed (mousedown event dispatched)');
    
    // STEP 7: Wait for audio to stabilize
    console.log(`⏳ Step 7: Waiting ${TEST_CONFIG.BEEPER_WAIT}ms for audio to stabilize...`);
    await page.waitForTimeout(TEST_CONFIG.BEEPER_WAIT);
    
    // STEP 8: Collect multiple frequency readings
    console.log(`📊 Step 8: Collecting ${TEST_CONFIG.FREQUENCY_READINGS} frequency readings...`);
    const frequencies = [];
    
    for (let i = 0; i < TEST_CONFIG.FREQUENCY_READINGS; i++) {
      const freq = await page.evaluate(() => {
        return window.ui?.voice?.loopbackDominantFrequency() || 0;
      });
      frequencies.push(freq);
      console.log(`   Reading ${i + 1}/${TEST_CONFIG.FREQUENCY_READINGS}: ${freq} Hz`);
      
      if (i < TEST_CONFIG.FREQUENCY_READINGS - 1) {
        await page.waitForTimeout(TEST_CONFIG.READING_INTERVAL);
      }
    }
    
    // STEP 9: Validate frequency readings
    console.log('📊 Step 9: Validating frequency readings...');
    
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
    
    // STEP 10: Verify frequency display is visible in UI
    console.log('👁️  Step 10: Verifying frequency display...');
    const frequencyDisplay = page.locator('.loopback-frequency-display');
    await expect(frequencyDisplay).toBeVisible();
    
    const displayText = await frequencyDisplay.textContent();
    console.log(`   Display text: "${displayText}"`);
    expect(displayText).toContain('Hz');
    console.log('✅ Frequency display visible and contains Hz');
    
    // STEP 11: Release button
    console.log('🎹 Step 11: Releasing piano button...');
    await pianoButton.dispatchEvent('mouseup');
    console.log('✅ Piano button released (mouseup event dispatched)');
    
    // STEP 12: Verify frequency display clears
    console.log('🧹 Step 12: Verifying frequency display clears...');
    await page.waitForFunction(
      () => (window.ui?.voice?.loopbackDominantFrequency() || 0) === 0,
      { timeout: 1000 }
    );
    
    const finalFreq = await page.evaluate(() => {
      return window.ui?.voice?.loopbackDominantFrequency() || 0;
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
      () => window.ui?.beeperReady() === true && window.ui?.voiceHandlerReady() === true,
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
      () => (window.ui?.voice?.loopbackDominantFrequency() || 0) > 100,
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
      () => window.ui?.beeperReady() === true && window.ui?.voiceHandlerReady() === true,
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
      () => (window.ui?.voice?.loopbackDominantFrequency() || 0) === 0,
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
      () => window.ui?.beeperReady() === true && window.ui?.voiceHandlerReady() === true,
      { timeout: TEST_CONFIG.CONNECTION_TIMEOUT }
    );
    console.log('✅ Setup complete');
    
    const pianoButton = page.locator('.beep-test-button');
    
    // Press button
    console.log('🎹 Pressing button...');
    await pianoButton.dispatchEvent('mousedown');
    await page.waitForTimeout(500);
    
    // Verify frequency is detected
    let freq = await page.evaluate(() => window.ui?.voice?.loopbackDominantFrequency() || 0);
    console.log(`📊 Frequency before deaf: ${freq} Hz`);
    expect(freq).toBeGreaterThan(100);
    
    // Enable self-deaf
    console.log('🔇 Enabling self-deaf...');
    await page.evaluate(() => {
      window.ui?.user?.setSelfDeaf(true);
    });
    await page.waitForTimeout(200);
    
    // Verify frequency display clears when deaf
    freq = await page.evaluate(() => window.ui?.voice?.loopbackDominantFrequency() || 0);
    console.log(`📊 Frequency while deaf: ${freq} Hz`);
    expect(freq).toBe(0);
    console.log('✅ Frequency cleared when deaf');
    
    // Disable self-deaf
    console.log('🔊 Disabling self-deaf...');
    await page.evaluate(() => {
      window.ui?.user?.setSelfDeaf(false);
    });
    await page.waitForTimeout(500);
    
    // Verify frequency reappears
    freq = await page.evaluate(() => window.ui?.voice?.loopbackDominantFrequency() || 0);
    console.log(`📊 Frequency after deaf disabled: ${freq} Hz`);
    expect(freq).toBeGreaterThan(100);
    console.log('✅ Frequency reappeared after deaf disabled');
    
    // Cleanup
    await pianoButton.dispatchEvent('mouseup');
    
    console.log('\n✅ TEST PASSED: Mute/deaf handling test completed!\n');
  });
});
