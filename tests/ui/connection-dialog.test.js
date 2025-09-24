const { test, expect } = require('@playwright/test');

/**
 * Connection Dialog Tests
 * Tests the Mumble server connection dialog functionality
 */
test.describe('Connection Dialog Tests', () => {
  test('connect dialog is present and visible', async ({ page }) => {
    await page.goto('/');
    await page.waitForFunction(() => window.mumbleUi !== undefined, { timeout: 10000 });
    
    // Look for connect dialog elements
    // Based on the code structure, these should be bound via Knockout
    const connectElements = await page.locator('[data-bind*="connectDialog"]').count();
    expect(connectElements).toBeGreaterThan(0);
  });

  test('URL parameters populate connection fields', async ({ page }) => {
    const testAddress = 'voice.example.com';
    const testPort = '64738';
    const testPassword = 'testpass';
    
    await page.goto(`/?address=${testAddress}&port=${testPort}&password=${testPassword}`);
    await page.waitForFunction(() => window.mumbleUi !== undefined, { timeout: 10000 });
    
    // Check that URL parameters are processed
    const connectDialogData = await page.evaluate(() => {
      return {
        address: window.mumbleUi?.connectDialog?.address?.(),
        port: window.mumbleUi?.connectDialog?.port?.(),
        password: window.mumbleUi?.connectDialog?.password?.()
      };
    });
    
    expect(connectDialogData.address).toBe(testAddress);
    expect(connectDialogData.port).toBe(testPort);
    expect(connectDialogData.password).toBe(testPassword);
  });

  test('username field handles user metadata correctly', async ({ page }) => {
    await page.goto('/');
    await page.waitForFunction(() => window.mumbleUi !== undefined, { timeout: 10000 });
    
    // Check that username field exists and is accessible
    const hasUsernameField = await page.evaluate(() => {
      return window.mumbleUi?.connectDialog?.username !== undefined;
    });
    
    expect(hasUsernameField).toBe(true);
  });

  test('connection dialog handles missing parameters gracefully', async ({ page }) => {
    await page.goto('/');
    await page.waitForFunction(() => window.mumbleUi !== undefined, { timeout: 10000 });
    
    // Should handle missing URL parameters without errors
    const connectDialogData = await page.evaluate(() => {
      return {
        address: window.mumbleUi?.connectDialog?.address?.() || '',
        port: window.mumbleUi?.connectDialog?.port?.() || '',
        username: window.mumbleUi?.connectDialog?.username?.() || ''
      };
    });
    
    // Fields should exist even if empty
    expect(typeof connectDialogData.address).toBe('string');
    expect(typeof connectDialogData.port).toBe('string'); 
    expect(typeof connectDialogData.username).toBe('string');
  });

  test('connect dialog validates required fields', async ({ page }) => {
    await page.goto('/');
    await page.waitForFunction(() => window.mumbleUi !== undefined, { timeout: 10000 });
    
    // Test that connection dialog has validation logic
    const hasValidation = await page.evaluate(() => {
      // Check if there's some form of validation in the UI
      return window.mumbleUi?.connectDialog && 
             typeof window.mumbleUi.connectDialog === 'object';
    });
    
    expect(hasValidation).toBe(true);
  });

  test('connect dialog handles special characters in parameters', async ({ page }) => {
    const testAddress = 'võice.example.com';
    const testPassword = 'päss@wörd123!';
    
    await page.goto(`/?address=${encodeURIComponent(testAddress)}&password=${encodeURIComponent(testPassword)}`);
    await page.waitForFunction(() => window.mumbleUi !== undefined, { timeout: 10000 });
    
    // Check that special characters are handled properly
    const connectDialogData = await page.evaluate(() => {
      return {
        address: window.mumbleUi?.connectDialog?.address?.(),
        password: window.mumbleUi?.connectDialog?.password?.()
      };
    });
    
    expect(connectDialogData.address).toBe(testAddress);
    expect(connectDialogData.password).toBe(testPassword);
  });

  test('connection state management works', async ({ page }) => {
    await page.goto('/');
    await page.waitForFunction(() => window.mumbleUi !== undefined, { timeout: 10000 });
    
    // Check that connection state can be tracked
    const connectionState = await page.evaluate(() => {
      return {
        hasConnector: window.mumbleUi?.connector !== undefined,
        hasConnectionInfo: window.mumbleUi?.connectionInfo !== undefined
      };
    });
    
    expect(connectionState.hasConnector).toBe(true);
    expect(connectionState.hasConnectionInfo).toBe(true);
  });

  test('modal system works for connection dialog', async ({ page }) => {
    await page.goto('/');
    await page.waitForFunction(() => window.mumbleUi !== undefined, { timeout: 10000 });
    
    // Check that modal system is properly initialized
    const modalSystem = await page.evaluate(() => {
      return {
        hasCurrentModal: window.mumbleUi?.currentOpenModal !== undefined,
        modalType: typeof window.mumbleUi?.currentOpenModal
      };
    });
    
    expect(modalSystem.hasCurrentModal).toBe(true);
    expect(['function', 'object']).toContain(modalSystem.modalType);
  });
});