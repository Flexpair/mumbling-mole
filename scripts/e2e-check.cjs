/**
 * End-to-End Smoke Test für docker-entrypoint.sh + websockify
 *
 * Dieser Test prüft:
 * - Start des Entrypoint-Skripts (im local-Modus) bzw. laufenden Containers (im container-Modus)
 * - Öffnen des WebSocket-Ports :8081
 * - Funktion des Tunnels: WebSocket-Client <-> websockify <-> lokaler TCP-Echo-Server
 *   => gesendete Nachricht kommt unverändert zurück
 * - Sauberes Beenden (Entrypoint nur im local-Modus, Echo-Server immer)
 *
 * Dieser Test prüft NICHT:
 * - Business-Logik, Authentifizierung, TLS
 * - Stabilität/Langzeiteigenschaften
 * - Produktionsnetzwerke (Firewall, Routing, Compose)
 *
 * Aufruf:
 *   # Lokal im Dev-Container (startet Entry-Script selbst):
 *   node scripts/e2e-check.cjs
 *
 *   # In CI (Container läuft separat; nur Echo-Server + Prüfung):
 *   node scripts/e2e-check.cjs --mode=container
 */

const net = require('net');
const { spawn } = require('child_process');
const waitPort = require('wait-port');
const WebSocket = require('ws');

// Fest definierte Standard-Ports (per ENV überschreibbar)
const WS_PORT = Number(process.env.E2E_WS_PORT || 8081);   // WebSocket (websockify)
const TCP_PORT = Number(process.env.E2E_TCP_PORT || 5900); // lokaler Echo-Server
const TARGET_HOST = process.env.E2E_TARGET_HOST || '127.0.0.1';

// Modus: "local" (Default) oder "container"
const MODE = (process.argv.includes('--mode=container') ? 'container' : 'local');

let echoServer;
let entryProc;

function delay(ms) { return new Promise((r) => setTimeout(r, ms)); }

// TCP-Echo-Server starten
function startEchoServer() {
  return new Promise((resolve, reject) => {
    const server = net.createServer((socket) => {
      socket.on('data', (chunk) => socket.write(chunk)); // 1:1 Echo
    });
    server.once('error', reject);
    server.listen(TCP_PORT, TARGET_HOST, () => resolve(server));
  });
}

// Entrypoint nur im local-Modus starten (Container startet ihn in CI selbst)
function startEntrypointIfNeeded() {
  if (MODE !== 'local') {
    console.log('[e2e] container-Modus: Container/Entrypoint wird extern gestartet.');
    return;
  }
  entryProc = spawn('bash', ['-lc', './docker-entrypoint.sh'], {
    env: {
      ...process.env,
      // Entrypoint erwartet MUMBLE_SERVER; Port 8081 ist dort fest verdrahtet
      MUMBLE_SERVER: `${TARGET_HOST}:${TCP_PORT}`,
      PLAIN_TARGET: '1',          // WICHTIG: Echo-Server ist Plain TCP (kein TLS)
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
    // 1) Echo-Server starten und verfügbar machen
    echoServer = await startEchoServer();
    await waitPort({ host: TARGET_HOST, port: TCP_PORT, timeout: 5000 });

    // 2) Entrypoint ggf. starten (nur local)
    startEntrypointIfNeeded();

    // 3) Auf WebSocket-Port warten
    const wsOpen = await waitPort({ host: TARGET_HOST, port: WS_PORT, timeout: 8000 });
    if (!wsOpen) throw new Error('WebSocket-Port wurde nicht geöffnet');

    // 4) WebSocket-Roundtrip prüfen (Echo muss identisch sein)
    const ws = new WebSocket(`ws://${TARGET_HOST}:${WS_PORT}`);

    await new Promise((resolve, reject) => {
      const to = setTimeout(() => reject(new Error('WS Open Timeout')), 5000);
      ws.on('open', () => { clearTimeout(to); resolve(); });
      ws.on('error', reject);
    });

    const payload = Buffer.from('hello-e2e');
    const echoed = await new Promise((resolve, reject) => {
      const to = setTimeout(() => reject(new Error('WS Message Timeout')), 5000);
      ws.once('message', (data) => { clearTimeout(to); resolve(Buffer.from(data)); });
      ws.send(payload);
    });

    ws.close();

    if (!echoed.equals(payload)) {
      throw new Error('Echo-Payload stimmt nicht überein');
    }

    console.log('✅ E2E ok: Tunnel funktioniert (Echo identisch).');
    process.exitCode = 0;
  } catch (err) {
    console.error('❌ E2E fehlgeschlagen:', err && err.message ? err.message : err);
    process.exitCode = 1;
  } finally {
    // Aufräumen
    await stopEntrypointIfNeeded();
    if (echoServer) await new Promise((res) => echoServer.close(res));
    await delay(100);
  }
}

process.on('SIGINT', () => process.exit(130));
process.on('SIGTERM', () => process.exit(143));

main();
