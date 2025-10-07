# Audio-Testing Guide für mumbling-mole DevContainer

## Übersicht

Dieses Dokument beschreibt, wie du die Audio-Funktionalität (Aufnahme und Wiedergabe) in der DevContainer-Umgebung testen kannst, bevor du in Produktion gehst.

## Schnellstart

### 1. Test-Mumble-Server starten

Der Murmur-Server ist bereits in deinem `.devcontainer/docker-compose.yml` definiert:

```bash
# Starte nur den Murmur-Service
npm run test:server:up

# Oder manuell:
cd .devcontainer && docker-compose up -d murmur

# Prüfe, ob der Server läuft
npm run test:server:logs
```

### 2. Audio-Tests ausführen

```bash
# Vollständige Test-Suite ausführen
./scripts/run-audio-tests.sh

# Oder nur den Audio-Roundtrip-Test
MUMBLE_SERVER=localhost:64738 node scripts/audio-test.cjs
```

## Detaillierte Test-Szenarien

### Test 1: Automatisierter Audio-Roundtrip

Dieser Test sendet einen synthetischen Testton (440 Hz Sinuswelle) und prüft, ob Pakete korrekt gesendet werden.

```bash
# Standardtest (10 Sekunden, 440 Hz)
MUMBLE_SERVER=localhost:64738 node scripts/audio-test.cjs

# Längerer Test mit höherer Frequenz
TEST_DURATION=30 TONE_FREQUENCY=1000 MUMBLE_SERVER=localhost:64738 node scripts/audio-test.cjs

# Nur Empfangs-Test (kein Senden)
GENERATE_TONE=false TEST_DURATION=20 MUMBLE_SERVER=localhost:64738 node scripts/audio-test.cjs
```

**Erwartete Ausgabe:**
```
✅ Verbunden als "AudioTestBot"
🎵 Starte Testsignal (440 Hz)...
📤 Erstes Audio-Paket gesendet
📊 50 Pakete empfangen (XX KB)
✅ Test BESTANDEN: Audio senden und empfangen funktioniert!
```

### Test 2: Zwei-Client-Test (Loopback)

Um Audio-Empfang zu testen, benötigst du einen zweiten Client:

**Option A: Offizieller Mumble Desktop-Client**

