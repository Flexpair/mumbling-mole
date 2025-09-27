const { test, expect } = require('@playwright/test');

/**
 * Basic UI Smoke Tests
 * Tests the fundamental loading and rendering of the Mumbling Mole UI
 */
test.describe('UI Smoke Tests', () => {
  test('homepage loads correctly', async ({ page }) => {
    await page.goto('/');
    
    // Check that the page loads without error
    const titleMatchesHost = await page.evaluate(() => {
      return document.title === window.location.hostname;
    });
    expect(titleMatchesHost).toBe(true);
    
    // Check that main container is visible
    await expect(page.locator('#container')).toBeVisible();
    
    // Ensure the preloader has cleared so the UI is interactive
    await expect(page.locator('.preloader')).toHaveCount(0);
  });

  test('essential UI elements are present', async ({ page }) => {
    await page.goto('/');
    
    // Wait for the main container to be visible
    await expect(page.locator('#container')).toBeVisible();
    
    // Check for connect dialog elements
  await expect(page.locator('.connect-dialog.dialog').first()).toBeAttached();
    
    // Check that theme CSS is loaded
    const themeLink = page.locator('link[href="theme.css"]');
    await expect(themeLink).toBeAttached();
  });

  test('JavaScript bundles load without errors', async ({ page }) => {
    const errors = [];
    
    // Collect any JavaScript errors
    page.on('pageerror', (error) => {
      errors.push(error.message);
    });
    
    // Collect console errors
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        errors.push(`Console error: ${msg.text()}`);
      }
    });
    
    await page.goto('/');
    
    // Wait for the main script to load
    await page.waitForFunction(() => window.mumbleUi !== undefined, { timeout: 10000 });
    
    // Check that no critical errors occurred
    const criticalErrors = errors.filter((error) => {
      if (error.includes('[identity] initialization failed')) return false;
      if (error.includes('identity.netlify.com')) return false;
      if (error.includes('WebSocket')) return false;
      if (error.includes('fetch')) return false;
      if (error.includes('Failed to load resource') && error.includes('ERR_FAILED')) return false;
      if (error.includes('Cross-Origin Request Blocked')) return false;
      if (error.includes('identity-proxy/settings')) return false;
      if (error.includes('Access-Control-Allow-Origin')) return false;
      if (error.includes('Status code: 204')) return false;
      return true;
    });
    
    expect(criticalErrors).toEqual([]);
  });

  test('main UI components initialize', async ({ page }) => {
    await page.goto('/');
    
    // Wait for Knockout bindings to apply
    await page.waitForFunction(() => window.mumbleUi !== undefined, { timeout: 10000 });
    
    // Check that essential UI state is available
    const hasGlobalBindings = await page.evaluate(() => {
      return typeof window.mumbleUi === 'object' && 
             window.mumbleUi.connectDialog !== undefined;
    });
    
    expect(hasGlobalBindings).toBe(true);
  });

  test('page is responsive on mobile viewports', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/');
    
    // Check that container adapts to mobile
    await expect(page.locator('#container')).toBeVisible();
    
    // Verify that the page doesn't have horizontal scrolling
    const hasHorizontalScroll = await page.evaluate(() => {
      return document.documentElement.scrollWidth > document.documentElement.clientWidth;
    });
    
    expect(hasHorizontalScroll).toBe(false);
  });

  test('page works on desktop viewports', async ({ page }) => {
    // Set desktop viewport
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.goto('/');
    
    // Check that main elements are properly positioned
    await expect(page.locator('#container')).toBeVisible();
    
    // Verify basic layout works
    const containerBounds = await page.locator('#container').boundingBox();
    expect(containerBounds.width).toBeGreaterThan(300);
  });
});