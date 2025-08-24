

/**
 * Minimaler E2E-Test für Node 16: TCP-Echo-Server <-> websockify <-> WebSocket-Client
 * Exit-Code 0 = OK, 1 = Fehler (CI-tauglich)
 *
 * Dieser Test prüft:
 * - Start des Entrypoint-Skripts mit ENV-Variablen
 * - Öffnen des WebSocket-Ports (WS_SOURCE_PORT)
 * - Funktion des Tunnels: WebSocket-Client <-> websockify <-> lokaler TCP-Echo-Server
 *   => gesendete Nachricht kommt unverändert zurück
 * - Sauberes Beenden von Entrypoint und Echo-Server
 *
 * Dieser Test prüft NICHT:
 * - Business-Logik der Anwendung
 * - Authentifizierung, TLS, Security
 * - Stabilität oder Verhalten unter Last
 * - Produktionsumgebung (Netzwerk, Firewall, Docker Compose)
 *
 * Ziel: Einfacher Smoke-Test, um sicherzustellen,
 * dass die wesentliche Tunnel-Funktion grundsätzlich arbeitet.
 */


const net = require('net');
const { spawn } = require('child_process');
const waitPort = require('wait-port');
const WebSocket = require('ws');

const WS_PORT = Number(process.env.E2E_WS_PORT || 8081);   // WebSocket (websockify)
const TCP_PORT = Number(process.env.E2E_TCP_PORT || 5900); // lokaler Echo-Server
const TARGET_HOST = process.env.E2E_TARGET_HOST || '127.0.0.1';

let echoServer;
let entryProc;

function startEchoServer() {
  return new Promise((resolve, reject) => {
    const server = net.createServer((socket) => {
      socket.on('data', (chunk) => socket.write(chunk)); // Echo 1:1
    });
    server.once('error', reject);
    server.listen(TCP_PORT, TARGET_HOST, () => resolve(server));
  });
}

function startEntrypoint() {
  // Startet dein docker-entrypoint.sh wie in Produktion
  entryProc = spawn('bash', ['-lc', './docker-entrypoint.sh'], {
    env: {
      ...process.env,
      WS_SOURCE_PORT: String(WS_PORT),
      WS_TARGET_ADDR: TARGET_HOST,
      WS_TARGET_PORT: String(TCP_PORT),
      TINI_SUBREAPER: '1'
    },
    stdio: 'inherit'
  });
}

function stopEntrypoint() {
  return new Promise((resolve) => {
    if (!entryProc) return resolve();
    try { entryProc.kill('SIGTERM'); } catch {}
    setTimeout(() => { try { entryProc.kill('SIGKILL'); } catch {} ; resolve(); }, 500);
  });
}

function delay(ms) { return new Promise((r) => setTimeout(r, ms)); }

async function main() {
  try {
    // 1) Echo-Server starten
    echoServer = await startEchoServer();
    await waitPort({ host: TARGET_HOST, port: TCP_PORT, timeout: 5000 });

    // 2) Entrypoint (websockify) starten
    startEntrypoint();

    // 3) Auf WebSocket-Port warten
    const wsOpen = await waitPort({ host: TARGET_HOST, port: WS_PORT, timeout: 8000 });
    if (!wsOpen) throw new Error('WebSocket-Port wurde nicht geöffnet');

    // 4) Verbindung prüfen (Echo muss identisch zurückkommen)
    const ws = new WebSocket(`ws://${TARGET_HOST}:${WS_PORT}`);

    await new Promise((resolve, reject) => {
      const to = setTimeout(() => reject(new Error('WS open timeout')), 5000);
      ws.on('open', () => { clearTimeout(to); resolve(); });
      ws.on('error', reject);
    });

    const payload = Buffer.from('hello-e2e');
    const echoed = await new Promise((resolve, reject) => {
      const to = setTimeout(() => reject(new Error('WS message timeout')), 5000);
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
    await stopEntrypoint();
    if (echoServer) await new Promise((res) => echoServer.close(res));
    await delay(100);
  }
}

process.on('SIGINT', () => process.exit(130));
process.on('SIGTERM', () => process.exit(143));

main();
