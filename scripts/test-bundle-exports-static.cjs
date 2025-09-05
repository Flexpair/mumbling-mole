#!/usr/bin/env node
/**
 * Static pre-docker detector for "ReferenceError: exports is not defined".
 * Strategy:
 *  - Ensure build (dist/index.js) exists (runs `npm run build` if missing unless SKIP_BUILD=1)
 *  - Load bundle into a VM context emulating a browser-ish global (window, document, navigator)
 *  - Execute only the first chunk of the bundle (or full) and capture ReferenceError about `exports`
 *  - Fail fast if detected; succeed otherwise.
 *  NOTE: This is a heuristic to catch accidental top-level CommonJS references in an ESM/module script.
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

(async function main(){
  try {
    const distDir = path.join(__dirname,'..','dist');
    const indexFile = path.join(distDir,'index.js');
    if (!fs.existsSync(indexFile)) {
      if (process.env.SKIP_BUILD === '1') {
        console.error('[bundle-static] dist/index.js missing and SKIP_BUILD=1 set. Abort.');
        process.exit(2);
      }
      console.log('[bundle-static] dist missing → building');
      require('child_process').execSync('npm run build',{stdio:'inherit'});
    }
    const code = fs.readFileSync(indexFile,'utf8');

    // Minimal DOM / Web APIs stubs so the bundle can execute far enough to surface an exports error
    const noop = () => {};
    const fakeEl = () => ({
      getContext: noop,
      style: {},
      appendChild: noop,
      removeChild: noop,
      setAttribute: noop,
      addEventListener: noop,
      getElementsByTagName: () => [],
      querySelector: () => null,
    });

    const sandbox = {
      window: {},
      document: {
        createElement: fakeEl,
        body: { appendChild: noop, removeChild: noop },
        querySelector: () => null,
        getElementById: () => fakeEl(),
      },
      navigator: { language:'en-US', mediaDevices:{ enumerateDevices: async()=>[] } },
      AudioContext: function(){},
      webkitAudioContext: function(){},
      Blob: function() {},
      URL: { createObjectURL: () => 'blob://mock' },
      console,
      setTimeout, clearTimeout,
      // Intentionally DO NOT define exports/module/require to catch incorrect assumptions
    };
    sandbox.window = sandbox; // window===global simulation
    vm.createContext(sandbox);

    let exportedError = null;
    try {
      vm.runInContext(code, sandbox, { timeout: 8000, displayErrors: false });
    } catch (e) {
      if (/exports is not defined/.test(String(e))) exportedError = e; else {
        // Non-exports errors are ignored; we only fail fast for the target symptom.
      }
    }

    if (exportedError) {
      console.error('[bundle-static] FAIL: runtime ReferenceError("exports is not defined") detected.');
      process.exit(1);
    }

    // Secondary lexical heuristic (helpful if future refactors short‑circuit before throwing)
    if (/\bexports\b/.test(code) && /(^|[^\.])exports\s*=\s*/m.test(code) && !/var exports\s*=/.test(code)) {
      console.error('[bundle-static] FAIL heuristic: suspicious top-level exports assignment');
      process.exit(1);
    }

    console.log('[bundle-static] PASS: no ReferenceError for exports during full bundle execution');
    process.exit(0);
  } catch (e) {
    console.error('[bundle-static] Unexpected failure:', e && e.message ? e.message : e);
    process.exit(2);
  }
})();
