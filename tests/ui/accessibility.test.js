const { test, expect } = require('@playwright/test');
const AxeBuilder = require('@axe-core/playwright').default;

/**
 * Accessibility smoke tests for the main UI.
 */
test.describe('Accessibility Tests', () => {
  test('homepage has no serious accessibility violations', async ({ page }) => {
    await page.goto('/');
    await page.waitForFunction(() => window.mumbleUi !== undefined, { timeout: 10000 });

    const axe = new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa'])
      // Color contrast varies with theming palette and is tracked separately in design reviews.
      .disableRules(['color-contrast']);

    const results = await axe.analyze();
    const seriousViolations = results.violations.filter((violation) => {
      return violation.impact === 'serious' || violation.impact === 'critical';
    });

    expect(seriousViolations, JSON.stringify(seriousViolations, null, 2)).toEqual([]);
  });
});
