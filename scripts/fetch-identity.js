#!/usr/bin/env node
// Fetch the Netlify Identity widget UMD bundle at build time so we can serve it locally (no CDN at runtime).
// Keeps CI stable (no git dep) and avoids race conditions because we include it before our app bundle.

const https = require('https');
const fs = require('fs');
const path = require('path');

const VERSION = process.env.NETLIFY_IDENTITY_VERSION || '1.9.2';
const URL = `https://cdn.jsdelivr.net/npm/netlify-identity-widget@${VERSION}/build/netlify-identity-widget.js`;
const outDir = path.join(__dirname, '..', 'app');
const outFile = path.join(outDir, 'netlify-identity-widget.js');

if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

function fetch(url, dest) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest);
    https.get(url, (res) => {
      if (res.statusCode !== 200) {
        file.close(() => fs.unlink(dest, () => {}));
        return reject(new Error(`HTTP ${res.statusCode} fetching ${url}`));
      }
      res.pipe(file);
      file.on('finish', () => file.close(resolve));
    }).on('error', (err) => {
      file.close(() => fs.unlink(dest, () => {}));
      reject(err);
    });
  });
}

fetch(URL, outFile)
  .then(() => {
    console.log(`Fetched Netlify Identity widget -> ${path.relative(process.cwd(), outFile)}`);
  })
  .catch((err) => {
    console.error('Failed to fetch Netlify Identity widget:', err.message || err);
    process.exit(1);
  });
