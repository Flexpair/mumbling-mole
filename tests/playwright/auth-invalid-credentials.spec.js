import { test, expect } from '@playwright/test';

const IDENTITY_IFRAME = 'iframe[title="Netlify identity widget"]';
const INVALID_EMAIL = 'invalid-auth-regression@example.invalid';
const INVALID_PASSWORD = 'InvalidLoginOnly-DoNotUse';

async function findIdentityFrame(page) {
  await page.waitForSelector(IDENTITY_IFRAME, {
    state: 'attached',
    timeout: 10000,
  });

  const deadline = Date.now() + 10000;
  while (Date.now() < deadline) {
    const frameCount = await page.locator(IDENTITY_IFRAME).count();
    for (let index = frameCount - 1; index >= 0; index -= 1) {
      const frame = page.frameLocator(IDENTITY_IFRAME).nth(index);
      const loginTab = frame.getByRole('button', { name: 'Log in' }).first();
      if (await loginTab.isVisible().catch(() => false)) {
        return { frame, iframe: page.locator(IDENTITY_IFRAME).nth(index) };
      }
    }

    await page.waitForTimeout(100);
  }

  throw new Error('No visible Netlify Identity login frame found');
}

test.describe('Netlify Identity authentication', () => {
  test('keeps login in control after invalid credentials', async ({ page }) => {
    let invalidGrantResponses = 0;
    page.on('response', (response) => {
      if (response.status() === 400 && response.url().includes('/token')) {
        invalidGrantResponses += 1;
      }
    });

    await page.goto('/', { waitUntil: 'domcontentloaded', timeout: 30000 });

    const { frame: loginFrame, iframe: identityIframe } = await findIdentityFrame(page);
    await loginFrame.getByRole('button', { name: 'Log in' }).first().click();

    const emailInput = loginFrame.getByPlaceholder('Email');
    const passwordInput = loginFrame.getByPlaceholder('Password');
    await expect(emailInput).toBeVisible();
    await expect(passwordInput).toBeVisible();

    const submitInvalidCredentials = async () => {
      await emailInput.fill(INVALID_EMAIL);
      await passwordInput.fill(INVALID_PASSWORD);
      await loginFrame.getByRole('button', { name: 'Log in' }).last().click();
    };

    await submitInvalidCredentials();

    const invalidCredentialsError = loginFrame.getByText(
      /No user found with that email, or password invalid/i,
    );
    await expect(invalidCredentialsError).toBeVisible({ timeout: 15000 });

    const connectDialog = page.locator('dialog.connect-dialog[open]');
    const assertLoginOwnsTheHandoff = async () => {
      await expect(emailInput).toBeVisible();
      await expect(passwordInput).toBeVisible();
      await expect(connectDialog).toHaveCount(0);
    };

    await assertLoginOwnsTheHandoff();
    await submitInvalidCredentials();
    await expect(invalidCredentialsError).toBeVisible({ timeout: 15000 });

    const observationDeadline = Date.now() + 2000;
    while (Date.now() < observationDeadline) {
      await assertLoginOwnsTheHandoff();
      await page.waitForTimeout(100);
    }

    expect(invalidGrantResponses).toBe(2);

    const overlayState = await identityIframe.evaluate((iframe) => {
      const bounds = iframe.getBoundingClientRect();
      const topElement = document.elementFromPoint(
        globalThis.innerWidth / 2,
        globalThis.innerHeight / 2,
      );

      return {
        coversViewport:
          bounds.width >= globalThis.innerWidth * 0.9 &&
          bounds.height >= globalThis.innerHeight * 0.9,
        isTopmost: topElement === iframe,
      };
    });

    expect(overlayState).toEqual({ coversViewport: true, isTopmost: true });
  });

  test('reopens login after closing the unauthenticated widget', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded', timeout: 30000 });

    const { frame: loginFrame } = await findIdentityFrame(page);
    await loginFrame.getByRole('button', { name: 'Log in' }).first().click();

    const emailInput = loginFrame.getByPlaceholder('Email');
    await expect(emailInput).toBeVisible();

    await loginFrame.getByRole('button', { name: 'Close' }).click();

    await expect(emailInput).toBeVisible({ timeout: 15000 });
    await expect(loginFrame.getByPlaceholder('Password')).toBeVisible();
    await expect(page.locator('dialog.connect-dialog[open]')).toHaveCount(0);
  });
});
