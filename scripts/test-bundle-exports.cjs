#!/usr/bin/env node
/**
 * Detects the runtime error "ReferenceError: exports is not defined" when loading the production bundle.
 * - Ensures a fresh build (unless SKIP_BUILD=1)
 * - Serves ./dist via a tiny static server (python http.server)
 * - Launches Chromium via Playwright
 * - Fails with explicit message if the error occurs (or any pageerror if STRICT=1)
 */

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const net = require('net');

async function findPort(start=19100){
  function tryP(p){
    return new Promise(res=>{ const s=net.createServer(); s.once('error',()=>res(false)); s.listen(p,'127.0.0.1',()=>s.close(()=>res(p))); });
  }
  for (let p=start;p<start+200;p++){ const ok=await tryP(p); if(ok) return ok; }
  throw new Error('No free port for test server');
}

function run(cmd,args,opts={}){
  return new Promise((resolve,reject)=>{
    const c=spawn(cmd,args,{stdio:'inherit',...opts});
    c.on('exit',code=> code===0?resolve():reject(new Error(cmd+' '+args.join(' ')+' exit '+code)) );
  });
}

(async function main(){
  try {
    if (process.env.SKIP_BUILD !== '1') {
      if (!fs.existsSync(path.join(__dirname,'..','dist','index.html'))) {
        await run('npm',['run','build']);
      }
    }
    const port = await findPort();
    const webroot = path.join(__dirname,'..','dist');
    const server = spawn('python3',['-m','http.server',String(port),'--bind','127.0.0.1','--directory',webroot],{stdio:'ignore'});

    // Wait for server
    await new Promise((res,rej)=>{
      let tries=0; (function poll(){
        const sock = net.connect(port,'127.0.0.1',()=>{ sock.destroy(); res(); });
        sock.on('error',()=>{ if(++tries>40) return rej(new Error('Server start timeout')); setTimeout(poll,150); });
      })();
    });

    const { chromium } = require('playwright');
    const browser = await chromium.launch({headless:true,args:['--no-sandbox']});
    const page = await browser.newPage();
    const errors = [];
    page.on('pageerror', e => errors.push('[pageerror] '+e.message));
    page.on('console', m => { if (m.type()==='error') errors.push('[console] '+m.text()); });

    await page.goto(`http://127.0.0.1:${port}/index.html`, { waitUntil: 'load', timeout: 15000 });

    await browser.close();
    server.kill('SIGTERM');

    const exportsErr = errors.find(e=>/exports is not defined/i.test(e));
    if (exportsErr) {
      console.error('\n[detect-exports] FAIL: Detected runtime error:', exportsErr);
      process.exit(1);
    }
    if (process.env.STRICT === '1' && errors.length) {
      console.error('\n[detect-exports] FAIL: Other runtime errors detected:\n'+errors.join('\n'));
      process.exit(1);
    }
    console.log('[detect-exports] PASS: No "exports is not defined" runtime error');
  } catch (e) {
    console.error('[detect-exports] Unexpected failure:', e && e.message ? e.message : e);
    process.exit(2);
  }
})();
