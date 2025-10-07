/**
 * Audio Monitor - Echtzeit-Überwachung von Audio-Streams
 *
 * Verbindet sich zum Mumble-Server und zeigt kontinuierlich
 * Audio-Statistiken an (ähnlich wie ein VU-Meter).
 *
 * Aufruf:
 *   node scripts/audio-monitor.cjs
 *
 * Umgebungsvariablen:
 *   MUMBLE_SERVER     - Server-Adresse (z.B. localhost:64738)
 *   MUMBLE_USERNAME   - Benutzername (default: AudioMonitor)
 *   REFRESH_RATE      - Update-Intervall in ms (default: 100)
 */

const MumbleClient = require('../vendors/mumble-client');

const SERVER = process.env.MUMBLE_SERVER || 'localhost:64738';
const USERNAME = process.env.MUMBLE_USERNAME || 'AudioMonitor';
const PASSWORD = process.env.MUMBLE_PASSWORD || '';
const REFRESH_RATE = Number(process.env.REFRESH_RATE || 100);

// Audio-Metriken
const metrics = {
  totalPackets: 0,
  totalBytes: 0,
  packetsPerSecond: 0,
  bytesPerSecond: 0,
  activeUsers: new Map(), // userId -> { name, lastPacket, packets, bytes, avgAmplitude }
  lastUpdate: Date.now(),
  lastPacketCount: 0,
  lastByteCount: 0
};

// Terminal-Steuerung
const ESC = '\x1B';
const CLEAR_SCREEN = `${ESC}[2J`;
const CURSOR_HOME = `${ESC}[H`;
const CLEAR_LINE = `${ESC}[K`;

function clearScreen() {
  process.stdout.write(CLEAR_SCREEN + CURSOR_HOME);
}

function moveCursor(row, col) {
  process.stdout.write(`${ESC}[${row};${col}H`);
}

// VU-Meter Bar erstellen
function createBar(value, max, length = 40) {
  const filled = Math.round((value / max) * length);
  const empty = length - filled;
  
  let bar = '';
  let color = '\x1B[32m'; // Grün
  
  if (value / max > 0.8) {
    color = '\x1B[31m'; // Rot bei > 80%
  } else if (value / max > 0.6) {
    color = '\x1B[33m'; // Gelb bei > 60%
  }
  
  bar = color + '█'.repeat(filled) + '\x1B[0m' + '░'.repeat(empty);
  return bar;
}

// Format Bytes
function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

// Uptime formatieren
function formatUptime(ms) {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  
  if (hours > 0) {
    return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
  } else if (minutes > 0) {
    return `${minutes}m ${seconds % 60}s`;
  }
  return `${seconds}s`;
}

// UI rendern
function renderUI(startTime) {
  const now = Date.now();
  const uptime = now - startTime;
  
  // Berechne Rate (Pakete/s, Bytes/s)
  const timeDelta = now - metrics.lastUpdate;
  if (timeDelta >= 1000) {
    const packetDelta = metrics.totalPackets - metrics.lastPacketCount;
    const byteDelta = metrics.totalBytes - metrics.lastByteCount;
    
    metrics.packetsPerSecond = Math.round((packetDelta / timeDelta) * 1000);
    metrics.bytesPerSecond = Math.round((byteDelta / timeDelta) * 1000);
    
    metrics.lastPacketCount = metrics.totalPackets;
    metrics.lastByteCount = metrics.totalBytes;
    metrics.lastUpdate = now;
  }
  
  clearScreen();
  
  // Header
  console.log('╔═══════════════════════════════════════════════════════════════════════════╗');
  console.log('║                        MUMBLE AUDIO MONITOR                               ║');
  console.log('╚═══════════════════════════════════════════════════════════════════════════╝');
  console.log('');
  
  // Verbindungsinfo
  console.log(`Server:   ${SERVER}`);
  console.log(`Uptime:   ${formatUptime(uptime)}`);
  console.log(`Username: ${USERNAME}`);
  console.log('');
  
  // Globale Statistiken
  console.log('─────────────────────────────── Global Stats ─────────────────────────────────');
  console.log(`Total Packets:    ${metrics.totalPackets.toString().padEnd(10)} | Rate: ${metrics.packetsPerSecond} pkt/s`);
  console.log(`Total Bytes:      ${formatBytes(metrics.totalBytes).padEnd(10)} | Rate: ${formatBytes(metrics.bytesPerSecond)}/s`);
  console.log(`Active Users:     ${metrics.activeUsers.size}`);
  console.log('');
  
  // User-spezifische Stats
  if (metrics.activeUsers.size > 0) {
    console.log('────────────────────────────── Active Users ──────────────────────────────────');
    console.log('');
    
    // Sortiere nach letztem Paket-Zeitstempel
    const sortedUsers = Array.from(metrics.activeUsers.values())
      .sort((a, b) => b.lastPacket - a.lastPacket)
      .slice(0, 10); // Zeige max 10 User
    
    sortedUsers.forEach(user => {
      const timeSinceLastPacket = now - user.lastPacket;
      const isActive = timeSinceLastPacket < 1000;
      const indicator = isActive ? '🔊' : '  ';
      
      console.log(`${indicator} ${user.name.padEnd(20)} ${CLEAR_LINE}`);
      
      // Amplitude Bar
      const ampBar = createBar(user.avgAmplitude, 1.0, 30);
      console.log(`   Amplitude: [${ampBar}] ${(user.avgAmplitude * 100).toFixed(1)}%`);
      
      // Statistiken
      console.log(`   Packets: ${user.packets.toString().padEnd(6)} | Bytes: ${formatBytes(user.bytes).padEnd(10)} | Last: ${timeSinceLastPacket}ms ago`);
      console.log('');
    });
  } else {
    console.log('────────────────────────── Waiting for Audio... ─────────────────────────────');
    console.log('');
    console.log('  Keine Audio-Pakete empfangen.');
    console.log('  Verbinde einen Client und spreche, um Audio zu sehen.');
    console.log('');
  }
  
  // Footer
  console.log('──────────────────────────────────────────────────────────────────────────────');
  console.log('Drücke Ctrl+C zum Beenden');
}

