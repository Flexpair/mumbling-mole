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
const http = require('http');
const { spawn, execFileSync } = require('child_process');
const waitPort = require('wait-port');
const WebSocket = require('ws');

// WS-Port von websockify: bevorzugt E2E_WS_PORT (Host-Port in CI), dann PORT/SMOKE_HTTP_PORT (Local)
const WS_PORT = Number(
  process.env.E2E_WS_PORT || process.env.PORT || process.env.SMOKE_HTTP_PORT || 8081
);
const TCP_PORT = Number(process.env.E2E_TCP_PORT || 5900);

// Der WS-Client soll lokal testen → 127.0.0.1 ist ok; überschreibbar
const CLIENT_HOST = process.env.E2E_TARGET_HOST || '127.0.0.1';
// Origin-Header für WS-Handshake (manche websockify-Setups prüfen dies)
const ORIGIN = process.env.E2E_ORIGIN || `http://${CLIENT_HOST}:${WS_PORT}`;

// WebSocket-Pfad:
// In vielen Setups funktioniert der Upgrade direkt auf der Root-URL ("/").
// Manche noVNC/Websockify-Deployments nutzen stattdessen "/websockify".
// Standard: Root-Pfad, mit Fallback auf "/websockify".
const WS_PATH_ENV = process.env.E2E_WS_PATH || process.env.WS_PATH || '';

// Echo-Server Bind-Host (alle Interfaces, damit Container zugreifen kann)
const BIND_HOST = process.env.E2E_BIND_HOST || '0.0.0.0';

// Modus: "local" (Default) oder "container"
const MODE = (process.argv.includes('--mode=container') ? 'container' : 'local');

let echoServer;
let entryProc;

function delay(ms) { return new Promise((r) => setTimeout(r, ms)); }

// TCP-Echo-Server starten (an 0.0.0.0 binden!)
function startEchoServer() {
  return new Promise((resolve, reject) => {
    const server = net.createServer((socket) => {
      socket.on('data', (chunk) => socket.write(chunk)); // 1:1 Echo
    });
    server.once('error', reject);
    server.listen(TCP_PORT, BIND_HOST, () => resolve(server));
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
      // websockify im Test soll Plain-TCP sprechen → PLAIN_TARGET=1
      MUMBLE_SERVER: `${CLIENT_HOST}:${TCP_PORT}`,
      PLAIN_TARGET: '1',
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

// Konnektivität vom Container zum Ziel prüfen (nur im container-Modus)
function checkTargetFromContainerIfPossible() {
  if (MODE !== 'container') return true;
  const container = process.env.E2E_CONTAINER_NAME || 'mm-e2e';
  const target = (process.env.MUMBLE_SERVER || `host.docker.internal:${TCP_PORT}`);
  const [host, portStr] = target.split(':');
  const portNum = Number(portStr || TCP_PORT);
  try {
    const cmd = `docker exec ${container} bash -lc 'cat </dev/null > /dev/tcp/${host}/${portNum} && echo OK || echo FAIL'`;
    const out = execFileSync('bash', ['-lc', cmd], { encoding: 'utf8' }).trim();
    if (!/OK/.test(out)) {
      console.log(`[e2e] Container kann Ziel ${host}:${portNum} nicht erreichen (out="${out}")`);
      return false;
    }
    console.log(`[e2e] Container-Konnektivität OK → ${host}:${portNum}`);
    return true;
  } catch (e) {
    console.log(`[e3e] Hinweis: Docker CLI/exec-Probe übersprungen oder fehlgeschlagen: ${e && e.message ? e.message : e}`);
    // Nicht fatal; wir machen weiter
    return true;
  }
}

async function main() {
  try {
    // 1) Echo-Server starten (an 0.0.0.0) und warten, bis Port offen ist
    echoServer = await startEchoServer();
    await waitPort({ host: CLIENT_HOST, port: TCP_PORT, timeout: 5000 });

    // 2) Entrypoint ggf. starten (nur local)
    startEntrypointIfNeeded();

    // 3) Auf WebSocket-Port warten (Client verbindet lokal auf 127.0.0.1)
    const wsOpen = await waitPort({ host: CLIENT_HOST, port: WS_PORT, timeout: 8000 });
    if (!wsOpen) throw new Error('WebSocket-Port wurde nicht geöffnet');

  // 3b) Konnektivität vom Container zum Ziel prüfen (wenn möglich)
  const containerOk = checkTargetFromContainerIfPossible();
  if (!containerOk) throw new Error('Container erreicht Ziel (MUMBLE_SERVER) nicht');

    // Optional: HTTP-Erreichbarkeit prüfen (statischer Inhalt via --web)
    await new Promise((resolve) => {
      const req = http.get({ host: CLIENT_HOST, port: WS_PORT, path: '/', timeout: 2000 }, (res) => {
        res.resume(); // Body verwerfen
        resolve();
      });
      req.on('error', () => resolve());
      req.on('timeout', () => { try { req.destroy(); } catch {} resolve(); });
    });

    // 4) WebSocket-Roundtrip prüfen (Echo muss identisch sein)
    // Versuche in Reihenfolge: expliziter Pfad (falls gesetzt), '/', '/websockify'
    const candidates = [];
    if (WS_PATH_ENV) candidates.push(WS_PATH_ENV);
    candidates.push('/');
    if (!candidates.includes('/websockify')) candidates.push('/websockify');

    let lastErr;
    let ok = false;
    const attempts = Number(process.env.E2E_WS_ATTEMPTS || 5);
    const openTimeoutMs = Number(process.env.E2E_WS_OPEN_TIMEOUT || 8000);
    for (let attempt = 1; attempt <= attempts && !ok; attempt++) {
      for (const p of candidates) {
        const norm = p.startsWith('/') ? p : '/' + p;
        const url = `ws://${CLIENT_HOST}:${WS_PORT}${norm}`;
        try {
          console.log(`[e2e] Versuch WS-Handshake (Try ${attempt}/${attempts}) auf Pfad: ${norm}`);
          const ws = new WebSocket(url, { perMessageDeflate: false, origin: ORIGIN });

          await new Promise((resolve, reject) => {
            const to = setTimeout(() => reject(new Error('WS Open Timeout')), openTimeoutMs);
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
          if (!echoed.equals(payload)) throw new Error('Echo-Payload stimmt nicht überein');
          console.log(`[e2e] WS-Handshake + Echo erfolgreich auf Pfad: ${norm}`);
          ok = true;
          break;
        } catch (e) {
          lastErr = e;
          console.log(`[e2e] WS auf Pfad ${p} fehlgeschlagen: ${e && e.message ? e.message : e}`);
        }
      }
      if (!ok) await delay(1000);
    }

    if (!ok) throw lastErr || new Error('WS Verbindung fehlgeschlagen');

    console.log('✅ E2E ok: Tunnel funktioniert (Echo identisch).');
    process.exitCode = 0;
  } catch (err) {
    console.error('❌ E2E fehlgeschlagen:', err && err.message ? err.message : err);
    process.exitCode = 1;
  } finally {
    await stopEntrypointIfNeeded();
    if (echoServer) await new Promise((res) => echoServer.close(res));
    await delay(100);
  }
}

process.on('SIGINT', () => process.exit(130));
process.on('SIGTERM', () => process.exit(143));

main();
