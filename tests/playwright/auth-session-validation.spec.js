import { test, expect } from '@playwright/test';

const identityRoot = 'https://identity.example.invalid';
const settings = { external: { email: true }, disable_signup: false, autoconfirm: false };
const profile = {
  id: 'browser-test-user',
  email: 'browser-test@example.invalid',
  user_metadata: { full_name: 'Browser Test' },
  app_metadata: {},
};

async function prepareIdentity(page, getStatus, { expired = false, refreshStatus = () => 500, waitForUser = () => Promise.resolve() } = {}) {
  let userRequests = 0;
  await page.addInitScript(({ identityRoot, profile, expired }) => {
    const encode = value => btoa(JSON.stringify(value)).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '');
    const expiresAt = Date.now() + (expired ? -3600000 : 3600000);
    const accessToken = `${encode({ alg: 'none' })}.${encode({ sub: profile.id, exp: Math.floor(expiresAt / 1000) })}.fixture`;
    localStorage.setItem('netlifySiteURL', identityRoot);
    localStorage.setItem('gotrue.user', JSON.stringify({
      ...profile,
      url: `${location.origin}/mock-identity`,
      audience: '',
      token: {
        access_token: accessToken,
        token_type: 'bearer',
        expires_in: 3600,
        expires_at: expiresAt,
        refresh_token: 'fixture-only',
      },
    }));
  }, { identityRoot, profile, expired });

  await page.route('**/config.local.js', route => route.fulfill({
    status: 200,
    contentType: 'application/javascript',
    body: "globalThis.mumbleWebConfig.auth.netlify.APIUrl = `${location.origin}/mock-identity`;",
  }));

  const handleIdentityRequest = async route => {
    const path = new URL(route.request().url()).pathname;
    const headers = { 'Access-Control-Allow-Origin': '*' };
    if (path.endsWith('/settings')) {
      return route.fulfill({ status: 200, headers, json: settings });
    }
    if (path.endsWith('/user')) {
      userRequests += 1;
      await waitForUser();
      const status = getStatus();
      return route.fulfill({
        status,
        headers,
        json: status === 200 ? profile : { code: status, msg: status === 401 ? 'Unauthorized' : 'Server unavailable' },
      });
    }
    if (path.endsWith('/token')) {
      const status = refreshStatus();
      const expiration = Math.floor(Date.now() / 1000) + 3600;
      const encode = value => Buffer.from(JSON.stringify(value)).toString('base64url');
      return route.fulfill({
        status,
        headers,
        json: status === 200 ? {
          access_token: `${encode({ alg: 'none' })}.${encode({ sub: profile.id, exp: expiration })}.fixture`,
          token_type: 'bearer', expires_in: 3600, refresh_token: 'fixture-rotated',
        } : status === 400
          ? { error: 'invalid_grant', error_description: 'Invalid refresh token' } : { error: 'server_error' },
      });
    }
    return route.fulfill({ status: 404, headers, json: {} });
  };
  await page.route(`${identityRoot}/**`, handleIdentityRequest);
  await page.route('**/mock-identity/**', handleIdentityRequest);
  await page.route('**/.netlify/identity/**', handleIdentityRequest);
  await page.route('**/identity-proxy/**', handleIdentityRequest);
  return () => userRequests;
}

async function expectLoginVisible(page) {
  await expect.poll(() => page.evaluate(() => ({
    open: globalThis.netlifyIdentity?.store?.modal?.isOpen,
    view: globalThis.netlifyIdentity?.store?.modal?.page,
  }))).toEqual({ open: true, view: 'login' });
  await expect(page.locator('dialog.connect-dialog[open]')).toHaveCount(0);
}

async function trackRuntimeCleanup(page, hideConnect = false) {
  await page.evaluate(shouldHide => {
    globalThis.__disconnectEvents = [];
    globalThis.mumbleUi.ui.guacamoleFrame = { stop: () => globalThis.__disconnectEvents.push('desktop') };
    globalThis.mumbleUi.voice.voiceHandler = { end: () => globalThis.__disconnectEvents.push('voice') };
    if (shouldHide) globalThis.mumbleUi.connectDialog.visible = false;
  }, hideConnect);
}

