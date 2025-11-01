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
  BEEPER_INITIAL_WAIT: 1000, // 1s initial wait for audio to start
  BEEPER_MAX_WAIT: 5000, // 5s max wait for first frequency detection
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
    
    // Navigate to app with mock-auth parameter to bypass Netlify Identity
    // Also enable debug-audio for detailed audio pipeline logging during tests
    console.log('🌐 Navigating to application...');
    
    await page.goto('/?mock-auth&debug-audio', { waitUntil: 'networkidle', timeout: 30000 });
    
    // Handle GitHub Codespaces "Continue" button if present
    console.log('🔍 Checking for GitHub Codespaces interstitial page...');
    try {
      const continueButton = page.locator('button:has-text("Continue"), a:has-text("Continue")');
      await expect(continueButton).toBeVisible({ timeout: 2000 });
      console.log('✅ Found Codespaces Continue button, clicking...');
      await continueButton.click();
      await page.waitForLoadState('networkidle', { timeout: 10000 });
      console.log('✅ Passed Codespaces interstitial');
    } catch (e) {
      console.log('ℹ️  No Codespaces interstitial page');
    }
    
    // Note: When running without mock-auth, Netlify Identity login is handled manually
    // or by being already logged in. MockAuth bypasses this entirely in automated tests.
    console.log('ℹ️  Netlify Identity login (if required) should be handled manually or via existing session');
    
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
    
    // STEP 3: Click Connect button if still visible (not auto-connected)
    console.log('🔄 Step 3: Checking if Connect button needs to be clicked...');
    const connectButton = page.locator('input.connect-dialog-submit[type="submit"]');
    
    // Check if button is still visible (not auto-connected via MockAuth)
    const isConnectButtonVisible = await connectButton.isVisible().catch(() => false);
    
    if (isConnectButtonVisible) {
      console.log('   Connect button found, clicking...');
      await connectButton.click();
      console.log('✅ Connect button clicked');
    } else {
      console.log('✅ Already connected (auto-connect active)');
    }
    
    // STEP 4: Wait for audio components to initialize
    console.log('⏳ Step 4: Waiting for audio components to initialize...');
    console.log('   (This may take a few seconds - connecting to Murmur server)');
    
    // Verify mumbleUi is still available after toggle
    const uiAvailable = await page.evaluate(() => window.mumbleUi !== undefined);
    if (!uiAvailable) {
      console.error('❌ window.mumbleUi is undefined after connect!');
      throw new Error('UI state lost after connect - check for JS errors');
    }
    
    // Resume AudioContext if suspended (required in headless browsers)
    const resumeResult = await page.evaluate(async () => {
      const ui = window.mumbleUi;
      if (!ui) {
        return { error: 'mumbleUi not found' };
      }
      
      if (!ui.audio?.audioContext) {
        return { error: 'audioContext not found', hasAudio: !!ui.audio };
      }
      
      const initialState = ui.audio.audioContext.state;
      console.log('[TEST] AudioContext initial state:', initialState);
      
      if (initialState === 'suspended') {
        console.log('[TEST] AudioContext is suspended, resuming...');
        try {
          await ui.audio.audioContext.resume();
          const newState = ui.audio.audioContext.state;
          console.log('[TEST] AudioContext resumed, new state:', newState);
          
          // Re-initialize beeper after AudioContext is running
          if (newState === 'running') {
            console.log('[TEST] Re-initializing persistent beeper...');
            await ui._initializePersistentBeeper();
            console.log('[TEST] Beeper re-initialized');
          }
          
          return { success: true, initialState, newState };
        } catch (err) {
          console.error('[TEST] Failed to resume AudioContext:', err);
          return { error: err.message, initialState };
        }
      }
      
      return { success: true, state: initialState, message: 'Already running' };
    });
    
    console.log('Resume result:', JSON.stringify(resumeResult, null, 2));
    
    if (resumeResult.error) {
      throw new Error(`AudioContext resume failed: ${resumeResult.error}`);
    }
    
    await page.waitForFunction(
      () => {
        const ui = window.mumbleUi;
        if (!ui) {
          console.error('[TEST-CHECK] window.mumbleUi is undefined!');
          return false;
        }
        
        // Check if audio context is ready
        const audioContextReady = ui.audio?.audioContext?.state === 'running';
        if (!audioContextReady) {
          console.log('[TEST-CHECK] AudioContext not running:', ui.audio?.audioContext?.state);
        }
        
        // Check if test mode components are ready
        const testModeReady = ui.connectDialog?.isTestActive() === true;
        if (!testModeReady) {
          console.log('[TEST-CHECK] Test mode not active');
        }
        
        // Check if beeper is ready (required for button visibility)
        const beeperReady = ui.beeperReady?.() === true;
        if (!beeperReady) {
          console.log('[TEST-CHECK] Beeper not ready');
        }
        
        // Check if voice handler is ready (required for button visibility)
        const voiceReady = ui.voiceHandlerReady?.() === true;
        if (!voiceReady) {
          console.log('[TEST-CHECK] Voice handler not ready');
        }
        
        const allReady = audioContextReady && testModeReady && beeperReady && voiceReady;
        if (allReady) {
          console.log('[TEST-CHECK] ✅ All components ready!');
        }
        
        return allReady;
      },
      { timeout: TEST_CONFIG.CONNECTION_TIMEOUT }
    );
    
    console.log('✅ Audio components ready');
    
    // STEP 5: Wait for piano button to appear
    console.log('🎹 Step 5: Waiting for piano button to appear...');
    const pianoButton = page.locator('.beep-test-button');
    await expect(pianoButton).toBeVisible({ timeout: 10000 });
    console.log('✅ Piano button visible');
    
    // STEP 6: Press piano button (simulate mousedown)
    console.log('🎹 Step 6: Pressing piano button...');
    
    // Check beeper state before clicking
    const beeperState = await page.evaluate(() => {
      const audio = window.mumbleUi.audio;
      return {
        isBeeping: audio.isBeeping(),
        hasPersistentBeeper: !!audio._persistentBeeper,
        beeperReady: window.mumbleUi.beeperReady(),
        isLoopbackMode: window.mumbleUi.voice.isLoopbackMode()
      };
    });
    console.log('   Beeper state before click:', JSON.stringify(beeperState, null, 2));
    
    await pianoButton.dispatchEvent('mousedown');
    console.log('✅ Piano button pressed (mousedown event dispatched)');
    
    // Check beeper state after clicking
    await page.waitForTimeout(200);
    const beeperStateAfter = await page.evaluate(() => {
      const audio = window.mumbleUi.audio;
      return {
        isBeeping: audio.isBeeping(),
        hasPersistentBeeper: !!audio._persistentBeeper,
        beeperIsPlaying: audio._persistentBeeper?.isPlaying
      };
    });
    console.log('   Beeper state after click:', JSON.stringify(beeperStateAfter, null, 2));
    
    // STEP 7: Wait for audio to go through the full pipeline
    console.log(`⏳ Step 7: Waiting for audio pipeline (Beeper → Encoder → Server → Loopback → Decoder → Analyser)...`);
    console.log(`   Initial wait: ${TEST_CONFIG.BEEPER_INITIAL_WAIT}ms`);
    await page.waitForTimeout(TEST_CONFIG.BEEPER_INITIAL_WAIT);
    
    // Wait for first frequency detection (with timeout)
    console.log(`   Waiting for first frequency detection (max ${TEST_CONFIG.BEEPER_MAX_WAIT}ms)...`);
    const startWait = Date.now();
    let firstFreqDetected = false;
    
    while (Date.now() - startWait < TEST_CONFIG.BEEPER_MAX_WAIT) {
      const freq = await page.evaluate(() => {
        return window.mumbleUi?.voice?.loopbackDominantFrequency() || 0;
      });
      
      if (freq > 0) {
        console.log(`   ✅ First frequency detected after ${Date.now() - startWait}ms: ${freq} Hz`);
        firstFreqDetected = true;
        break;
      }
      
      await page.waitForTimeout(100);
    }
    
    if (!firstFreqDetected) {
      console.log(`   ⚠️  No frequency detected after ${TEST_CONFIG.BEEPER_MAX_WAIT}ms`);
    }
    
    // STEP 8: Collect multiple frequency readings
    console.log(`📊 Step 8: Collecting ${TEST_CONFIG.FREQUENCY_READINGS} frequency readings...`);
    const frequencies = [];
    
    // Check if frequency analysis is actually running
    const analysisState = await page.evaluate(() => {
      const thisUser = window.mumbleUi.user.thisUser();
      return {
        hasThisUser: !!thisUser,
        selfMute: window.mumbleUi.user.selfMute(),
        selfDeaf: window.mumbleUi.user.selfDeaf(),
        isLoopbackMode: window.mumbleUi.voice.isLoopbackMode(),
        loopbackDominantFrequency: window.mumbleUi.voice.loopbackDominantFrequency()
      };
    });
    console.log('   Analysis state:', JSON.stringify(analysisState, null, 2));
    
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
    
    // STEP 12: Test mute prevents frequency display
    console.log('\n🔇 Step 12: Testing MUTE prevents frequency display...');
    
    // Click mute button
    const muteButton = page.locator('.tb-mute[alt="Mute my microphone"]');
    await muteButton.click();
    await page.waitForTimeout(200);
    
    const muteState = await page.evaluate(() => window.mumbleUi?.user?.selfMute());
    console.log(`   Mute enabled: ${muteState}`);
    
    // Press button while muted
    await pianoButton.dispatchEvent('mousedown');
    await page.waitForTimeout(TEST_CONFIG.BEEPER_INITIAL_WAIT + 500);
    
    // Frequency should stay at 0
    let mutedFreq = await page.evaluate(() => window.mumbleUi?.voice?.loopbackDominantFrequency() || 0);
    console.log(`   Frequency while muted: ${mutedFreq} Hz`);
    expect(mutedFreq).toBe(0);
    console.log('✅ No frequency displayed when muted');
    
    // Release button and unmute
    await pianoButton.dispatchEvent('mouseup');
    await page.waitForTimeout(300);
    
    const unmuteButton = page.locator('.tb-unmute[alt="Unmute my microphone"]');
    await unmuteButton.click();
    await page.waitForTimeout(200);
    
    // STEP 13: Test deaf prevents frequency display
    console.log('\n🔇 Step 13: Testing DEAF prevents frequency display...');
    
    // Click deaf button
    const deafButton = page.locator('.tb-deaf[alt="Turn off sound"]');
    await deafButton.click();
    await page.waitForTimeout(200);
    
    const deafState = await page.evaluate(() => ({
      mute: window.mumbleUi?.user?.selfMute(),
      deaf: window.mumbleUi?.user?.selfDeaf()
    }));
    console.log(`   State: mute=${deafState.mute}, deaf=${deafState.deaf}`);
    
    // Press button while deafened
    await pianoButton.dispatchEvent('mousedown');
    await page.waitForTimeout(TEST_CONFIG.BEEPER_INITIAL_WAIT + 500);
    
    // Frequency should stay at 0
    let deafFreq = await page.evaluate(() => window.mumbleUi?.voice?.loopbackDominantFrequency() || 0);
    console.log(`   Frequency while deafened: ${deafFreq} Hz`);
    expect(deafFreq).toBe(0);
    console.log('✅ No frequency displayed when deafened');
    
    // STEP 14: Test undeafening restores frequency display
    console.log('\n🔊 Step 14: Testing UNDEAFEN restores frequency display...');
    
    // Click undeaf button (piano button still pressed)
    const undeafButton = page.locator('.tb-undeaf[alt="Turn sound back on"]');
    await undeafButton.click();
    console.log('   Undeaf button clicked');
    
    // Give audio system more time to stabilize after undeafening
    await page.waitForTimeout(TEST_CONFIG.BEEPER_INITIAL_WAIT);
    
    // Wait for frequency to appear
    await page.waitForFunction(
      () => (window.mumbleUi?.voice?.loopbackDominantFrequency() || 0) > 0,
      { timeout: TEST_CONFIG.BEEPER_MAX_WAIT }
    );
    
    let undeafFreq = await page.evaluate(() => window.mumbleUi?.voice?.loopbackDominantFrequency() || 0);
    console.log(`   Frequency after undeafen: ${undeafFreq} Hz`);
    expect(undeafFreq).toBeGreaterThan(100);
    console.log('✅ Frequency displayed again after undeafen');
    
    // Final cleanup
    await pianoButton.dispatchEvent('mouseup');
    
    // CLEANUP: Disconnect and clean up resources before test ends
    console.log('\n🧹 Cleaning up resources...');
    await page.evaluate(() => {
      // Stop beeper if still running
      if (window.mumbleUi?.audio?.isBeeping()) {
        window.mumbleUi.audio.stopBeep();
      }
      
      // Disconnect from server
      if (window.mumbleUi?.connection?.client) {
        window.mumbleUi.connection.resetClient();
      }
    });
    await page.waitForTimeout(500); // Give time for cleanup
    console.log('✅ Resources cleaned up');
    
    console.log('\n✅ TEST PASSED: All scenarios validated successfully!\n');
  });
});
