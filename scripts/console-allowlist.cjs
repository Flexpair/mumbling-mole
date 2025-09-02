#!/usr/bin/env node
/**
 * Console allowlist check using Playwright.
 * - Serves dist/ via docker-entrypoint in SKIP_TUNNEL=1 mode
 * - Opens Chromium and navigates to /
 * - Captures console events and page errors
 * - Fails unless only allowlisted messages occur
 *
 * Expected current errors (allowlist):
 * - Guacamole missing (when backend isn't running) → fetch/WS/CORS errors
 * - CORS errors to identity-proxy (if network blocked)
 */

const { spawn } = require('child_process');
const http = require('http');
const waitPort = require('wait-port');
const fs = require('fs');
const path = require('path');

const PORT = Number(process.env.SMOKE_HTTP_PORT || process.env.PORT || 8081);
const HOST = '127.0.0.1';

const ALLOW = [
  /guacamole/i,
  /guac/i,
  /Failed to fetch/i,
  /CORS/i,
  /NetworkError/i,
  /WebSocket connection to .* failed/i,
  /net::ERR/i,
  /blocked by client/i,
  /identity[- ]?proxy/i,
  /AudioContext was not allowed to start/i,
  /\[netlify-identity\] widget not loaded yet; queuing call/i,
];

function isAllowed(msg) {
  const text = String(msg || '');
  return ALLOW.some((re) => re.test(text));
}

async function main() {
  // Ensure dist exists
  if (!fs.existsSync('dist/index.html')) {
    console.error('[console-allowlist] dist/index.html not found. Run npm run build first.');
    process.exit(2);
  }

  // Start static server via entrypoint
  const entry = spawn('bash', ['-lc', 'SKIP_TUNNEL=1 ./docker-entrypoint.sh'], {
    env: { ...process.env, PORT: String(PORT), HOST: '127.0.0.1', WEBROOT: path.resolve('dist') },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let entryLogs = '';
  entry.stdout.on('data', (b) => (entryLogs += b.toString()));
  entry.stderr.on('data', (b) => (entryLogs += b.toString()));

  try {
    const ok = await waitPort({ host: HOST, port: PORT, timeout: 8000 });
    if (!ok) throw new Error('server did not open');

    // Optional head probe
    await new Promise((resolve) => {
      const req = http.get({ host: HOST, port: PORT, path: '/', timeout: 2000 }, (res) => {
        res.resume();
        resolve();
      });
      req.on('error', () => resolve());
      req.on('timeout', () => { try { req.destroy(); } catch {} resolve(); });
    });

    // Lazy import to avoid dependency when not running this test
    const { chromium } = require('playwright');
    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext();
    const page = await context.newPage();

  const logs = [];
    page.on('console', (msg) => {
      const text = msg.text();
      logs.push({ type: msg.type(), text });
    });
    page.on('pageerror', (err) => {
      const text = err && (err.stack || err.message) ? (err.stack || err.message) : String(err);
      logs.push({ type: 'pageerror', text });
    });
    page.on('requestfailed', (req) => {
      const f = req.failure();
      logs.push({ type: 'requestfailed', text: `${req.method()} ${req.url()} :: ${f && f.errorText}` });
    });
    page.on('response', async (res) => {
      try {
        const status = res.status();
        if (status >= 400) {
          logs.push({ type: 'http', text: `${status} ${res.url()}` });
        }
      } catch {}
    });

    await page.goto(`http://${HOST}:${PORT}/`, { waitUntil: 'load', timeout: 15000 });
    // Let the app run for a bit to emit errors
    await page.waitForTimeout(3000);

    await browser.close();

    const disallowed = logs.filter((l) => !isAllowed(l.text));

    if (disallowed.length) {
      console.error('❌ Disallowed console errors detected:');
      for (const l of disallowed) console.error(` - [${l.type}] ${l.text}`);
      console.error('\nAll logs (for context):');
      for (const l of logs) console.error(` * [${l.type}] ${l.text}`);
      process.exitCode = 1;
    } else {
      console.log('✅ Only allowlisted console errors observed.');
    }
  } catch (e) {
    console.error('❌ console-allowlist failed:', e && e.message ? e.message : e);
    console.error(entryLogs);
    process.exitCode = 1;
  } finally {
    try { entry.kill('SIGTERM'); } catch {}
  }
}

main();