1. Installiere den [Mumble-Client](https://www.mumble.info/downloads/)
2. Verbinde zu `localhost:64738` (oder der Port aus `MURMUR_PORT` in deinem `.env`)
3. Führe den Audio-Test aus:
   ```bash
   ./scripts/run-audio-tests.sh
   ```
4. Du solltest den 440 Hz Testton im Desktop-Client hören

**Option B: Zweite Browser-Instanz**

1. Starte den Dev-Server:
   ```bash
   ./start-dev-server.sh
   ```
2. Öffne zwei Browser-Tabs mit `http://local.flexpair.app`
3. Melde dich in beiden Tabs an
4. Spreche in einem Tab, beobachte das Voice-Indicator-Icon im anderen

**Option C: Bereits im DevContainer enthalten**

Dein Setup nutzt den offiziellen `goofball222/murmur` Container:

```bash
# Server-Konfiguration anpassen (optional)
ls -la .devcontainer/murmur_config/

# Server starten
npm run test:server:up

# Zugriff von außerhalb des Containers
# Port wird gemappt: ${MURMUR_PORT:-64738}:${MURMUR_PORT:-64738}
```

### Test 3: Browser-basierte Audio-Tests

#### Mikrofon-Zugriff testen

1. Starte den Dev-Server:
   ```bash
   ./start-dev-server.sh
   ```

2. Öffne die Browser-Konsole (F12)

3. Prüfe AudioContext-Status:
   ```javascript
   // In der Browser-Konsole
   audioContextManager.getStats()
   ```

   Erwartete Ausgabe:
   ```javascript
   {
     state: "running",
     sampleRate: 48000,
     currentTime: 123.456
   }
   ```

4. Verbinde und aktiviere Mikrofon:
   - Klicke auf "Connect"
   - Erlaube Mikrofon-Zugriff wenn gefragt
   - Beobachte das Mikrofon-Icon (sollte sich bei Sprache ändern)

#### Audio-Stream-Debugging

Füge temporär Logging in `app/voice.js` hinzu:

```javascript
_write(data, _, callback) {
  console.log(`[Voice] Samples: ${data.length}, Peak: ${Math.max(...Array.from(data))}`);
  if (this._mute) {
    callback();
  } else {
    this._getOrCreateOutbound().write(data, callback);
  }
}
```

### Test 4: Worker-Thread Audio-Flow

Prüfe, ob Audio korrekt durch den Worker fließt:

```bash
# Worker-Logs aktivieren (in app/worker.js)
# Setze DEBUG=true am Anfang der Datei

# Dann starte den Dev-Server
./start-dev-server.sh
```

Im Browser solltest du Worker-Logs in der Konsole sehen:
```
[Worker] Voice stream created: voiceId=1
[Worker] Outbound voice setup: samplesPerPacket=960
[Worker] Resampler piping...
```

### Test 5: Opus-Codec-Validierung

Stelle sicher, dass Opus korrekt funktioniert:

```bash
# Prüfe ob Opus-Decoder verfügbar ist
cd /home/node
node -e "
  const OpusEncoder = require('node-opus').OpusEncoder;
  const encoder = new OpusEncoder(48000, 1);
  console.log('✅ Opus Encoder funktioniert');
"
```

## Metriken und Erfolgskriterien

### Verbindungstest
- ✅ WebSocket-Verbindung erfolgreich
- ✅ Mumble-Handshake abgeschlossen
- ✅ Channel-Beitritt bestätigt

### Audio-Senden
- ✅ Mindestens 90% der erwarteten Pakete gesendet (bei 20ms frames: ~50 Pakete/Sekunde)
- ✅ Kein Buffering oder Lag
- ✅ Keine Encoder-Fehler in den Logs

### Audio-Empfangen
- ✅ Audio-Pakete von anderen Clients empfangen
- ✅ Dekodierung erfolgreich (PCM-Daten verfügbar)
- ✅ RMS-Amplitude > 0.001 (bei aktivem Sender)
- ✅ Peak-Amplitude < 1.0 (kein Clipping)

### Latenz
- ✅ Roundtrip-Latenz < 100ms (ideal)
- ⚠️  Roundtrip-Latenz < 300ms (akzeptabel)
- ❌ Roundtrip-Latenz > 300ms (problematisch)

## Troubleshooting

### Problem: "Server nicht erreichbar"

```bash
# Prüfe ob Server läuft
cd .devcontainer && docker-compose ps murmur

# Prüfe Server-Logs
npm run test:server:logs

# Prüfe Port (Standard: 64738, oder aus MURMUR_PORT env)
netstat -ln | grep 64738

# Server neu starten
npm run test:server:down
npm run test:server:up
```

### Problem: "Kein Audio empfangen"

Das ist normal wenn kein anderer Client sendet. Lösungen:

1. Starte einen zweiten Client (siehe Test 2)
2. Nutze die Web-UI im Browser
3. Verwende den offiziellen Mumble-Client

### Problem: "WebSocket-Fehler"

```bash
# Prüfe websockify-Prozess
ps aux | grep websockify

# Prüfe Entrypoint-Logs
tail -f /tmp/entrypoint.log

# Manuelle WebSocket-Verbindung testen
node scripts/e2e-check.cjs
```

### Problem: "AudioContext suspended"

Im Browser:
```javascript
// Entsperre AudioContext
audioContextManager.ensureAudioContext().then(() => {
  console.log('AudioContext resumed');
});
```

### Problem: "Mikrofon-Zugriff verweigert"

- Browser-Einstellungen prüfen (chrome://settings/content/microphone)
- HTTPS oder localhost erforderlich für getUserMedia
- In Chrome: Site-Einstellungen → Mikrofon → Erlauben

### Problem: "Opus-Codec nicht verfügbar"

```bash
# Rebuild vendor dependencies
cd vendors/mumble-client
npm install
npm run build
cd ../..
npm run build
```

## CI/CD Integration

### GitHub Actions Beispiel

```yaml
- name: Audio Tests
  run: |
    # Starte Murmur-Server aus bestehendem docker-compose
    cd .devcontainer
    docker-compose up -d murmur
    cd ..
    
    # Warte bis Server bereit ist
    sleep 5
    
    # Führe Audio-Tests aus
    MUMBLE_SERVER=localhost:64738 npm run test:audio
    
    # Cleanup
    cd .devcontainer
    docker-compose stop murmur
```

### Lokales Pre-Deployment Check

```bash
# Vollständige Pre-Production Validation
./scripts/run-audio-tests.sh

# Bei Erfolg: Deploy
if [ $? -eq 0 ]; then
  echo "✅ Audio-Tests bestanden, bereit für Deployment"
  # Dein Deployment-Command hier
else
  echo "❌ Audio-Tests fehlgeschlagen, Deployment abgebrochen"
  exit 1
fi
```

## Performance-Benchmarks

Erwartete Werte in einer gesunden Umgebung:

| Metrik | Ziel | Akzeptabel | Kritisch |
|--------|------|------------|----------|
| Verbindungszeit | < 500ms | < 1s | > 2s |
| Paket-Erfolgsrate | > 99% | > 95% | < 90% |
| Audio-Latenz | < 50ms | < 150ms | > 300ms |
| CPU-Auslastung | < 10% | < 30% | > 50% |
| Memory-Usage | < 100MB | < 200MB | > 500MB |

## Zusätzliche Tools

### Audio-Analyzer Script

```bash
# Erstelle FFT-Analyse der Audio-Streams
node scripts/audio-analyzer.cjs --duration=10 --output=analysis.json
```

### Latenz-Messung

```bash
# Ping-Pong Test für Latenz-Messung
MEASURE_LATENCY=true node scripts/audio-test.cjs
```

## Weitere Ressourcen

- [Mumble Protocol Documentation](https://mumble-protocol.readthedocs.io/)
- [Web Audio API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API)
- [Opus Codec](https://opus-codec.org/)
- [WebRTC Best Practices](https://webrtc.org/getting-started/testing)

## Support

Bei Problemen:
1. Prüfe `/tmp/entrypoint.log`
2. Aktiviere Debug-Logging in `app/worker.js`
3. Nutze Browser DevTools Network/Console
4. Checke Server-Logs: `docker-compose logs -f`