async function expectRuntimeCleanup(page) {
  await expect.poll(() => page.evaluate(() => globalThis.__disconnectEvents)).toEqual(expect.arrayContaining(['desktop', 'voice']));
}

function createValidationGates() {
  let phase = 'startup';
  let releaseLogin;
  let releaseFocus;
  const loginWait = new Promise(resolve => { releaseLogin = resolve; });
  const focusWait = new Promise(resolve => { releaseFocus = resolve; });
  return {
    waitForUser: () => phase === 'login' ? loginWait : phase === 'focus' ? focusWait : Promise.resolve(),
    setPhase: next => { phase = next; },
    releaseLogin,
    releaseFocus,
  };
}

test.describe('Identity session validation', () => {
  test('shows a reload instruction if the Identity widget fails to load', async ({ page }) => {
    await page.route('https://identity.netlify.com/v1/netlify-identity-widget.js', route => route.abort());
    await page.goto('/');
    await expect(page.getByText('Unable to initialize authentication. Please refresh the page.')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('dialog.connect-dialog[open]')).toHaveCount(0);
  });

  test('opens login instead of Connect when the cached session is rejected at startup', async ({ page }) => {
    const requestCount = await prepareIdentity(page, () => 401);
    await page.goto('/');
    await expect.poll(requestCount).toBeGreaterThan(0);
    await expectLoginVisible(page);
    const loginFrame = page.locator('iframe[title="Netlify identity widget"]:visible').last().contentFrame();
    await expect(loginFrame.getByRole('button', { name: 'Log in' }).first()).toBeVisible();
    await expect(loginFrame.getByText('Enter your name')).toBeVisible();
  });

  test('opens login when a session expires while the window is inactive', async ({ page }) => {
    let status = 200;
    const requestCount = await prepareIdentity(page, () => status);
    await page.goto('/');
    await expect(page.locator('dialog.connect-dialog[open]')).toHaveCount(1);
    const previousRequests = requestCount();
    status = 401;
    await page.evaluate(() => globalThis.dispatchEvent(new Event('focus')));
    await expect.poll(requestCount).toBeGreaterThan(previousRequests);
    await expectLoginVisible(page);
  });

  test('disconnects active Mumble and Guacamole when the Identity session is rejected', async ({ page }) => {
    let status = 200;
    const requestCount = await prepareIdentity(page, () => status);
    await page.goto('/');
    await expect(page.locator('dialog.connect-dialog[open]')).toHaveCount(1);
    await trackRuntimeCleanup(page, true);
    const before = requestCount();
    status = 401;
    await page.evaluate(() => globalThis.dispatchEvent(new Event('focus')));
    await expect.poll(requestCount).toBeGreaterThan(before);
    await expectLoginVisible(page);
    await expectRuntimeCleanup(page);
  });

  test('keeps session checks active when a token login supersedes startup', async ({ page }) => {
    let release;
    const pending = new Promise(resolve => { release = resolve; });
    let holdValidation = true;
    const requestCount = await prepareIdentity(page, () => 200, {
      waitForUser: () => holdValidation ? pending : Promise.resolve(),
    });
    await page.goto('/#recovery_token=synthetic-callback');
    await expect.poll(requestCount).toBeGreaterThan(0);
    try {
      await page.evaluate(() => {
        const store = globalThis.netlifyIdentity.store;
        store.user = null;
        store.user = globalThis.netlifyIdentity.currentUser();
      });
      await expect(page.locator('dialog.connect-dialog[open]')).toHaveCount(1);
    } finally {
      holdValidation = false;
      release();
    }
    await expect.poll(() => page.evaluate(() => Boolean(globalThis.mumbleUi.auth.currentUser()))).toBe(true);
    const before = requestCount();
    await page.evaluate(() => globalThis.dispatchEvent(new Event('focus')));
    await expect.poll(requestCount).toBeGreaterThan(before);
  });


  test('ignores a pending resume failure once a newer login event starts', async ({ page }) => {
    let phase = 'startup';
    let releaseResume;
    let releaseLogin;
    const resumeWait = new Promise(resolve => { releaseResume = resolve; });
    const loginWait = new Promise(resolve => { releaseLogin = resolve; });
    const requestCount = await prepareIdentity(page, () => phase === 'failing' ? 500 : 200, {
      waitForUser: () => phase === 'resume' ? resumeWait : phase === 'login' ? loginWait : Promise.resolve(),
    });
    await page.goto('/');
    await expect(page.locator('dialog.connect-dialog[open]')).toHaveCount(1);
    const before = requestCount();
    phase = 'resume';
    await page.evaluate(() => globalThis.dispatchEvent(new Event('focus')));
    await expect.poll(requestCount).toBeGreaterThan(before);
    phase = 'login';
    await page.evaluate(() => { globalThis.netlifyIdentity.store.user = { id: 'new-login' }; });
    try {
      await expect.poll(requestCount).toBeGreaterThan(before + 1);
      const failureResponse = page.waitForResponse(response => response.url().endsWith('/user') && response.status() === 500);
      phase = 'failing';
      releaseResume();
      await failureResponse;
      await expect(page.getByText('Unable to verify your session. Check your connection and try again.')).toHaveCount(0);
    } finally {
      phase = 'startup';
      releaseResume();
      releaseLogin();
    }
  });

  test('disables Connect while a replacement login is being validated', async ({ page }) => {
    let hold = false;
    let release;
    const pending = new Promise(resolve => { release = resolve; });
    const requestCount = await prepareIdentity(page, () => 200, {
      waitForUser: () => hold ? pending : Promise.resolve(),
    });
    await page.goto('/');
    const dialog = page.locator('dialog.connect-dialog[open]');
    await expect(dialog).toHaveCount(1);
    const before = requestCount();
    hold = true;
    await page.evaluate(() => { globalThis.netlifyIdentity.store.user = { id: 'replacement' }; });
    try {
      await expect.poll(requestCount).toBeGreaterThan(before);
      await expect(dialog).toHaveCount(1);
      await expect(dialog.getByRole('button', { name: 'Connect to voice server' })).toBeDisabled();
      await expect(dialog.getByRole('button', { name: 'Audio Test' })).toBeDisabled();
    } finally {
      hold = false;
      release();
    }
    await expect(dialog.getByRole('button', { name: 'Connect to voice server' })).toBeEnabled();
  });

  test('tears down the previous session before a replacement login is validated', async ({ page }) => {
    let release;
    let hold = false;
    const pending = new Promise(resolve => { release = resolve; });
    const requestCount = await prepareIdentity(page, () => 200, {
      waitForUser: () => hold ? pending : Promise.resolve(),
    });
    await page.goto('/');
    await expect(page.locator('dialog.connect-dialog[open]')).toHaveCount(1);
    await trackRuntimeCleanup(page);
    const before = requestCount();
    hold = true;
    await page.evaluate(() => { globalThis.netlifyIdentity.store.user = { id: 'replacement' }; });
    try {
      await expect.poll(requestCount).toBeGreaterThan(before);
      await expectRuntimeCleanup(page);
    } finally {
      release();
    }
  });

  test('keeps Connect disabled until a newer focus check finishes', async ({ page }) => {
    const gates = createValidationGates();
    const requestCount = await prepareIdentity(page, () => 200, { waitForUser: gates.waitForUser });
    await page.goto('/');
    const dialog = page.locator('dialog.connect-dialog[open]');
    await expect(dialog).toHaveCount(1);
    await page.evaluate(() => {
      globalThis.__completedValidations = 0;
      const auth = globalThis.mumbleUi.auth;
      const getCurrentUser = auth.getCurrentUser.bind(auth);
      auth.getCurrentUser = (...args) => getCurrentUser(...args).finally(() => {
        globalThis.__completedValidations += 1;
      });
    });
    const before = requestCount();
    gates.setPhase('login');
    await page.evaluate(() => { globalThis.netlifyIdentity.store.user = { id: 'replacement' }; });
    try {
      await expect.poll(requestCount).toBeGreaterThan(before);
      await expect(dialog.getByRole('button', { name: 'Connect to voice server' })).toBeDisabled();
      gates.setPhase('focus');
      await page.evaluate(() => globalThis.dispatchEvent(new Event('focus')));
      await expect.poll(requestCount).toBeGreaterThan(before + 1);
      gates.setPhase('startup');
      gates.releaseLogin();
      await expect.poll(() => page.evaluate(() => globalThis.__completedValidations)).toBe(1);
      await expect(dialog.getByRole('button', { name: 'Connect to voice server' })).toBeDisabled();
    } finally {
      gates.releaseLogin();
      gates.releaseFocus();
    }
    await expect(dialog.getByRole('button', { name: 'Connect to voice server' })).toBeEnabled();
  });

  test('shows Connect after focus supersedes a replacement login while Connect was hidden', async ({ page }) => {
    const gates = createValidationGates();
    const requestCount = await prepareIdentity(page, () => 200, { waitForUser: gates.waitForUser });
    await page.goto('/');
    await expect(page.locator('dialog.connect-dialog[open]')).toHaveCount(1);
    await page.evaluate(() => {
      globalThis.mumbleUi.connectDialog.visible = false;
      globalThis.mumbleUi.connectDialog.username = '';
    });
    const before = requestCount();
    gates.setPhase('login');
    await page.evaluate(() => { globalThis.netlifyIdentity.store.user = { id: 'replacement' }; });
    try {
      await expect.poll(requestCount).toBeGreaterThan(before);
      gates.setPhase('focus');
      await page.evaluate(() => globalThis.dispatchEvent(new Event('focus')));
      await expect.poll(requestCount).toBeGreaterThan(before + 1);
      gates.setPhase('startup');
      gates.releaseFocus();
      await expect(page.locator('dialog.connect-dialog[open]')).toHaveCount(1);
      await expect(page.locator('dialog.connect-dialog #username')).toHaveValue('Browser_Test');
    } finally {
      gates.releaseLogin();
      gates.releaseFocus();
    }
  });

  test('cleans up an active session when a login event is rejected', async ({ page }) => {
    let status = 200;
    const requestCount = await prepareIdentity(page, () => status);
    await page.goto('/');
    await expect(page.locator('dialog.connect-dialog[open]')).toHaveCount(1);
    await trackRuntimeCleanup(page, true);
    const before = requestCount();
    status = 401;
    await page.evaluate(() => {
      const store = globalThis.netlifyIdentity.store;
      store.user = null;
      store.user = globalThis.netlifyIdentity.currentUser();
    });
    await expect.poll(requestCount).toBeGreaterThan(before);
    await expectLoginVisible(page);
    await expectRuntimeCleanup(page);
  });

  test('keeps Connect visible but blocks actions while a resumed session is checked', async ({ page }) => {
    let holdValidation = false;
    let release;
    const pending = new Promise(resolve => { release = resolve; });
    const requestCount = await prepareIdentity(page, () => 200, {
      waitForUser: () => holdValidation ? pending : Promise.resolve(),
    });
    await page.goto('/');
    const dialog = page.locator('dialog.connect-dialog[open]');
    await expect(dialog).toHaveCount(1);
    const countBeforeResume = requestCount();
    holdValidation = true;
    await page.evaluate(() => globalThis.dispatchEvent(new Event('focus')));
    try {
      await expect.poll(requestCount).toBeGreaterThan(countBeforeResume);
      await expect(dialog).toHaveCount(1);
      await expect(dialog.getByRole('button', { name: 'Connect to voice server' })).toBeDisabled();
      await expect(dialog.getByRole('button', { name: 'Audio Test' })).toBeDisabled();
    } finally {
      release();
    }
    await expect(dialog.getByRole('button', { name: 'Connect to voice server' })).toBeEnabled();
    await expect(dialog).toHaveCount(1);
  });

  test('offers login when a session expires after the Connect dialog appears', async ({ page }) => {
    let status = 200;
    const requestCount = await prepareIdentity(page, () => status);
    await page.goto('/');
    const connectDialog = page.locator('dialog.connect-dialog[open]');
    await expect(connectDialog).toHaveCount(1);
    const previousRequests = requestCount();
    status = 401;
    await connectDialog.getByRole('button', { name: 'Connect to voice server' }).click();
    await expect.poll(requestCount).toBeGreaterThan(previousRequests);
    await expectLoginVisible(page);
  });

  test('keeps login available after the authentication modal is closed', async ({ page }) => {
    await prepareIdentity(page, () => 401);
    await page.goto('/');
    await expectLoginVisible(page);
    const loginFrame = page.locator('iframe[title="Netlify identity widget"]:visible').last().contentFrame();
    await loginFrame.getByRole('button', { name: 'Close' }).click();
    await expectLoginVisible(page);
    await expect(loginFrame.getByText('Enter your name')).toBeVisible();
  });

  test('restores Connect after closing authentication during a temporary validation failure', async ({ page }) => {
    let status = 200;
    const requestCount = await prepareIdentity(page, () => status);
    await page.goto('/');
    await expect(page.locator('dialog.connect-dialog[open]')).toHaveCount(1);
    await page.evaluate(() => globalThis.mumbleUi.auth.openAuth('login'));
    status = 500;
    const beforeClose = requestCount();
    await page.evaluate(() => globalThis.mumbleUi.auth.closeAuth());
    await expect.poll(requestCount).toBeGreaterThan(beforeClose);
    await expect(page.getByText('Unable to verify your session. Check your connection and try again.')).toBeVisible();
    const beforeRetry = requestCount();
    status = 200;
    await page.evaluate(() => globalThis.dispatchEvent(new Event('focus')));
    await expect.poll(requestCount).toBeGreaterThan(beforeRetry);
    await expect(page.locator('dialog.connect-dialog[open]')).toHaveCount(1);
  });

  test('restores the authenticated username after a startup validation error', async ({ page }) => {
    let status = 500;
    const requestCount = await prepareIdentity(page, () => status);
    await page.goto('/');
    await expect(page.getByText('Unable to verify your session. Check your connection and try again.')).toBeVisible();
    const previousRequests = requestCount();
    status = 200;
    await page.evaluate(() => globalThis.dispatchEvent(new Event('focus')));
    await expect.poll(requestCount).toBeGreaterThan(previousRequests);
    await expect(page.locator('dialog.connect-dialog[open]')).toHaveCount(1);
    await expect(page.locator('dialog.connect-dialog #username')).toHaveValue('Browser_Test');
  });

  test('does not open Connect over an active session after a transient validation error', async ({ page }) => {
    let status = 200;
    const requestCount = await prepareIdentity(page, () => status);
    await page.goto('/');
    await expect(page.locator('dialog.connect-dialog[open]')).toHaveCount(1);
    await page.evaluate(() => { globalThis.mumbleUi.connectDialog.visible = false; });
    let before = requestCount();
    status = 500;
    await page.evaluate(() => globalThis.dispatchEvent(new Event('focus')));
    await expect.poll(requestCount).toBeGreaterThan(before);
    await expect(page.getByText('Unable to verify your session. Check your connection and try again.')).toBeVisible();
    before = requestCount();
    status = 200;
    await page.evaluate(() => globalThis.dispatchEvent(new Event('focus')));
    await expect.poll(requestCount).toBeGreaterThan(before);
    await expect(page.getByText('Unable to verify your session. Check your connection and try again.')).toHaveCount(0);
    await expect(page.locator('dialog.connect-dialog[open]')).toHaveCount(0);
  });

  test('retries startup validation without connecting with an empty username', async ({ page }) => {
    let status = 500;
    const requestCount = await prepareIdentity(page, () => status);
    let credentialsRequests = 0;
    await page.route('**/api/credentials', route => {
      credentialsRequests += 1;
      return route.fulfill({ status: 503, json: {} });
    });
    await page.goto('/');
    await expect(page.getByText('Unable to verify your session. Check your connection and try again.')).toBeVisible();
    const previousRequests = requestCount();
    status = 200;
    await page.locator('.error-dialog .dialog-submit').click();
    await expect.poll(requestCount).toBeGreaterThan(previousRequests);
    await expect(page.locator('dialog.connect-dialog[open]')).toHaveCount(1);
    await expect(page.locator('dialog.connect-dialog #username')).toHaveValue('Browser_Test');
    expect(credentialsRequests).toBe(0);
    await page.evaluate(() => {
      globalThis.mumbleUi.audio.initializeAudioContext = async () => ({ sampleRate: 48000 });
      globalThis.mumbleUi.voice.setupVoiceForConnection = async () => {};
    });
    await page.route('**/api/credentials', route => route.fulfill({
      status: 200,
      json: { mumblePassword: 'fixture', guacamoleUser: 'fixture', guacamolePassword: 'fixture' },
    }));
    await page.locator('dialog.connect-dialog[open]').getByRole('button', { name: 'Connect to voice server' }).click();
    await expect(page.locator('.sample-rate-dialog')).toBeVisible();
    const connectionUsername = await page.evaluate(() => {
      const provides = globalThis.__VUE_APP__.$.appContext.provides;
      const pinia = Reflect.ownKeys(provides).map(key => provides[key]).find(value => value?._s instanceof Map);
      return pinia._s.get('dialog').sampleRateDialog.connectionParams.username;
    });
    expect(connectionUsername).toBe('Browser_Test');
  });

  test('retries validation after a login from the authentication modal fails temporarily', async ({ page }) => {
    let status = 401;
    const requestCount = await prepareIdentity(page, () => status);
    await page.addInitScript(() => { globalThis.__savedTestIdentity = localStorage.getItem('gotrue.user'); });
    await page.goto('/');
    await expectLoginVisible(page);
    status = 500;
    const before = requestCount();
    await page.evaluate(() => {
      localStorage.setItem('gotrue.user', globalThis.__savedTestIdentity);
      globalThis.netlifyIdentity.store.user = globalThis.netlifyIdentity.currentUser();
    });
    await expect.poll(requestCount).toBeGreaterThan(before);
    await expect(page.getByText('Unable to verify your session. Check your connection and try again.')).toBeVisible();
    const loginFrame = page.locator('iframe[title="Netlify identity widget"]:visible').last().contentFrame();
    await loginFrame.getByRole('button', { name: 'Close' }).click();
    status = 200;
    const beforeRetry = requestCount();
    await page.locator('.error-dialog .dialog-submit').click();
    await expect.poll(requestCount).toBeGreaterThan(beforeRetry);
    await expect(page.locator('dialog.connect-dialog[open]')).toHaveCount(1);
  });

  test('does not treat a temporary validation error as a logout', async ({ page }) => {
    let status = 200;
    const requestCount = await prepareIdentity(page, () => status);
    await page.goto('/');
    await expect(page.locator('dialog.connect-dialog[open]')).toHaveCount(1);
    const previousRequests = requestCount();
    status = 500;
    await page.evaluate(() => globalThis.dispatchEvent(new Event('focus')));
    await expect.poll(requestCount).toBeGreaterThan(previousRequests);
    await expect(page.locator('dialog.connect-dialog[open]')).toHaveCount(0);
    await expect(page.getByText('Unable to verify your session. Check your connection and try again.')).toBeVisible();
    await expect.poll(() => page.evaluate(() => ({
      open: globalThis.netlifyIdentity.store.modal.isOpen,
      user: Boolean(globalThis.netlifyIdentity.store.user),
    }))).toEqual({ open: false, user: true });
    const failedRequests = requestCount();
    status = 200;
    await page.evaluate(() => globalThis.dispatchEvent(new Event('focus')));
    await expect.poll(requestCount).toBeGreaterThan(failedRequests);
    await expect(page.locator('dialog.connect-dialog[open]')).toHaveCount(1);
    await expect(page.getByText('Unable to verify your session. Check your connection and try again.')).toHaveCount(0);
  });

  test('opens login when an expired refresh token is rejected', async ({ page }) => {
    await prepareIdentity(page, () => 200, { expired: true, refreshStatus: () => 400 });
    await page.goto('/');
    await expectLoginVisible(page);
  });

  test('preserves the session if refreshing an expired token fails temporarily', async ({ page }) => {
    let refreshStatus = 500;
    await prepareIdentity(page, () => 200, { expired: true, refreshStatus: () => refreshStatus });
    await page.goto('/');
    await expect(page.getByText('Unable to verify your session. Check your connection and try again.')).toBeVisible();
    await expect(page.locator('dialog.connect-dialog[open]')).toHaveCount(0);
    await expect.poll(() => page.evaluate(() => Boolean(localStorage.getItem('gotrue.user')))).toBe(true);
    refreshStatus = 200;
    await page.evaluate(() => globalThis.dispatchEvent(new Event('focus')));
    await expect(page.locator('dialog.connect-dialog[open]')).toHaveCount(1);
  });
});
