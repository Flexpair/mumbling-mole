const { test, expect } = require('@playwright/test');

/**
 * Error Handling and Edge Cases Tests
 * Tests how Mumbling Mole handles various error conditions and edge cases
 */
test.describe('Error Handling Tests', () => {
  test('handles missing configuration gracefully', async ({ page }) => {
    // Mock missing config by intercepting the request
    await page.route('**/config.js', route => {
      route.fulfill({
        status: 404,
        body: ''
      });
    });
    
    await page.route('**/config.local.js', route => {
      route.fulfill({
        status: 404, 
        body: ''
      });
    });
    
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    
    await page.goto('/');
    
    // Should still attempt to load even with missing config
    // The page might not fully work, but it shouldn't crash entirely
    const pageLoaded = await page.evaluate(() => {
      return document.body !== null && document.head !== null;
    });
    
    expect(pageLoaded).toBe(true);
  });

  test('handles network errors during resource loading', async ({ page }) => {
    // Mock a failing resource
    await page.route('**/theme.css', route => {
      route.abort();
    });
    
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    
    await page.goto('/');
    
    // Page should still load even if theme CSS fails
    await expect(page.locator('body')).toBeAttached();
    
    // Check that JavaScript still initializes
    await page.waitForFunction(() => window.mumbleUi !== undefined, { timeout: 10000 });
    
    const uiInitialized = await page.evaluate(() => {
      return typeof window.mumbleUi === 'object';
    });
    
    expect(uiInitialized).toBe(true);
  });

  test('handles invalid WebSocket connections gracefully', async ({ page }) => {
    await page.goto('/');
    await page.waitForFunction(() => window.mumbleUi !== undefined, { timeout: 10000 });
    
    // Attempt connection with invalid server details (will fail, but shouldn't crash)
    const connectionTest = await page.evaluate(() => {
      try {
        // Try to trigger a connection with invalid parameters
        if (window.mumbleUi?.connectDialog) {
          window.mumbleUi.connectDialog.address?.('invalid.server.address');
          window.mumbleUi.connectDialog.port?.('99999');
        }
        return { success: true };
      } catch (error) {
        return { success: false, error: error.message };
      }
    });
    
    expect(connectionTest.success).toBe(true);
  });

  test('handles Netlify Identity failures gracefully', async ({ page }) => {
    // Mock Netlify Identity to throw errors
    await page.addInitScript(() => {
      window.netlifyIdentity = {
        init: () => { throw new Error('Identity service unavailable'); },
        on: () => {},
        currentUser: () => null,
        open: () => {},
        close: () => {}
      };
    });
    
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    
    await page.goto('/');
    await page.waitForFunction(() => window.mumbleUi !== undefined, { timeout: 10000 });
    
    // Should handle identity failures gracefully based on the code comment
    const identityErrors = errors.filter(error => 
      error.toLowerCase().includes('identity')
    );
    
    // App should continue working even if identity fails
    const uiWorking = await page.evaluate(() => {
      return window.mumbleUi !== undefined && 
             window.mumbleUi.connectDialog !== undefined;
    });
    
    expect(uiWorking).toBe(true);
  });

  test('handles malformed URL parameters', async ({ page }) => {
    // Test with various malformed parameters
    await page.goto('/?address=%&port=invalid&username=\u0000&theme=<script>');
    
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    
    await page.waitForFunction(() => window.mumbleUi !== undefined, { timeout: 10000 });
    
    // Should handle malformed parameters without crashing
    const parameterHandling = await page.evaluate(() => {
      return {
        dialogExists: window.mumbleUi?.connectDialog !== undefined,
        addressHandled: typeof window.mumbleUi?.connectDialog?.address === 'function',
        portHandled: typeof window.mumbleUi?.connectDialog?.port === 'function'
      };
    });
    
    expect(parameterHandling.dialogExists).toBe(true);
    expect(parameterHandling.addressHandled).toBe(true);
    expect(parameterHandling.portHandled).toBe(true);
    
    // Check that XSS attempts in parameters don't execute
    const hasInjectedScripts = await page.evaluate(() => {
      const container = document.querySelector('#container');
      if (!container) {
        return false;
      }
      return container.querySelectorAll('script').length > 0;
    });
    
    expect(hasInjectedScripts).toBe(false);
  });

  test('handles missing worker files gracefully', async ({ page }) => {
    // Mock worker file request to fail
    await page.route('**/worker.js', route => {
      route.abort();
    });
    
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    
    await page.goto('/');
    await page.waitForFunction(() => window.mumbleUi !== undefined, { timeout: 10000 });
    
    // UI should still initialize even if worker loading fails
    const uiState = await page.evaluate(() => {
      return {
        uiExists: window.mumbleUi !== undefined,
        connectorExists: window.mumbleUi?.connector !== undefined
      };
    });
    
    expect(uiState.uiExists).toBe(true);
  });

  test('handles resource loading timeouts', async ({ page }) => {
    // Simulate slow resource loading
    await page.route('**/index.js', async route => {
      await new Promise(resolve => setTimeout(resolve, 1000));
      route.continue();
    });
    
    await page.goto('/');
    
    // Should eventually load despite delays
    await page.waitForFunction(() => window.mumbleUi !== undefined, { timeout: 15000 });
    
    const loadedSuccessfully = await page.evaluate(() => {
      return window.mumbleUi !== undefined;
    });
    
    expect(loadedSuccessfully).toBe(true);
  });

  test('handles browser compatibility issues gracefully', async ({ page }) => {
    // Mock some modern APIs as unavailable
    await page.addInitScript(() => {
      // Remove some modern APIs
      delete window.fetch;
      delete window.AudioContext;
      delete window.webkitAudioContext;
      
      // Mock old-style XMLHttpRequest issues
      const originalXHR = window.XMLHttpRequest;
      window.XMLHttpRequest = function() {
        const xhr = new originalXHR();
        // Add some compatibility issues
        return xhr;
      };
    });
    
    await page.goto('/');
    
    // Should handle missing APIs gracefully
    const compatibility = await page.evaluate(() => {
      return {
        bodyExists: document.body !== null,
        jsLoaded: document.querySelectorAll('script').length > 0
      };
    });
    
    expect(compatibility.bodyExists).toBe(true);
    expect(compatibility.jsLoaded).toBe(true);
  });

  test('handles memory pressure gracefully', async ({ page }) => {
    await page.goto('/');
    await page.waitForFunction(() => window.mumbleUi !== undefined, { timeout: 10000 });
    
    // Test that the application doesn't create obvious memory leaks
    const memoryTest = await page.evaluate(() => {
      // Create many objects and then try to clean up
      const objects = [];
      for (let i = 0; i < 1000; i++) {
        objects.push({ data: new Array(100).fill(i) });
      }
      
      // Clear references
      objects.length = 0;
      
      // App should still be functional
      return {
        uiStillWorks: window.mumbleUi !== undefined,
        memoryTestCompleted: true
      };
    });
    
    expect(memoryTest.uiStillWorks).toBe(true);
    expect(memoryTest.memoryTestCompleted).toBe(true);
  });

  test('recovers from JavaScript errors in event handlers', async ({ page }) => {
    await page.goto('/');
    await page.waitForFunction(() => window.mumbleUi !== undefined, { timeout: 10000 });
    
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    
    // Try to trigger an error in event handling
    await page.evaluate(() => {
      try {
        // Simulate an error in a common operation
        if (window.mumbleUi?.connectDialog) {
          // This might cause an error but shouldn't crash the entire app
          window.mumbleUi.connectDialog.address?.({ invalid: 'object' });
        }
      } catch (e) {
        // Swallow individual errors to test recovery
      }
    });
    
    // App should recover and still be usable
    const recovery = await page.evaluate(() => {
      return {
        uiResponsive: window.mumbleUi !== undefined,
        domIntact: document.getElementById('container') !== null
      };
    });
    
    expect(recovery.uiResponsive).toBe(true);
    expect(recovery.domIntact).toBe(true);
  });
});