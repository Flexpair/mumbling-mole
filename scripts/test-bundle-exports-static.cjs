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

    // Quick lexical guard: if no raw "exports" token (not part of a string) present we skip heavy VM exec
    if (!/\bexports\b/.test(code)) {
      console.log('[bundle-static] PASS: no literal "exports" token in bundle');
      process.exit(0);
    }

    // Create a sandbox with minimal browser-like globals (prevent CJS globals)
    const sandbox = {
      window: {},
      document: { createElement(){return { getContext(){}, style:{} };}, body:{ appendChild(){}, removeChild(){} }, querySelector(){ return null; } },
      navigator: { language:'en-US', mediaDevices:{ enumerateDevices: async()=>[] } },
      console,
      setTimeout, clearTimeout,
      // Intentionally DO NOT define exports / module / require
    };
    vm.createContext(sandbox);

    let threwExportsRef = false;
    try {
      // Execute only a limited slice first to catch early top-level references quickly
      const slice = code.slice(0, 20000); // first 20k chars
      vm.runInContext(slice, sandbox, { timeout: 3000 });
    } catch (e) {
      if (/exports is not defined/.test(String(e))) threwExportsRef = true; else {
        // Ignore other errors (could be due to window/document deeper usage); try a narrower regex approach
      }
    }

    if (!threwExportsRef) {
      // Fallback regex heuristic: look for pattern where webpack would normally wrap a module but isn't
      const suspicious = /(^|[^\.])exports\s*=/m.test(code) && !/var exports =/m.test(code);
      if (suspicious) {
        console.error('[bundle-static] FAIL heuristic: suspicious top-level exports assignment');
        process.exit(1);
      }
      console.log('[bundle-static] PASS: no early runtime ReferenceError for exports');
      process.exit(0);
    } else {
      console.error('[bundle-static] FAIL: runtime ReferenceError("exports is not defined") detected (early slice).');
      process.exit(1);
    }
  } catch (e) {
    console.error('[bundle-static] Unexpected failure:', e && e.message ? e.message : e);
    process.exit(2);
  }
})();
