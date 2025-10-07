# Audio-Testing Setup - Übersicht

Diese Dateien wurden für umfassende Audio-Tests im DevContainer erstellt:

## 📁 Neue Dateien

### Test-Scripts

1. **`scripts/audio-test.cjs`** - Haupttest-Script
   - Automatisierter Audio-Roundtrip-Test
   - Sendet Testtöne (440 Hz Sinuswelle)
   - Analysiert empfangene Audio-Pakete
   - Exit-Code 0 bei Erfolg

2. **`scripts/run-audio-tests.sh`** - Test-Suite
   - Führt alle Audio-Tests nacheinander aus
   - Prüft Server-Verfügbarkeit
   - Zeigt farbige Zusammenfassung

3. **`scripts/quick-audio-test.sh`** - All-in-One Test
   - Startet Test-Server automatisch
   - Führt Tests aus
   - Räumt automatisch auf
   - Ideal für CI/CD

4. **`scripts/audio-monitor.cjs`** - Echtzeit-Monitor
   - VU-Meter-Style Visualisierung
   - Zeigt aktive User und Audio-Level
   - Packet-Statistiken in Echtzeit

### Server-Setup

Der Murmur-Server ist bereits in deinem bestehenden Docker Compose Setup enthalten:
   - `.devcontainer/docker-compose.yml` enthält `murmur` Service
   - Nutzt `goofball222/murmur` Image
   - Port: `${MURMUR_PORT:-64738}` (default: 64738)
   - Konfiguration: `.devcontainer/murmur_config/`
   - ℹ️  **Kein separates docker-compose.test.yml nötig!**

### Dokumentation

5. **`AUDIO-TESTING.md`** - Vollständige Dokumentation
   - Detaillierte Test-Szenarien
   - Troubleshooting-Guide
   - Performance-Benchmarks
   - CI/CD-Integration

6. **`README.md`** (aktualisiert)
   - Neue NPM-Scripts dokumentiert
   - Audio-Testing-Sektion hinzugefügt

7. **`package.json`** (aktualisiert)
   - Neue NPM-Scripts hinzugefügt

## 🚀 Schnellstart

### Minimaler Test (empfohlen für erste Überprüfung)

```bash
./scripts/quick-audio-test.sh
```

### Vollständige Test-Suite

```bash
# 1. Test-Server starten
npm run test:server:up

# 2. Tests ausführen
npm run test:audio:suite

# 3. Server stoppen
npm run test:server:down
```

### Echtzeit-Monitoring

```bash
npm run test:server:up
MUMBLE_SERVER=localhost:64738 node scripts/audio-monitor.cjs
```

## 📊 Neue NPM-Scripts

```json
"test:audio"         - Einzelner Audio-Test
"test:audio:suite"   - Vollständige Test-Suite
"test:full"          - Alle Tests (E2E + Audio + Audit)
"test:server:up"     - Test-Server starten
"test:server:down"   - Test-Server stoppen
"test:server:logs"   - Server-Logs anzeigen
```

## ✅ Was wird getestet?

### Automatisierte Tests prüfen:

1. **Verbindung**
   - WebSocket-Verbindung zum Server
   - Mumble-Protokoll-Handshake
   - Channel-Beitritt

2. **Audio-Senden**
   - Opus-Encoder-Funktionalität
   - Paket-Generierung (960 Samples @ 48kHz)
   - Worker-Thread-Kommunikation
   - Resampler-Pipeline

3. **Audio-Empfangen**
   - Paket-Empfang von anderen Clients
   - Opus-Decoder-Funktionalität
   - PCM-Daten-Validierung
   - Audio-Statistiken (Amplitude, RMS)

4. **Performance**
   - Paket-Rate (~50/Sekunde)
   - Erfolgsrate (>95%)
   - Keine Encoder/Decoder-Fehler

### Manuelle Tests sollten zusätzlich prüfen:

- Mikrofon-Zugriff im Browser
- Audio-Wiedergabe über Lautsprecher
- UI-Feedback (Voice-Indicator)
- Push-to-Talk vs. Continuous
- Sample-Rate-Warnung
- Multi-User-Szenarien

## 🎯 Produktions-Readiness Checklist

Vor dem Deployment alle Tests durchführen:

```bash
# 1. Basis-Funktionalität
npm run test:e2e

# 2. Audio-Funktionalität
./scripts/quick-audio-test.sh

# 3. Security-Audit
npm run audit:ci

# 4. Vollständige Suite
npm run test:full
```

Alle Tests sollten erfolgreich sein (Exit-Code 0).

## 🔧 Anpassung für deine Umgebung

### Andere Mumble-Server verwenden

```bash
export MUMBLE_SERVER=your-server.com:64738
export MUMBLE_USERNAME=YourBot
export MUMBLE_PASSWORD=secret

npm run test:audio
```

### Test-Dauer anpassen

```bash
export TEST_DURATION=30  # Sekunden
npm run test:audio
```

### Testton-Frequenz ändern

```bash
export TONE_FREQUENCY=1000  # Hz
npm run test:audio
```

## 📚 Weitere Informationen

- Vollständige Dokumentation: `cat AUDIO-TESTING.md`
- Copilot-Kontext: `cat .github/copilot-instructions.md`
- Hauptdokumentation: `cat README.md`

## 🤝 Integration mit CI/CD

Beispiel für GitHub Actions:

```yaml
jobs:
  audio-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '22'
      - run: npm ci
      - run: npm run test:server:up
      - run: npm run test:audio
      - run: npm run test:server:down
        if: always()
```

## 📝 Nächste Schritte

1. **Jetzt testen:**
   ```bash
   ./scripts/quick-audio-test.sh
   ```

2. **Bei Erfolg:**
   - Dokumentiere deine Server-Konfiguration
   - Integriere in CI/CD-Pipeline
   - Führe regelmäßige Regression-Tests durch

3. **Bei Problemen:**
   - Siehe AUDIO-TESTING.md Troubleshooting-Sektion
   - Prüfe `/tmp/entrypoint.log`
   - Aktiviere Debug-Logging

Viel Erfolg mit deinen Audio-Tests! 🎉
