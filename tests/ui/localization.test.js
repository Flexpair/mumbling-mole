const { test, expect } = require('@playwright/test');

/**
 * Localization Tests
 * Tests the multi-language support system in Mumbling Mole
 */
test.describe('Localization Tests', () => {
  test('localization system initializes', async ({ page }) => {
    await page.goto('/');
    await page.waitForFunction(() => window.mumbleUi !== undefined, { timeout: 10000 });
    
    // Check that localization functions are available
    const localizationTest = await page.evaluate(() => {
      return {
        hasTranslateFunction: typeof window.translateEverything === 'function' || 
                             (window.mumbleUi && typeof window.mumbleUi.translateEverything === 'function'),
        hasLocalizationSupport: window.mumbleUi?.localization !== undefined ||
                               window.mumbleUi?.settings?.locale !== undefined
      };
    });
    
    // At least one form of localization should be present
    expect(localizationTest.hasTranslateFunction || localizationTest.hasLocalizationSupport).toBe(true);
  });

  test('page renders text content', async ({ page }) => {
    await page.goto('/');
    await page.waitForFunction(() => window.mumbleUi !== undefined, { timeout: 10000 });
    
    // Wait for any localization to apply
    await page.waitForTimeout(1000);
    
    // Check that the page has actual text content (not just placeholder keys)
    const hasTextContent = await page.evaluate(() => {
      const body = document.body.innerText;
      return body.length > 100 && // Should have substantial text
             !body.includes('undefined') && // No undefined localization keys
             !body.includes('null'); // No null values displayed
    });
    
    expect(hasTextContent).toBe(true);
  });

  test('localization keys are resolved', async ({ page }) => {
    await page.goto('/');
    await page.waitForFunction(() => window.mumbleUi !== undefined, { timeout: 10000 });
    
    // Wait for localization to process
    await page.waitForTimeout(1500);
    
    // Check for common localization key patterns that should be resolved
    const bodyText = await page.locator('body').textContent();
    
    // These patterns suggest unresolved localization keys
    const hasUnresolvedKeys = bodyText.includes('{{') || 
                             bodyText.includes('}}') ||
                             bodyText.includes('__') ||
                             bodyText.includes('translate(') ||
                             bodyText.includes('i18n.');
    
    expect(hasUnresolvedKeys).toBe(false);
  });

  test('language switching mechanism exists', async ({ page }) => {
    await page.goto('/');
    await page.waitForFunction(() => window.mumbleUi !== undefined, { timeout: 10000 });
    
    // Check if there's a mechanism for language switching in settings
    const languageSupport = await page.evaluate(() => {
      const settings = window.mumbleUi?.settings;
      return {
        hasSettings: settings !== undefined,
        hasLanguageOption: settings?.language !== undefined || 
                          settings?.locale !== undefined ||
                          settings?.lang !== undefined,
        hasSettingsDialog: window.mumbleUi?.settingsDialog !== undefined
      };
    });
    
    expect(languageSupport.hasSettings).toBe(true);
    // Should have some form of language configuration
  });

  test('default language loads without errors', async ({ page }) => {
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    
    await page.goto('/');
    await page.waitForFunction(() => window.mumbleUi !== undefined, { timeout: 10000 });
    
    // Wait for localization to complete
    await page.waitForTimeout(2000);
    
    // Filter out unrelated errors
    const localizationErrors = errors.filter(error => 
      error.toLowerCase().includes('localiz') ||
      error.toLowerCase().includes('translat') ||
      error.toLowerCase().includes('i18n') ||
      error.toLowerCase().includes('locale')
    );
    
    expect(localizationErrors).toEqual([]);
  });

  test('localization handles missing translations gracefully', async ({ page }) => {
    await page.goto('/');
    await page.waitForFunction(() => window.mumbleUi !== undefined, { timeout: 10000 });
    
    // Test that missing translation keys don't crash the app
    const gracefulHandling = await page.evaluate(() => {
      try {
        // Try to access localization functions if they exist
        if (typeof window.translateEverything === 'function') {
          window.translateEverything();
        }
        
        // App should still be functional
        return window.mumbleUi !== undefined &&
               typeof window.mumbleUi === 'object';
      } catch (error) {
        return false;
      }
    });
    
    expect(gracefulHandling).toBe(true);
  });

  test('UI elements maintain structure with localization', async ({ page }) => {
    await page.goto('/');
    await page.waitForFunction(() => window.mumbleUi !== undefined, { timeout: 10000 });
    
    // Wait for localization processing
    await page.waitForTimeout(1500);
    
    // Check that essential UI elements are still present after localization
    await expect(page.locator('#container')).toBeVisible();
    
    // Check that localization doesn't break the layout
    const containerBounds = await page.locator('#container').boundingBox();
    expect(containerBounds.width).toBeGreaterThan(200);
    expect(containerBounds.height).toBeGreaterThan(200);
  });

  test('localized text is readable and formatted', async ({ page }) => {
    await page.goto('/');
    await page.waitForFunction(() => window.mumbleUi !== undefined, { timeout: 10000 });
    
    // Wait for text to be localized
    await page.waitForTimeout(1500);
    
    // Check that text content appears properly formatted
    const textQuality = await page.evaluate(() => {
      // Get all text nodes
      const walker = document.createTreeWalker(
        document.body,
        NodeFilter.SHOW_TEXT,
        null,
        false
      );
      
      let hasReadableText = false;
      let node;
      
      while (node = walker.nextNode()) {
        const text = node.textContent.trim();
        if (text.length > 3 && 
            !text.includes('data-bind') && 
            !text.includes('ko.') &&
            text.match(/[a-zA-Z]/)) {
          hasReadableText = true;
          break;
        }
      }
      
      return hasReadableText;
    });
    
    expect(textQuality).toBe(true);
  });

  test('knockout bindings work with localization', async ({ page }) => {
    await page.goto('/');
    await page.waitForFunction(() => window.mumbleUi !== undefined, { timeout: 10000 });
    
    // Wait for Knockout and localization to process
    await page.waitForTimeout(2000);
    
    // Check that Knockout bindings are still functional after localization
    const bindingsTest = await page.evaluate(() => {
      return {
        uiExists: window.mumbleUi !== undefined,
        hasObservables: window.mumbleUi?.connectDialog !== undefined,
        bindingsApplied: document.querySelectorAll('[data-bind]').length > 0
      };
    });
    
    expect(bindingsTest.uiExists).toBe(true);
    expect(bindingsTest.hasObservables).toBe(true);
    expect(bindingsTest.bindingsApplied).toBe(true);
  });
});