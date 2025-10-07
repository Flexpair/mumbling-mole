/**
 * Audio-Roundtrip-Test für Mumble-Client
 *
 * Dieser Test prüft:
 * - Verbindung zum Mumble-Server
 * - Senden von synthetischen Audio-Daten (Testtöne)
 * - Empfang von Audio-Daten vom Server
 * - Dekodierung und Validierung der empfangenen Audio-Pakete
 *
 * Aufruf:
 *   node scripts/audio-test.cjs
 *
 * Umgebungsvariablen:
 *   MUMBLE_SERVER     - Server-Adresse (z.B. localhost:64738)
 *   MUMBLE_USERNAME   - Benutzername (default: AudioTestBot)
 *   MUMBLE_PASSWORD   - Server-Passwort (optional)
 *   TEST_DURATION     - Testdauer in Sekunden (default: 10)
 *   GENERATE_TONE     - Testsignal senden (default: true)
 *   TONE_FREQUENCY    - Frequenz des Testtons in Hz (default: 440)
 */

const MumbleClient = require('../vendors/mumble-client');
const { PassThrough } = require('stream');
const net = require('net');

// Konfiguration
const SERVER = process.env.MUMBLE_SERVER || 'localhost:64738';
const USERNAME = process.env.MUMBLE_USERNAME || 'AudioTestBot';
const PASSWORD = process.env.MUMBLE_PASSWORD || '';
const TEST_DURATION = Number(process.env.TEST_DURATION || 10) * 1000;
const GENERATE_TONE = process.env.GENERATE_TONE !== 'false';
const TONE_FREQUENCY = Number(process.env.TONE_FREQUENCY || 440);

// Audio-Konfiguration (48 kHz mono, 20ms frames)
const SAMPLE_RATE = 48000;
const SAMPLES_PER_FRAME = 960; // 20ms @ 48kHz
const CHANNELS = 1;

// Statistiken
const stats = {
  connected: false,
  connectionTime: null,
  packetsSent: 0,
  packetsReceived: 0,
  bytesReceived: 0,
  usersHeard: new Set(),
  errors: [],
  startTime: Date.now()
};

// Hilfsfunktion: Testsignal generieren (Sinuston)
function generateTone(frequency, sampleRate, numSamples) {
  const buffer = new Float32Array(numSamples);
  for (let i = 0; i < numSamples; i++) {
    buffer[i] = Math.sin(2 * Math.PI * frequency * i / sampleRate) * 0.3;
  }
  return buffer;
}

// Hilfsfunktion: Audio-Statistiken berechnen
function analyzeAudio(pcmData) {
  if (!pcmData || pcmData.length === 0) return null;
  
  let sum = 0;
  let max = 0;
  for (let i = 0; i < pcmData.length; i++) {
    const abs = Math.abs(pcmData[i]);
    sum += abs;
    if (abs > max) max = abs;
  }
  
  return {
    samples: pcmData.length,
    averageAmplitude: sum / pcmData.length,
    peakAmplitude: max,
    rms: Math.sqrt(pcmData.reduce((acc, val) => acc + val * val, 0) / pcmData.length)
  };
}

