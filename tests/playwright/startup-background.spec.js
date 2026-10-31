import { test, expect } from '@playwright/test';

test('shows the existing background image before the application and login load', async ({ page }) => {
  let releaseApp;
  const appWait = new Promise(resolve => { releaseApp = resolve; });
  let appRequested = false;
  await page.route('**/index.js', async route => {
    appRequested = true;
    await appWait;
    await route.continue();
  });
  await page.goto('/', { waitUntil: 'commit' });
  try {
    await expect.poll(() => appRequested).toBe(true);
    await expect(page.locator('body')).toHaveCSS('background-image', /AdobeStock_74031703\.webp/);
    await expect(page.locator('body')).toHaveCSS('background-size', 'cover');
    await expect.poll(() => page.evaluate(async () => {
      const image = new Image();
      image.src = 'img/AdobeStock_74031703.webp';
      await image.decode();
      return image.naturalWidth > 0 && image.naturalHeight > 0;
    })).toBe(true);
    await page.screenshot({ path: 'test-results/startup-background-before-app.png' });
    await expect(page.locator('dialog.connect-dialog[open]')).toHaveCount(0);
  } finally {
    releaseApp();
  }
  await expect.poll(() => page.evaluate(() => globalThis.netlifyIdentity?.store?.modal?.isOpen)).toBe(true);
  await expect(page.locator('dialog.connect-dialog[open]')).toHaveCount(0);
  await expect(page.locator('body')).toHaveCSS('background-color', 'rgb(26, 26, 26)');
  await expect(page.locator('body')).toHaveCSS('background-image', 'none');
  await expect(page.locator('.guacamole-placeholder')).toHaveCSS('background-image', /AdobeStock_74031703/);
});

test('keeps the existing background visible while a cached session is validated', async ({ page }) => {
  let releaseUser;
  let validationStarted = false;
  const validation = new Promise(resolve => { releaseUser = resolve; });
  await page.addInitScript(() => {
    const encode = value => btoa(JSON.stringify(value)).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '');
    const expiration = Math.floor(Date.now() / 1000) + 3600;
    localStorage.setItem('netlifySiteURL', 'https://identity.example.invalid');
    localStorage.setItem('gotrue.user', JSON.stringify({
      id: 'visual-fixture', email: 'visual@example.invalid', user_metadata: { full_name: 'Visual Fixture' },
      url: `${location.origin}/mock-identity`, audience: '',
      token: {
        access_token: `${encode({ alg: 'none' })}.${encode({ sub: 'visual-fixture', exp: expiration })}.fixture`,
        expires_at: expiration * 1000, expires_in: 3600, token_type: 'bearer', refresh_token: 'fixture',
      },
    }));
  });
  await page.route('**/config.local.js', route => route.fulfill({
    status: 200, contentType: 'application/javascript',
    body: "globalThis.mumbleWebConfig.auth.netlify.APIUrl = `${location.origin}/mock-identity`;",
  }));
  const identityRequest = async route => {
    const pathname = new URL(route.request().url()).pathname;
    if (pathname.endsWith('/settings')) {
      return route.fulfill({ status: 200, json: { external: { email: true }, disable_signup: false, autoconfirm: false } });
    }
    if (pathname.endsWith('/user')) {
      validationStarted = true;
      await validation;
      return route.fulfill({ status: 401, json: { code: 401, msg: 'Unauthorized' } });
    }
    return route.fulfill({ status: 404, json: {} });
  };
  for (const pattern of ['https://identity.example.invalid/**', '**/mock-identity/**', '**/.netlify/identity/**', '**/identity-proxy/**']) {
    await page.route(pattern, identityRequest);
  }
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  try {
    await expect.poll(() => validationStarted).toBe(true);
    await expect(page.locator('.guacamole-placeholder')).toBeVisible();
    await expect(page.locator('.guacamole-placeholder')).toHaveCSS('background-image', /AdobeStock_74031703/);
    await expect(page.locator('dialog.connect-dialog[open]')).toHaveCount(0);
  } finally {
    releaseUser();
  }
  await expect.poll(() => page.evaluate(() => globalThis.netlifyIdentity?.store?.modal?.isOpen)).toBe(true);
  await expect(page.locator('dialog.connect-dialog[open]')).toHaveCount(0);
});
