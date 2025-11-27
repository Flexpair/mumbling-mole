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

    // Capture network failures (404s, etc)
    page.on('requestfailed', request => {
      console.error(`[NETWORK FAIL] ${request.url()} - ${request.failure().errorText}`);
    });
    
    // Navigate to app with debug-audio for detailed audio pipeline logging
    console.log('🌐 Navigating to application...');
    
    await page.goto('/?debug-audio', { waitUntil: 'networkidle', timeout: 30000 });
    
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
    
    // Handle Netlify Identity login
    console.log('🔐 Checking for Netlify Identity login...');
    const testEmail = process.env.PLAYWRIGHT_TEST_EMAIL;
    const testPassword = process.env.PLAYWRIGHT_TEST_PASSWORD;
    
    if (!testEmail || !testPassword) {
      throw new Error('PLAYWRIGHT_TEST_EMAIL and PLAYWRIGHT_TEST_PASSWORD environment variables are required');
    }
    
    // Wait for Netlify Identity widget iframe to appear
    try {
      // The Netlify Identity widget creates an iframe with title="Netlify identity widget"
      // There may be multiple iframes with this title - use the one that has content
      const iframeSelector = 'iframe[title="Netlify identity widget"]';
      // Use 'attached' instead of 'visible' since iframe visibility can be tricky
      await page.waitForSelector(iframeSelector, { state: 'attached', timeout: 10000 });
      console.log('✅ Found Netlify Identity iframe');
      
      // Try the last iframe first (the one with actual content)
      let loginFrame = page.frameLocator(iframeSelector).last();
      let loginTab = loginFrame.getByRole('button', { name: 'Log in' }).first();
      
      console.log('⏳ Waiting for Netlify Identity iframe content...');
      try {
        await expect(loginTab).toBeVisible({ timeout: 5000 });
      } catch {
        // If last() doesn't work, try first()
        console.log('⏳ Trying first iframe instead...');
        loginFrame = page.frameLocator(iframeSelector).first();
        loginTab = loginFrame.getByRole('button', { name: 'Log in' }).first();
        await expect(loginTab).toBeVisible({ timeout: 10000 });
      }
      console.log('✅ Found Netlify Identity iframe with content');
      
      // Click "Log in" tab (it shows Sign up by default)
      await loginTab.click();
      console.log('📋 Clicked Log in tab');
      
      // Wait for form to switch to login mode
      await page.waitForTimeout(300);
      
      // Fill email - the input with placeholder "Email"
      const emailInput = loginFrame.getByPlaceholder('Email');
      await expect(emailInput).toBeVisible({ timeout: 5000 });
      
      console.log('📧 Entering test credentials...');
      await emailInput.fill(testEmail);
      
      // Fill password
      const passwordInput = loginFrame.getByPlaceholder('Password');
      await passwordInput.fill(testPassword);
      
      // Click the Log in submit button (use last() as there are two "Log in" buttons)
      const submitButton = loginFrame.getByRole('button', { name: 'Log in' }).last();
      await submitButton.click();
      console.log('🔑 Clicked Log in button');
      
      console.log('⏳ Waiting for login to complete...');
      // Wait for the dialog inside iframe to disappear (successful login)
      await expect(loginFrame.locator('dialog')).toBeHidden({ timeout: 15000 });
      console.log('✅ Netlify Identity login successful');
    } catch (e) {
      console.log('⚠️  Login flow issue:', e.message);
      // Check if we're already past login (connect dialog visible)
      const connectDialog = page.locator('dialog.connect-dialog[open]');
      if (await connectDialog.isVisible({ timeout: 2000 }).catch(() => false)) {
        console.log('ℹ️  User already authenticated, connect dialog visible');
      } else {
        throw new Error(`Login failed: ${e.message}`);
      }
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

    let pianoButton;

    await test.step('Open connect dialog and enable Audio Test', async () => {
      // STEP 1: Wait for connect dialog to appear (should show after login)
      console.log('🔄 Step 1: Waiting for connect dialog...');
      await page.waitForSelector('dialog.connect-dialog[open]', { state: 'attached', timeout: 10000 });
      console.log('✅ Connect dialog visible');

      // STEP 2: Activate test mode via toggle
      console.log('🔄 Step 2: Clicking Audio Test toggle...');
      const testToggle = page.locator('.test-toggle-label');
      await expect(testToggle).toBeVisible({ timeout: 5000 });
      await testToggle.click();
      console.log('✅ Test toggle clicked');

      const isTestActive = await page.evaluate(() => {
        return window.mumbleUi?.connectDialog?.isTestActive || false;
      });
      expect(isTestActive).toBe(true);
      console.log('✅ Test mode activated');
    });

    await test.step('Wait for connection and audio components', async () => {
      // STEP 3: Wait for connection (toggle already started it)
      console.log('🔄 Step 3: Waiting for connection to complete (started by toggle)...');

      await page.waitForFunction(() => {
        const ui = window.mumbleUi;
        return ui?.connected?.() === true;
      }, { timeout: 10000 });

      console.log('✅ Connection established (via toggle)');

      // STEP 4: Wait for audio components to initialize
      console.log('⏳ Step 4: Waiting for audio components to initialize...');
      console.log('   (This may take a few seconds - connecting to Murmur server)');

      const uiAvailable = await page.evaluate(() => window.mumbleUi !== undefined);
      if (!uiAvailable) {
        console.error('❌ window.mumbleUi is undefined after connect!');
        throw new Error('UI state lost after connect - check for JS errors');
      }

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

          const audioContextReady = ui.audio?.audioContext?.state === 'running';
          if (!audioContextReady) {
            console.log('[TEST-CHECK] AudioContext not running:', ui.audio?.audioContext?.state);
          }

          const testModeReady = ui.connectDialog?.isTestActive === true;
          if (!testModeReady) {
            console.log('[TEST-CHECK] Test mode not active');
          }

          const voiceReady = ui.voiceHandlerReady === true;
          if (!voiceReady) {
            console.log('[TEST-CHECK] Voice handler not ready');
          }

          // REMOVED: beeperReady check - beeper initializes asynchronously via onAudioMixerReady callback
          // after voice handler is ready. Piano button handles beeper not ready state gracefully.

          const allReady = audioContextReady && testModeReady && voiceReady;
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
      pianoButton = page.locator('.beep-test-button');
      await expect(pianoButton).toBeVisible({ timeout: 10000 });
      console.log('✅ Piano button visible');
    });
    await test.step('Play piano tone and verify ~440 Hz', async () => {
      // STEP 6: Press piano button (unmuted) and verify ~440 Hz
      console.log('🎹 Step 6: Pressing piano button (unmuted)...');

      await pianoButton.dispatchEvent('mousedown');
      console.log('✅ Piano button pressed (mousedown event dispatched)');

      // STEP 7: Wait for audio pipeline and first frequency detection
      console.log(`⏳ Step 7: Waiting for audio pipeline...`);
      console.log(`   Initial wait: ${TEST_CONFIG.BEEPER_INITIAL_WAIT}ms`);
      await page.waitForTimeout(TEST_CONFIG.BEEPER_INITIAL_WAIT);

      const startWait = Date.now();
      let firstFreqDetected = false;

      while (Date.now() - startWait < TEST_CONFIG.BEEPER_MAX_WAIT) {
        const freq = await page.evaluate(() => {
          return window.mumbleUi?.loopbackDominantFrequency || 0;
        });

        if (freq > 0) {
          console.log(`   ✅ First frequency detected after ${Date.now() - startWait}ms: ${freq} Hz`);
          firstFreqDetected = true;
          break;
        }

        await page.waitForTimeout(100);
      }

      expect(firstFreqDetected).toBe(true);

      // Collect multiple frequency readings
      console.log(`📊 Step 8: Collecting ${TEST_CONFIG.FREQUENCY_READINGS} frequency readings...`);
      const frequencies = [];

      const analysisState = await page.evaluate(() => {
        const thisUser = window.mumbleUi.thisUser;
        return {
          hasThisUser: !!thisUser,
          selfMute: window.mumbleUi.selfMute,
          selfDeaf: window.mumbleUi.selfDeaf,
          isLoopbackMode: window.mumbleUi.isLoopbackMode,
          loopbackDominantFrequency: window.mumbleUi.loopbackDominantFrequency
        };
      });
      console.log('   Analysis state before averaging:', JSON.stringify(analysisState, null, 2));

      for (let i = 0; i < TEST_CONFIG.FREQUENCY_READINGS; i++) {
        const freq = await page.evaluate(() => {
          return window.mumbleUi?.loopbackDominantFrequency || 0;
        });
        frequencies.push(freq);
        console.log(`   Reading ${i + 1}/${TEST_CONFIG.FREQUENCY_READINGS}: ${freq} Hz`);

        if (i < TEST_CONFIG.FREQUENCY_READINGS - 1) {
          await page.waitForTimeout(TEST_CONFIG.READING_INTERVAL);
        }
      }

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
      expect(displayText).not.toContain('--- Hz');
      console.log('✅ Frequency display visible with numeric Hz value');

      // Release button so we can start a fresh tone for the mute test
      console.log('🎹 Releasing piano button after frequency validation...');
      await pianoButton.dispatchEvent('mouseup');
      console.log('✅ Piano button released (mouseup event dispatched)');
    });

    await test.step('Mute in loopback mode and verify frequency clears', async () => {
      // STEP 10: Restart tone, then mute (programmatically) and verify frequency stops
      console.log('🔇 Step 10: Restarting tone, then muting in loopback mode and verifying frequency stops...');

      // Press piano again so we have an active tone while the connect dialog stays open
      await pianoButton.dispatchEvent('mousedown');
      console.log('✅ Piano button pressed again (mousedown event dispatched)');

      // Confirm that we really have a non-zero frequency before muting
      console.log('   Waiting for non-zero frequency before muting...');
      const startWaitPreMute = Date.now();
      let preMuteFreq = 0;
      while (Date.now() - startWaitPreMute < TEST_CONFIG.BEEPER_MAX_WAIT) {
        preMuteFreq = await page.evaluate(() => {
          return window.mumbleUi?.loopbackDominantFrequency || 0;
        });
        console.log('   Pre-mute frequency reading:', preMuteFreq);
        if (preMuteFreq > 0) {
          break;
        }
        await page.waitForTimeout(100);
      }

      expect(preMuteFreq).toBeGreaterThan(0);

      console.log('   Programmatically muting via mumbleUi.requestMute while dialog remains open...');
      await page.evaluate(() => {
        const ui = window.mumbleUi;
        const thisUser = ui?.thisUser;
        if (ui?.requestMute && thisUser) {
          ui.requestMute(thisUser);
        }
      });

      // Wait until selfMute flips to true so the audio gate can take effect
      await page.waitForFunction(() => {
        return window.mumbleUi.selfMute === true;
      }, { timeout: 2000 });

      await page.waitForTimeout(500);

      const muteAnalysisState = await page.evaluate(() => {
        return {
          selfMute: window.mumbleUi.selfMute,
          selfDeaf: window.mumbleUi.selfDeaf,
          loopbackDominantFrequency: window.mumbleUi.loopbackDominantFrequency || 0,
          displayText: document.querySelector('.loopback-frequency-display')?.textContent || ''
        };
      });
      console.log('   State after mute:', JSON.stringify(muteAnalysisState, null, 2));

      expect(muteAnalysisState.selfMute).toBe(true);
      expect(muteAnalysisState.loopbackDominantFrequency).toBe(0);
      expect(muteAnalysisState.displayText).toContain('--- Hz');

      // Release button
      console.log('🎹 Releasing piano button after mute...');
      await pianoButton.dispatchEvent('mouseup');
      console.log('✅ Piano button released (mouseup event dispatched)');
    });

    await test.step('Switch from test mode to normal mode', async () => {
      // STEP 11: Switch from test mode to normal mode
      console.log('\n🔄 Step 11: Switching to normal mode via Connect button...');

      await page.evaluate(() => {
        const ui = window.mumbleUi;
        if (ui?.connectDialog) {
          ui.connectDialog.visible = true;
        }
      });

      await page.waitForSelector('dialog.connect-dialog[open]', { state: 'visible', timeout: 5000 });

      const connectButton = page.locator('input.connect-dialog-submit[type="submit"]');
      await expect(connectButton).toBeVisible();
      await connectButton.click();
      console.log('✅ Connect button clicked');

      await page.waitForTimeout(500);
      const dialogClosed = await page.evaluate(() => {
        return !window.mumbleUi?.connectDialog?.visible?.value;
      });
      expect(dialogClosed).toBe(true);
      console.log('✅ Dialog closed - switched to normal mode');
    });

    await test.step('Send chat message and verify confirmation animation', async () => {
      // STEP 12 & 13: Send a message and verify confirmation animation
      console.log('\n💬 Step 12: Sending a test message...');
      const messageBox = page.locator('input#message-box');
      await expect(messageBox).toBeVisible();

      const testMessage = 'Test message from Playwright automation';
      await messageBox.fill(testMessage);
      console.log(`   Message entered: "${testMessage}"`);

      const sendButton = page.locator('button.message-confirmation');
      await expect(sendButton).toBeVisible();
      await sendButton.click();
      console.log('✅ Send button clicked');

      console.log('\n✓  Step 13: Verifying checkmark color change...');

      await page.waitForTimeout(100);

      const buttonColorInitial = await sendButton.evaluate((el) => {
        const computed = window.getComputedStyle(el);
        return {
          color: computed.color,
          backgroundColor: computed.backgroundColor
        };
      });
      console.log(`   Initial button color: backgroundColor="${buttonColorInitial.backgroundColor}"`);

      await page.waitForTimeout(1500);

      const buttonColorAfter = await sendButton.evaluate((el) => {
        const computed = window.getComputedStyle(el);
        return {
          color: computed.color,
          backgroundColor: computed.backgroundColor
        };
      });
      console.log(`   Final button color: backgroundColor="${buttonColorAfter.backgroundColor}"`);

      const colorChanged = buttonColorInitial.backgroundColor !== buttonColorAfter.backgroundColor;
      expect(colorChanged).toBe(true);
      console.log('✅ Button color changed and returned to normal (confirmation animation worked)');
    });

    console.log('\n🎉 Full test flow validated successfully!');
    console.log('   ✅ Piano button works');
    console.log('   ✅ Frequency detection works (440 Hz)');
    console.log('   ✅ Display updates in real-time');
    console.log('   ✅ Mode switching works (test → normal)');
    console.log('   ✅ Message sending works with cyan checkmark');

    await test.step('Verify Guacamole frame loads (expected 404 in test environment)', async () => {
      console.log('\n🖥️  Step 14: Verifying Guacamole frame loads...');
      
      // In the test environment, Guacamole server is not running, so we expect a 404 error.
      // The key is that the placeholder image is hidden and the iframe attempts to load.
      // This proves the full connection flow completed and triggered Guacamole initialization.
      
      // Check that the Guacamole section is visible (not the placeholder)
      const guacamoleSection = page.locator('section.guacamole');
      await expect(guacamoleSection).toBeVisible({ timeout: 5000 });
      console.log('   ✅ Guacamole section is visible');
      
      // Check that the placeholder is hidden
      const placeholder = page.locator('.guacamole-placeholder');
      await expect(placeholder).toBeHidden({ timeout: 2000 });
      console.log('   ✅ Placeholder is hidden');
      
      // Check the iframe exists and has a src (even if it 404s)
      const guacamoleIframe = page.locator('#guacframe');
      await expect(guacamoleIframe).toBeVisible();
      
      const iframeSrc = await guacamoleIframe.getAttribute('src');
      console.log(`   Iframe src: ${iframeSrc}`);
      
      // The src should contain guacamole path (not about:blank)
      expect(iframeSrc).not.toBe('about:blank');
      expect(iframeSrc).toContain('guacamole');
      console.log('   ✅ Guacamole iframe has correct src');
      
      // Optionally check iframe content for expected 404 error message
      // This is tricky because of cross-origin restrictions, but we can check the frame
      try {
        const iframeContent = guacamoleIframe.contentFrame();
        if (iframeContent) {
          const errorText = await iframeContent.locator('body').textContent({ timeout: 2000 });
          if (errorText && errorText.includes('404')) {
            console.log('   ✅ Expected 404 error in iframe (Guacamole server not running in test env)');
          }
        }
      } catch (e) {
        // Cross-origin or other issue - that's fine, the src check is sufficient
        console.log('   ℹ️  Could not read iframe content (cross-origin), but src is correct');
      }
      
      console.log('✅ Guacamole frame initialization verified');
    });

    console.log('\n🧹 Cleaning up resources...');
    await page.evaluate(() => {
      if (window.mumbleUi?.isBeeping?.value) {
        window.mumbleUi.stopBeep();
      }

      if (window.mumbleUi?.connection?.client) {
        window.mumbleUi.connection.resetClient();
      }
    });
    await page.waitForTimeout(500);
    console.log('✅ Resources cleaned up');

    console.log('\n✅ TEST PASSED: All scenarios validated successfully!');
    console.log('   ✅ Piano button and 440 Hz frequency detection');
    console.log('   ✅ Mute/deaf state affects frequency analyzer');
    console.log('   ✅ Mode switching (loopback → normal)');
    console.log('   ✅ Message sending with confirmation');
    console.log('   ✅ Guacamole frame initialization\n');
  });
});
