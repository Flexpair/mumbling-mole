#!/usr/bin/env node
// Clone or update the Flexpair fork of netlify-identity-widget into vendor/
// so webpack can alias to its src for bundling. This keeps package.json source/version intact.
const { execSync } = require('child_process');
const { existsSync, mkdirSync } = require('fs');
const { join } = require('path');

const repo = 'https://github.com/Flexpair/netlify-identity-widget.git';
const branch = 'master';
const vendorDir = join(__dirname, '..', 'vendor');
const targetDir = join(vendorDir, 'netlify-identity-widget');

function run(cmd, cwd) {
  execSync(cmd, { stdio: 'inherit', cwd: cwd || process.cwd() });
}

try {
  if (!existsSync(vendorDir)) mkdirSync(vendorDir, { recursive: true });
  if (!existsSync(targetDir)) {
    run(`git clone --depth 1 --branch ${branch} ${repo} ${targetDir}`);
  } else {
    // Update existing checkout
    run('git fetch origin', targetDir);
    run(`git checkout ${branch}`, targetDir);
    run('git pull --ff-only', targetDir);
  }
  // Sanity check: ensure src exists
  if (!existsSync(join(targetDir, 'src', 'netlify-identity.js'))) {
    console.error('[fetch-netlify-identity] src/netlify-identity.js not found');
    process.exit(2);
  }
  console.log('[fetch-netlify-identity] Ready at', targetDir);
} catch (e) {
  console.error('[fetch-netlify-identity] failed:', e.message || e);
  // Don't hard fail global installs; exit non-zero so CI notices if necessary
  process.exit(1);
}
