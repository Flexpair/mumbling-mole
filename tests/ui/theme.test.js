const { test, expect } = require('@playwright/test');

/**
 * Theme Testing
 * Tests the theme switching functionality via URL parameters
 */
test.describe('Theme Tests', () => {
  test('default theme loads (MetroMumbleLight)', async ({ page }) => {
    await page.goto('/');
    
    // Wait for page to load
    await page.waitForFunction(() => window.mumbleUi !== undefined, { timeout: 10000 });
    
    // Check that theme CSS is loaded
    const themeCSS = page.locator('link[href="theme.css"]');
    await expect(themeCSS).toBeAttached();
    
    // Check that body has appropriate styling applied
    const bodyStyles = await page.locator('body').evaluate((el) => {
      const styles = window.getComputedStyle(el);
      return {
        backgroundColor: styles.backgroundColor,
        fontFamily: styles.fontFamily
      };
    });
    
    // Basic check that styling is applied (not just default browser styles)
    expect(bodyStyles.backgroundColor).not.toBe('rgba(0, 0, 0, 0)');
  });

  test('theme parameter in URL works (?theme=MetroMumbleDark)', async ({ page }) => {
    await page.goto('/?theme=MetroMumbleDark');
    
    // Wait for page to load and theme to apply
    await page.waitForFunction(() => window.mumbleUi !== undefined, { timeout: 10000 });
    
    // Give some time for theme switching to occur
    await page.waitForTimeout(500);
    
    // Check that theme CSS is still loaded
    const themeCSS = page.locator('link[href="theme.css"]');
    await expect(themeCSS).toBeAttached();
    
    // Verify the page doesn't have JavaScript errors related to theming
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    
    // Trigger any theme-related functionality
    await page.evaluate(() => {
      // Basic check that theme system is working
      if (window.mumbleUi && window.mumbleUi.settings) {
        return true;
      }
    });
    
    const themeErrors = errors.filter(error => 
      error.toLowerCase().includes('theme') ||
      error.toLowerCase().includes('css')
    );
    
    expect(themeErrors).toEqual([]);
  });

  test('invalid theme parameter doesn\'t break the page', async ({ page }) => {
    await page.goto('/?theme=NonExistentTheme');
    
    // Should still load successfully
    await expect(page.locator('#container')).toBeVisible();
    
    // Wait for page to initialize
    await page.waitForFunction(() => window.mumbleUi !== undefined, { timeout: 10000 });
    
    // Should fall back gracefully
    const themeCSS = page.locator('link[href="theme.css"]');
    await expect(themeCSS).toBeAttached();
  });

  test('theme switching preserves functionality', async ({ page }) => {
    // Start with default theme
    await page.goto('/');
    await page.waitForFunction(() => window.mumbleUi !== undefined, { timeout: 10000 });
    
    // Navigate to dark theme
    await page.goto('/?theme=MetroMumbleDark');
    await page.waitForFunction(() => window.mumbleUi !== undefined, { timeout: 10000 });
    
    // Check that main functionality still works
    await expect(page.locator('#container')).toBeVisible();
    
    // Verify that the UI binding is still functional
    const uiWorking = await page.evaluate(() => {
      return window.mumbleUi && 
             typeof window.mumbleUi.connectDialog === 'object';
    });
    
    expect(uiWorking).toBe(true);
  });

  test('theme changes affect visual appearance', async ({ page }) => {
    // Load light theme
    await page.goto('/?theme=MetroMumbleLight');
    await page.waitForFunction(() => window.mumbleUi !== undefined, { timeout: 10000 });
    
    const lightThemeStyles = await page.locator('body').evaluate((el) => {
      const styles = window.getComputedStyle(el);
      return {
        backgroundColor: styles.backgroundColor,
        color: styles.color
      };
    });
    
    // Load dark theme
    await page.goto('/?theme=MetroMumbleDark');
    await page.waitForFunction(() => window.mumbleUi !== undefined, { timeout: 10000 });
    await page.waitForTimeout(500); // Give theme time to apply
    
    const darkThemeStyles = await page.locator('body').evaluate((el) => {
      const styles = window.getComputedStyle(el);
      return {
        backgroundColor: styles.backgroundColor,
        color: styles.color
      };
    });
    
    // Themes should result in different visual styling
    // (Note: We can't guarantee specific colors, but they should be different)
    const stylesAreDifferent = 
      lightThemeStyles.backgroundColor !== darkThemeStyles.backgroundColor ||
      lightThemeStyles.color !== darkThemeStyles.color;
    
    expect(stylesAreDifferent).toBe(true);
  });
});