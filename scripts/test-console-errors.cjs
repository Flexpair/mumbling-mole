#!/usr/bin/env node
/*
 * Browser console error guard test.
 * Goal: Fail if any console.error OR uncaught error appears while loading the built app
 * inside a controlled headless browser.
 *
 * Steps:
 * 1. Ensure build exists (run build if needed)
 * 2. Start a static server (python http.server) on random free port
 * 3. Launch puppeteer, capture page console + pageerror events
 * 4. Navigate to index page, wait for network idle
 * 5. Optionally poke basic runtime (call a KO observable render tick)
 * 6. Report any collected errors (excluding known benign warnings if required) and exit non-zero if any
 */

const { spawn } = require('child_process');
const http = require('http');
const net = require('net');
const path = require('path');
const fs = require('fs');

async function findFreePort(base = 18080) {
  function tryPort(p) {
    return new Promise((resolve) => {
      const srv = net.createServer();
      srv.once('error', () => resolve(false));
      srv.once('listening', () => srv.close(() => resolve(p)));
      srv.listen(p, '127.0.0.1');
    });
  }
  for (let p = base; p < base + 200; p++) {
    const ok = await tryPort(p);
    if (ok) return ok;
  }
  throw new Error('No free port in range');
}

async function ensureBuild() {
  if (!fs.existsSync(path.join(__dirname, '..', 'dist', 'index.html'))) {
    console.log('[console-test] dist missing → running build');
    await runCmd('npm', ['run', 'build']);
  }
}

function runCmd(cmd, args, opts={}) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { stdio: 'inherit', ...opts });
    child.on('exit', (code) => code === 0 ? resolve() : reject(new Error(cmd + ' ' + args.join(' ') + ' failed')));
  });
}

async function run() {
  await ensureBuild();
  const port = await findFreePort();
  const webroot = path.join(__dirname, '..', 'dist');

  console.log('[console-test] Serving dist on :' + port);
  const server = spawn('python3', ['-m', 'http.server', String(port), '--bind', '127.0.0.1'], { cwd: webroot, stdio: 'ignore' });

  let serverExited = false;
  server.on('exit', () => { serverExited = true; });

  // Wait until server responds
  await new Promise((resolve, reject) => {
    const start = Date.now();
    (function poll() {
      const req = http.get({ host: '127.0.0.1', port, path: '/' }, (res) => { res.resume(); resolve(); });
      req.on('error', (e) => {
        if (Date.now() - start > 8000) return reject(e);
        setTimeout(poll, 250);
      });
    })();
  });

  const { chromium } = require('playwright');
  let browser;
  try {
    browser = await chromium.launch({ headless: true, args: ['--no-sandbox','--disable-setuid-sandbox'] });
  } catch (e) {
    const msg = String(e && e.message || e);
    if (/Executable doesn't exist|error while loading shared libraries|cannot open shared object file/i.test(msg)) {
      const force = process.env.CI_FORCE_BROWSER === '1';
      const note = '[console-test] ' + (force ? 'FAIL (missing headless browser)' : 'SKIP') + ': Headless browser unavailable (' + msg.split('\n')[0] + ')';
      if (force) {
        console.error(note);
        server.kill('SIGTERM');
        process.exit(1);
      } else {
        console.warn(note);
        server.kill('SIGTERM');
        return; // skip gracefully
      }
    }
    throw e; // rethrow unexpected errors
  }
  const page = await browser.newPage();

  const errors = [];
  page.on('console', msg => {
    if (msg.type() === 'error') {
      errors.push('[console.error] ' + msg.text());
    }
  });
  page.on('pageerror', err => errors.push('[pageerror] ' + err.message));

  // Timeout safety
  const navTimeout = 15000;
  try {
    await page.goto(`http://127.0.0.1:${port}/index.html`, { waitUntil: 'networkidle2', timeout: navTimeout });
  } catch (e) {
    errors.push('[navigation] ' + e.message);
  }

  // Small runtime probe (evaluate knockout presence)
  try {
    await page.evaluate(() => {
      if (!window.ko) throw new Error('Knockout not available');
    });
  } catch (e) {
    errors.push('[runtime] ' + e.message);
  }

  await browser.close();
  server.kill('SIGTERM');
  if (serverExited) {
    console.warn('[console-test] Static server exited early');
  }

  if (errors.length) {
    console.error('\n[console-test] FAIL: JavaScript errors detected:');
    for (const e of errors) console.error('  ' + e);
    process.exit(1);
  }

  console.log('[console-test] PASS: no console/page errors');
}

run().catch(e => { console.error('[console-test] Unexpected failure:', e); process.exit(1); });
