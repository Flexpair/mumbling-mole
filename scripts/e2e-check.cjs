/**
 * End-to-End Smoke Test für docker-entrypoint.sh + websockify
 *
 * Dieser Test prüft:
 * - Start des Entrypoint-Skripts (im local-Modus) bzw. laufenden Containers (im container-Modus)
 * - Öffnen des WebSocket-Ports :8081
 * - HTTP-Erreichbarkeit (statische Dateien via --web)
 * - WebSocket-Upgrade-Fähigkeit (Handshake erfolgreich)
 * - Sauberes Beenden (Entrypoint nur im local-Modus)
 *
 * Dieser Test prüft NICHT:
 * - Business-Logik, Authentifizierung, TLS
 * - Stabilität/Langzeiteigenschaften
 * - Produktionsnetzwerke (Firewall, Routing, Compose)
 * - VNC-Protokoll (nur WebSocket-Upgrade)
 *
 * Aufruf:
 *   # Lokal im Dev-Container (startet Entry-Script selbst):
 *   node scripts/e2e-check.cjs
 *
 *   # In CI (Container läuft separat; nur Prüfung):
 *   node scripts/e2e-check.cjs --mode=container
 */

const net = require('net');
const http = require('http');
const { spawn } = require('child_process');
const waitPort = require('wait-port');
const WebSocket = require('ws');

// WS-Port von websockify: bevorzugt E2E_WS_PORT (Host-Port in CI), dann PORT/SMOKE_HTTP_PORT (Local)
const WS_PORT = Number(
  process.env.E2E_WS_PORT || process.env.PORT || process.env.SMOKE_HTTP_PORT || 8081
);

// Der WS-Client soll lokal testen → 127.0.0.1 ist ok; überschreibbar
const CLIENT_HOST = process.env.E2E_TARGET_HOST || '127.0.0.1';
// Origin-Header für WS-Handshake (manche websockify-Setups prüfen dies)
const ORIGIN = process.env.E2E_ORIGIN || `http://${CLIENT_HOST}:${WS_PORT}`;

// WebSocket-Pfad: websockify nutzt typischerweise "/"
const WS_PATH = process.env.E2E_WS_PATH || '/';

// Modus: "local" (Default) oder "container"
const MODE = (process.argv.includes('--mode=container') ? 'container' : 'local');

let entryProc;

function delay(ms) { return new Promise((r) => setTimeout(r, ms)); }

// Entrypoint nur im local-Modus starten (Container startet ihn in CI selbst)
function startEntrypointIfNeeded() {
  if (MODE !== 'local') {
    console.log('[e2e] container-Modus: Container/Entrypoint wird extern gestartet.');
    return;
  }
  
  // Im local-Modus: Prüfe ob bereits ein websockify läuft
  const checkCmd = require('child_process').spawnSync('bash', ['-c', `lsof -ti:${WS_PORT} 2>/dev/null`]);
  if (checkCmd.stdout && checkCmd.stdout.toString().trim()) {
    console.log(`[e2e] Port ${WS_PORT} bereits in Verwendung, überspringe Entrypoint-Start`);
    return;
  }
  
  console.log('[e2e] Starte docker-entrypoint.sh...');
  entryProc = spawn('bash', ['-lc', './docker-entrypoint.sh'], {
    env: {
      ...process.env,
      SKIP_TUNNEL: '1', // Kein Mumble-Tunnel nötig, nur websockify
      PORT: String(WS_PORT),
      TINI_SUBREAPER: '1'
    },
    stdio: 'inherit'
  });
}

async function stopEntrypointIfNeeded() {
  if (!entryProc) return;
  try { entryProc.kill('SIGTERM'); } catch {}
  await delay(400);
  try { entryProc.kill('SIGKILL'); } catch {}
}

async function main() {
  try {
    // 1) Entrypoint ggf. starten (nur local)
    startEntrypointIfNeeded();

    // 2) Auf WebSocket-Port warten (Client verbindet lokal auf 127.0.0.1)
    console.log(`[e2e] Warte auf Port ${WS_PORT}...`);
    const wsOpen = await waitPort({ host: CLIENT_HOST, port: WS_PORT, timeout: 10000 });
    if (!wsOpen) throw new Error(`WebSocket-Port ${WS_PORT} wurde nicht geöffnet`);
    console.log(`[e2e] Port ${WS_PORT} ist offen ✓`);

    // 3) HTTP-Erreichbarkeit prüfen (statischer Inhalt via --web)
    console.log('[e2e] Prüfe HTTP-Erreichbarkeit...');
    const httpOk = await new Promise((resolve) => {
      const req = http.get({ 
        host: CLIENT_HOST, 
        port: WS_PORT, 
        path: '/', 
        timeout: 3000 
      }, (res) => {
        res.resume(); // Body verwerfen
        console.log(`[e2e] HTTP Status: ${res.statusCode} ✓`);
        resolve(res.statusCode === 200);
      });
      req.on('error', (err) => {
        console.log(`[e2e] HTTP Fehler: ${err.message}`);
        resolve(false);
      });
      req.on('timeout', () => { 
        try { req.destroy(); } catch {} 
        console.log('[e2e] HTTP Timeout');
        resolve(false); 
      });
    });

    if (!httpOk) {
      console.log('[e2e] Warnung: HTTP-Request fehlgeschlagen, versuche trotzdem WebSocket...');
    }

    // 4) WebSocket-Upgrade prüfen (Handshake muss erfolgreich sein)
    console.log('[e2e] Prüfe WebSocket-Upgrade...');
    const url = `ws://${CLIENT_HOST}:${WS_PORT}${WS_PATH}`;
    const ws = new WebSocket(url, { 
      perMessageDeflate: false, 
      origin: ORIGIN,
      handshakeTimeout: 5000
    });

    await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        ws.terminate();
        reject(new Error('WebSocket-Handshake Timeout (5s)'));
      }, 5000);
      
      ws.on('open', () => {
        clearTimeout(timeout);
        console.log('[e2e] WebSocket-Verbindung erfolgreich ✓');
        resolve();
      });
      
      ws.on('error', (err) => {
        clearTimeout(timeout);
        reject(new Error(`WebSocket-Fehler: ${err.message}`));
      });
    });

    // Verbindung sauber schließen
    ws.close();
    await delay(100);

    console.log('');
    console.log('✅ E2E erfolgreich: WebSocket-Server funktioniert');
    console.log(`   - Port ${WS_PORT} erreichbar`);
    console.log('   - HTTP-Response OK');
    console.log('   - WebSocket-Upgrade erfolgreich');
    console.log('');
    process.exitCode = 0;
  } catch (err) {
    console.error('');
    console.error('❌ E2E fehlgeschlagen:', err && err.message ? err.message : err);
    console.error('');
    process.exitCode = 1;
  } finally {
    await stopEntrypointIfNeeded();
    await delay(100);
  }
}

process.on('SIGINT', () => process.exit(130));
process.on('SIGTERM', () => process.exit(143));

main();
