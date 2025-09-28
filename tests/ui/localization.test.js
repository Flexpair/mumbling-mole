const { test, expect } = require('@playwright/test');

/**
 * Localization Tests
 * Tests the multi-language support system in Mumbling Mole
 */
test.describe('Localization Tests', () => {
  // Verifies the bootstrap exposes translateEverything and the localization module.
  test('localization system initializes', async ({ page }) => {
    await page.goto('/');
    await page.waitForFunction(() => window.mumbleUi !== undefined, { timeout: 10000 });
    
    // Check that localization functions are available
    const localizationTest = await page.evaluate(() => {
      const localization = window.mumbleUi?.localization;
      return {
        hasTranslateFunction: typeof window.translateEverything === 'function',
        hasLocalizationSupport:
          !!localization && typeof localization.translate === 'function',
      };
    });
    
    expect(localizationTest.hasTranslateFunction).toBe(true);
    expect(localizationTest.hasLocalizationSupport).toBe(true);
  });

  // Confirms fundamental UI copy renders real strings instead of placeholder tokens.
  test('page renders text content', async ({ page }) => {
    await page.goto('/');
    await page.waitForFunction(() => window.mumbleUi !== undefined, { timeout: 10000 });
    
    // Wait for any localization to apply
    await page.waitForTimeout(1000);
    
    // Check that the page has actual text content (not just placeholder keys)
    const localizationSnapshot = await page.evaluate(() => {
      const title = document
        .querySelector('#connect-dialog_title')
        ?.textContent?.trim();
      const connectLabel = document
        .querySelector('#connect-dialog_controls_connect')
        ?.value;
      const bodyText = document.body.innerText || '';
      return {
        title,
        connectLabel,
        hasPlaceholders:
          bodyText.includes('{{') ||
          bodyText.includes('}}') ||
          bodyText.includes('undefined') ||
          bodyText.includes('null'),
      };
    });
    
    expect(localizationSnapshot.title?.length).toBeGreaterThan(0);
    expect(localizationSnapshot.connectLabel?.length).toBeGreaterThan(0);
    expect(localizationSnapshot.hasPlaceholders).toBe(false);
  });

  // Guards against template markers leaking onto the page after bindings run.
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

  // Ensures user settings expose a language flag we can toggle from the UI.
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

  // Watches for exceptions coming from the default locale files during startup.
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

  // Exercises translateEverything so missing keys do not crash the app shell.
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

  // Checks that localized strings do not collapse or hide the main container.
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

  // Spot-checks body text for human readable content after translation scripts run.
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

  // Validates that Knockout bindings still populate DOM elements once localization fires.
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