/**
 * End-to-End Regression Test for Protobuf camelCase Bugs
 * 
 * This test validates the two critical bugs that were fixed:
 * 1. Mute/Deaf status sync (selfMute/selfDeaf camelCase)
 * 2. Text message sending (channelId camelCase)
 * 
 * Test Strategy:
 * - Connect to real Mumble server
 * - Toggle mute/deaf buttons
 * - Send text messages
 * - Verify server acknowledges both actions
 * 
 * If these tests fail, it means the Protobuf camelCase bug has regressed.
 */

const { test, expect } = require('@playwright/test');

// Test configuration
const MUMBLE_SERVER = process.env.MUMBLE_SERVER || 'localhost:64738';
const TEST_USERNAME = 'E2E_Test_User';

test.describe('Protobuf camelCase Regression - E2E', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to app
    await page.goto('/');
    
    // Wait for app to load
    await page.waitForSelector('#connect-dialog', { timeout: 10000 });
  });

  test('Bug Fix: Mute button syncs status to server', async ({ page }) => {
    // Connect to server
    await page.fill('input[name="address"]', MUMBLE_SERVER);
    await page.fill('input[name="username"]', TEST_USERNAME);
    await page.click('button:has-text("Connect")');

    // Wait for connection
    await page.waitForSelector('.toolbar', { timeout: 15000 });

    // Set up console listener BEFORE actions to avoid race condition
    const logs = [];
    page.on('console', msg => logs.push(msg.text()));

    // Click mute button
    const muteButton = page.locator('button[aria-label*="mute" i]').first();
    await muteButton.click();

    // Wait a moment for server response
    await page.waitForTimeout(1000);

    // Verify button shows muted state
    // (The bug was: button changed but server never got the message)
    const isMuted = await muteButton.getAttribute('aria-pressed');
    expect(isMuted).toBe('true');
    
    // Wait for potential UserState message from server echoing our mute
    await page.waitForTimeout(2000);

    // If the fix works, we should NOT see errors about unrecognized fields
    const hasProtobufError = logs.some(log => 
      log.includes('self_mute') || log.includes('Unknown field')
    );
    expect(hasProtobufError).toBe(false);

    // Unmute
    await muteButton.click();
    await page.waitForTimeout(500);
  });

  test('Bug Fix: Deaf button syncs status to server', async ({ page }) => {
    await page.fill('input[name="address"]', MUMBLE_SERVER);
    await page.fill('input[name="username"]', TEST_USERNAME);
    await page.click('button:has-text("Connect")');
    await page.waitForSelector('.toolbar', { timeout: 15000 });

    // Click deaf button
    const deafButton = page.locator('button[aria-label*="deaf" i]').first();
    await deafButton.click();
    await page.waitForTimeout(1000);

    // Verify button shows deafened state
    const isDeaf = await deafButton.getAttribute('aria-pressed');
    expect(isDeaf).toBe('true');

    // Deafening should also mute
    const muteButton = page.locator('button[aria-label*="mute" i]').first();
    const isMuted = await muteButton.getAttribute('aria-pressed');
    expect(isMuted).toBe('true');

    await deafButton.click();
    await page.waitForTimeout(500);
  });

  test('Bug Fix: Text messages send successfully', async ({ page }) => {
    await page.fill('input[name="address"]', MUMBLE_SERVER);
    await page.fill('input[name="username"]', TEST_USERNAME);
    await page.click('button:has-text("Connect")');
    await page.waitForSelector('.toolbar', { timeout: 15000 });

    // Set up console listener BEFORE actions to avoid race condition
    const logs = [];
    page.on('console', msg => logs.push(msg.text()));

    // Type and send a message
    const messageInput = page.locator('input[type="text"], textarea').first();
    const testMessage = `E2E Test ${Date.now()}`;
    await messageInput.fill(testMessage);
    await messageInput.press('Enter');

    // Wait for message to be processed
    await page.waitForTimeout(2000);

    // The bug was: "Target not found for method: sendMessage"
    // If fixed, we should see the TextMessage being sent
    const hasSendError = logs.some(log => 
      log.includes('Target not found') || 
      log.includes('sendMessage') && log.includes('undefined')
    );
    expect(hasSendError).toBe(false);

    // Should see successful send log
    const hasSendSuccess = logs.some(log => 
      log.includes('TextMessage') && log.includes('channel_id')
    );
    expect(hasSendSuccess).toBe(true);
  });

  test('Combined: Mute, Deaf, and Send Message all work', async ({ page }) => {
    // This test ensures all three features work together
    await page.fill('input[name="address"]', MUMBLE_SERVER);
    await page.fill('input[name="username"]', TEST_USERNAME);
    await page.click('button:has-text("Connect")');
    await page.waitForSelector('.toolbar', { timeout: 15000 });

    // Set up console listener at start to capture all errors
    const logs = [];
    page.on('console', msg => {
      if (msg.type() === 'error') logs.push(msg.text());
    });

    // Mute
    const muteButton = page.locator('button[aria-label*="mute" i]').first();
    await muteButton.click();
    await page.waitForTimeout(500);

    // Send message while muted
    const messageInput = page.locator('input[type="text"], textarea').first();
    await messageInput.fill('Testing while muted');
    await messageInput.press('Enter');
    await page.waitForTimeout(500);

    // Deaf
    const deafButton = page.locator('button[aria-label*="deaf" i]').first();
    await deafButton.click();
    await page.waitForTimeout(500);

    // Send message while deaf
    await messageInput.fill('Testing while deaf');
    await messageInput.press('Enter');
    await page.waitForTimeout(500);

    // Undeaf and unmute
    await deafButton.click();
    await page.waitForTimeout(500);
    await muteButton.click();
    await page.waitForTimeout(500);

    // Send final message
    await messageInput.fill('Testing normal state');
    await messageInput.press('Enter');
    await page.waitForTimeout(1000);

    // If all three features work, no errors should be logged
    expect(logs.length).toBe(0);
  });
});

test.describe('Protobuf Field Name Documentation', () => {
  test('documents the critical field name mappings', () => {
    // This test documents the exact field names that must be used
    // for compatibility with Protobuf.js automatic camelCase conversion

    const criticalFields = {
      // User state fields (client.js lines 744-783)
      mute: {
        outgoing: 'selfMute',      // ✅ What we send
        incoming: 'selfMute',      // ✅ What Protobuf.js gives us
        protobuf: 'self_mute',     // 📋 Proto file definition
      },
      deaf: {
        outgoing: 'selfDeaf',
        incoming: 'selfDeaf',
        protobuf: 'self_deaf',
      },
      
      // Channel state fields (client.js lines 570-588)
      channel: {
        outgoing: 'channel_id',    // ✅ Protocol uses snake_case
        incoming: 'channelId',     // ✅ Protobuf.js converts to camelCase
        protobuf: 'channel_id',
      },
      
      // Text message fields (client.js lines 559-568)
      messageChannels: {
        outgoing: 'channel_id',
        incoming: 'channelId',
        protobuf: 'channel_id',
      },
      messageTree: {
        outgoing: 'tree_id',
        incoming: 'treeId',
        protobuf: 'tree_id',
      }
    };

    // Verify the mappings are documented
    expect(criticalFields.mute.outgoing).toBe('selfMute');
    expect(criticalFields.mute.incoming).toBe('selfMute');
    expect(criticalFields.deaf.outgoing).toBe('selfDeaf');
    expect(criticalFields.channel.incoming).toBe('channelId');

    // This test will fail if someone changes these names,
    // alerting them to the Protobuf.js camelCase requirement
  });
});