// Haupttest
async function runAudioTest() {
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║         Mumble Audio Roundtrip Test                       ║');
  console.log('╚════════════════════════════════════════════════════════════╝');
  console.log(`Server:     ${SERVER}`);
  console.log(`Username:   ${USERNAME}`);
  console.log(`Duration:   ${TEST_DURATION / 1000}s`);
  console.log(`Send Tone:  ${GENERATE_TONE ? `Yes (${TONE_FREQUENCY} Hz)` : 'No'}`);
  console.log('');

  const [host, portStr] = SERVER.split(':');
  const port = parseInt(portStr || '64738', 10);

  console.log(`[${timestamp()}] Verbinde zu ${host}:${port}...`);

  // Erstelle TCP-Verbindung
  const socket = net.connect(port, host);
  
  // Warte auf connect mit Timeout
  await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      socket.destroy();
      reject(new Error(`Connection timeout after 10 seconds`));
    }, 10000); // 10 Sekunden Timeout

    socket.on('connect', () => {
      clearTimeout(timeout);
      resolve();
    });
    
    socket.on('error', (err) => {
      clearTimeout(timeout);
      reject(err);
    });
  });

  try {
    // Erstelle Client
    const client = new MumbleClient({
      username: USERNAME,
      password: PASSWORD,
      tokens: []
    });

    // Verbinde den Client mit dem Socket
    await client.connectDataStream(socket);

    console.log(`[${timestamp()}] ✅ Verbunden als "${client.self.name}"`);
    stats.connected = true;
    stats.connectionTime = Date.now() - stats.startTime;

    // Warte auf Test-Completion
    await new Promise((resolve, reject) => {
      // Voice-Stream vorbereiten (optional)
      let voiceStream = null;
      let toneInterval = null;

      if (GENERATE_TONE) {
        console.log(`[${timestamp()}] 🎵 Starte Testsignal (${TONE_FREQUENCY} Hz)...`);
        
        try {
          voiceStream = client.createVoiceStream();
          
          // Testsignal alle 20ms senden
          toneInterval = setInterval(() => {
            try {
              const tone = generateTone(TONE_FREQUENCY, SAMPLE_RATE, SAMPLES_PER_FRAME);
              voiceStream.write(tone);
              stats.packetsSent++;
              
              if (stats.packetsSent === 1) {
                console.log(`[${timestamp()}] 📤 Erstes Audio-Paket gesendet`);
              }
            } catch (err) {
              console.error(`[${timestamp()}] ⚠️  Fehler beim Senden:`, err.message);
              stats.errors.push({ type: 'send', error: err.message });
            }
          }, 20);
        } catch (err) {
          console.error(`[${timestamp()}] ❌ Fehler beim Erstellen des Voice-Streams:`, err.message);
          stats.errors.push({ type: 'voice_stream', error: err.message });
        }
      }

      // Auf empfangene Audio-Pakete horchen
      client.on('voice', (voicePacket) => {
        stats.packetsReceived++;
        stats.usersHeard.add(voicePacket.user.name);
        
        if (voicePacket.pcm) {
          stats.bytesReceived += voicePacket.pcm.byteLength;
          
          const audioStats = analyzeAudio(voicePacket.pcm);
          
          if (stats.packetsReceived === 1) {
            console.log(`[${timestamp()}] 📥 Erstes Audio-Paket empfangen von "${voicePacket.user.name}"`);
            console.log(`    Samples: ${audioStats.samples}, Peak: ${audioStats.peakAmplitude.toFixed(4)}, RMS: ${audioStats.rms.toFixed(4)}`);
          }
          
          // Alle 50 Pakete Status ausgeben
          if (stats.packetsReceived % 50 === 0) {
            console.log(`[${timestamp()}] 📊 ${stats.packetsReceived} Pakete empfangen (${(stats.bytesReceived / 1024).toFixed(2)} KB)`);
          }
        }
      });

      // Fehlerbehandlung
      client.on('error', (err) => {
        console.error(`[${timestamp()}] ⚠️  Client-Fehler:`, err.message);
        stats.errors.push({ type: 'client', error: err.message });
      });

      // Channel-Join überwachen
      client.on('channelJoin', (channel) => {
        console.log(`[${timestamp()}] 📍 Channel beigetreten: "${channel.name}"`);
      });

      // User-Updates überwachen
      client.on('user', (user) => {
        if (user.name !== USERNAME) {
          console.log(`[${timestamp()}] 👤 User gesehen: "${user.name}"`);
        }
      });

      // Test nach vorgegebener Zeit beenden
      setTimeout(() => {
        console.log(`\n[${timestamp()}] ⏱️  Testdauer erreicht, beende Test...`);
        
        if (toneInterval) {
          clearInterval(toneInterval);
        }
        
        if (voiceStream) {
          try {
            voiceStream.end();
          } catch (err) {
            console.error(`[${timestamp()}] Fehler beim Beenden des Voice-Streams:`, err.message);
          }
        }
        
        setTimeout(() => {
          try {
            client.disconnect();
          } catch (err) {
            console.error(`[${timestamp()}] Fehler beim Trennen:`, err.message);
          }
          
          printResults();
          resolve(stats);
        }, 500);
      }, TEST_DURATION);
    });
  } catch (err) {
    console.error(`[${timestamp()}] ❌ Fehler:`, err.message);
    stats.errors.push({ type: 'fatal', error: err.message });
    printResults();
    process.exit(1);
  }
}

function timestamp() {
  const elapsed = ((Date.now() - stats.startTime) / 1000).toFixed(1);
  return `${elapsed}s`.padStart(6);
}

function printResults() {
  console.log('\n╔════════════════════════════════════════════════════════════╗');
  console.log('║                    Test-Ergebnisse                         ║');
  console.log('╚════════════════════════════════════════════════════════════╝');
  console.log(`Verbunden:           ${stats.connected ? '✅ Ja' : '❌ Nein'}`);
  
  if (stats.connectionTime) {
    console.log(`Verbindungszeit:     ${stats.connectionTime} ms`);
  }
  
  console.log(`\nAudio gesendet:`);
  console.log(`  Pakete:            ${stats.packetsSent}`);
  console.log(`  Erwartete Pakete:  ~${Math.floor(TEST_DURATION / 20)}`);
  console.log(`  Erfolgsrate:       ${stats.packetsSent > 0 ? '✅' : '❌'} ${((stats.packetsSent / (TEST_DURATION / 20)) * 100).toFixed(1)}%`);
  
  console.log(`\nAudio empfangen:`);
  console.log(`  Pakete:            ${stats.packetsReceived}`);
  console.log(`  Bytes:             ${(stats.bytesReceived / 1024).toFixed(2)} KB`);
  console.log(`  User gehört:       ${stats.usersHeard.size} (${Array.from(stats.usersHeard).join(', ') || 'keine'})`);
  console.log(`  Status:            ${stats.packetsReceived > 0 ? '✅ Audio empfangen' : '⚠️  Kein Audio empfangen'}`);
  
  if (stats.errors.length > 0) {
    console.log(`\n⚠️  Fehler (${stats.errors.length}):`);
    stats.errors.forEach((err, idx) => {
      console.log(`  ${idx + 1}. [${err.type}] ${err.error}`);
    });
  } else {
    console.log(`\n✅ Keine Fehler aufgetreten`);
  }
  
  console.log('\n' + '═'.repeat(62));
  
  // Exit-Code basierend auf Erfolg
  const success = stats.connected && stats.packetsSent > 0;
  const hasReceivedAudio = stats.packetsReceived > 0;
  
  if (success && hasReceivedAudio) {
    console.log('✅ Test BESTANDEN: Audio senden und empfangen funktioniert!');
    process.exit(0);
  } else if (success) {
    console.log('⚠️  Test TEILWEISE BESTANDEN: Senden funktioniert, aber kein Audio empfangen');
    process.exit(1);
  } else {
    console.log('❌ Test FEHLGESCHLAGEN: Verbindung oder Audio-Versand fehlgeschlagen');
    process.exit(1);
  }
}

// Test ausführen
runAudioTest().catch((err) => {
  console.error('\n❌ Test abgebrochen:', err);
  process.exit(1);
});