// Audio-Analyse
function analyzeAudioPacket(pcmData) {
  if (!pcmData || pcmData.length === 0) return 0;
  
  let sum = 0;
  for (let i = 0; i < pcmData.length; i++) {
    sum += Math.abs(pcmData[i]);
  }
  
  return sum / pcmData.length;
}

// Hauptprogramm
async function startMonitor() {
  const [host, portStr] = SERVER.split(':');
  const port = parseInt(portStr || '64738', 10);
  const startTime = Date.now();
  
  console.log('Verbinde zu Mumble-Server...');
  
  MumbleClient(host, port, {
    username: USERNAME,
    password: PASSWORD,
    codecs: ['Opus']
  }, (err, client) => {
    if (err) {
      console.error('❌ Verbindungsfehler:', err.message);
      process.exit(1);
    }
    
    console.log('✅ Verbunden!');
    console.log('Starte Monitoring...\n');
    
    // Initial render
    setTimeout(() => renderUI(startTime), 100);
    
    // Periodisches UI-Update
    const uiInterval = setInterval(() => {
      renderUI(startTime);
    }, REFRESH_RATE);
    
    // Voice-Event-Handler
    client.on('voice', (voicePacket) => {
      metrics.totalPackets++;
      
      if (voicePacket.pcm) {
        const bytes = voicePacket.pcm.byteLength;
        metrics.totalBytes += bytes;
        
        const userId = voicePacket.user.id;
        const userName = voicePacket.user.name;
        
        // Update oder erstelle User-Eintrag
        if (!metrics.activeUsers.has(userId)) {
          metrics.activeUsers.set(userId, {
            name: userName,
            lastPacket: Date.now(),
            packets: 0,
            bytes: 0,
            avgAmplitude: 0,
            amplitudeHistory: []
          });
        }
        
        const user = metrics.activeUsers.get(userId);
        user.lastPacket = Date.now();
        user.packets++;
        user.bytes += bytes;
        
        // Berechne Amplitude
        const amplitude = analyzeAudioPacket(voicePacket.pcm);
        user.amplitudeHistory.push(amplitude);
        
        // Behalte nur die letzten 10 Messungen
        if (user.amplitudeHistory.length > 10) {
          user.amplitudeHistory.shift();
        }
        
        // Durchschnittliche Amplitude
        user.avgAmplitude = user.amplitudeHistory.reduce((a, b) => a + b, 0) / user.amplitudeHistory.length;
      }
    });
    
    // Fehlerbehandlung
    client.on('error', (err) => {
      console.error('\n❌ Client-Fehler:', err.message);
    });
    
    // Cleanup bei Exit
    process.on('SIGINT', () => {
      clearInterval(uiInterval);
      clearScreen();
      console.log('\n👋 Monitoring beendet.\n');
      console.log('Zusammenfassung:');
      console.log(`  Gesamtpakete: ${metrics.totalPackets}`);
      console.log(`  Gesamtbytes:  ${formatBytes(metrics.totalBytes)}`);
      console.log(`  Users:        ${metrics.activeUsers.size}`);
      console.log('');
      
      try {
        client.disconnect();
      } catch (e) {
        // Ignoriere Fehler beim Trennen
      }
      
      process.exit(0);
    });
  });
}

// Start
startMonitor().catch(err => {
  console.error('Fehler:', err);
  process.exit(1);
});
