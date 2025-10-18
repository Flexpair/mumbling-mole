# 🧪 Testing Guide for Mumbling Mole

Comprehensive documentation for testing the audio system, both in local DevContainers and in GitHub Codespaces.

## 📋 Table of Contents

- [Quick Start](#-quick-start)
- [Test Overview](#-test-overview)
- [Audio System Tests](#-audio-system-tests)
- [Test Scenarios](#-test-scenarios)
- [Codespace-Specific Guide](#-testing-in-github-codespaces)
- [CI/CD Integration](#-cicd-integration)
- [Troubleshooting](#-troubleshooting)

---

## 🚀 Quick Start

### Minimal Test (Recommended)

The fastest way to test all critical audio components:

```bash
# Automated Audio System Test (no live server required)
npm run test:audio:system

# Full test suite
npm run test:full
```

### All-in-One Test with Live Server

```bash
# Automatically starts a test server, runs tests, and cleans up
./scripts/quick-audio-test.sh
```

---

## 📊 Test Overview

### Available NPM Scripts

| Script | Description |
|--------|--------------|
| `npm run test` | E2E Tests + Security Audit |
| `npm run test:full` | All Tests (E2E + Audio + Audit) |
| `npm run test:audio:system` | Audio System Test (no server needed) |
| `npm run test:audio` | Single Audio Roundtrip Test |
| `npm run test:audio:suite` | Complete Audio Test Suite |
| `npm run test:e2e` | WebSocket Smoke Test |
| `npm run test:server:up` | Start Murmur Test Server |
| `npm run test:server:down` | Stop Murmur Test Server |
| `npm run test:server:logs` | Display Server Logs |

### Test Scripts in Detail

1. **`scripts/audio-system-test.cjs`** - Automated Component Test
   - Checks mumble-client build
   - Validates worker scripts
   - Tests codec availability
   - No server connection required

2. **`scripts/audio-test.cjs`** - Live Audio Roundtrip Test
   - Connects to Mumble server
   - Sends test tones (440 Hz sine wave)
   - Analyzes received audio packets
   - Exit code 0 on success

3. **`scripts/run-audio-tests.sh`** - Test Suite Runner
   - Runs all audio tests sequentially
   - Checks server availability
   - Shows colored summary

4. **`scripts/quick-audio-test.sh`** - All-in-One Wrapper
   - Starts test server automatically
   - Runs tests
   - Cleans up automatically
   - Ideal for CI/CD

5. **`scripts/audio-monitor.cjs`** - Real-time Monitor
   - VU-meter style visualization
   - Shows active users and audio levels
   - Packet statistics in real-time

---

## ✅ Audio System Tests

### What is Being Tested?

The automated test `npm run test:audio:system` checks **10 critical components**:

1. ✅ **Mumble-Client Build** - Vendor library compiled correctly (≈30 KB)
2. ✅ **Mumble-Client Import** - CommonJS/ESM export works
3. ✅ **Mumble-Client Instantiation** - Class can be created
4. ✅ **Audio Codecs** - Codec files present (Opus, etc.)
5. ✅ **Worker Scripts** - All 5 worker files syntax-correct
6. ✅ **Audio Dependencies** - Required NPM packages installed
7. ✅ **Audio Modules** - voice.js, audio-context-manager.js, mumble-websocket.js OK
8. ✅ **NPM Scripts** - Build scripts present
9. ✅ **Webpack Build** - dist/ directory generated correctly
10. ✅ **Audio Packet Generation** - 440Hz test tone can be generated

### Expected Output (Success)
---

## 📊 Test-Übersicht

### Verfügbare NPM Scripts

| Script | Beschreibung |
|--------|--------------|
| `npm run test` | E2E Tests + Security Audit |
| `npm run test:full` | Alle Tests (E2E + Audio + Audit) |
| `npm run test:audio:system` | Audio-System-Test (kein Server nötig) |
| `npm run test:audio` | Einzelner Audio-Roundtrip-Test |
| `npm run test:audio:suite` | Vollständige Audio-Test-Suite |
| `npm run test:e2e` | WebSocket Smoke Test |
| `npm run test:server:up` | Murmur Test-Server starten |
| `npm run test:server:down` | Murmur Test-Server stoppen |
| `npm run test:server:logs` | Server-Logs anzeigen |

### Test-Scripts im Detail

1. **`scripts/audio-system-test.cjs`** - Automatisierter Komponenten-Test
   - Prüft mumble-client Build
   - Validiert Worker-Scripts
   - Testet Codec-Verfügbarkeit
   - Keine Server-Verbindung erforderlich

2. **`scripts/audio-test.cjs`** - Live Audio-Roundtrip-Test
   - Verbindet zu Mumble-Server
   - Sendet Testtöne (440 Hz Sinuswelle)
   - Analysiert empfangene Audio-Pakete
   - Exit-Code 0 bei Erfolg

3. **`scripts/run-audio-tests.sh`** - Test-Suite Runner
   - Führt alle Audio-Tests nacheinander aus
   - Prüft Server-Verfügbarkeit
   - Zeigt farbige Zusammenfassung

4. **`scripts/quick-audio-test.sh`** - All-in-One Wrapper
   - Startet Test-Server automatisch
   - Führt Tests aus
   - Räumt automatisch auf
   - Ideal für CI/CD

5. **`scripts/audio-monitor.cjs`** - Echtzeit-Monitor
   - VU-Meter-Style Visualisierung
   - Zeigt aktive User und Audio-Level
   - Packet-Statistiken in Echtzeit

---

## ✅ Audio-System-Tests

### Was wird getestet?

Der automatisierte Test `npm run test:audio:system` prüft **10 kritische Komponenten**:

1. ✅ **Mumble-Client Build** - Vendor-Bibliothek korrekt kompiliert (≈30 KB)
2. ✅ **Mumble-Client Import** - CommonJS/ESM Export funktioniert
3. ✅ **Mumble-Client Instanziierung** - Klasse kann erstellt werden
4. ✅ **Audio-Codecs** - Codec-Dateien vorhanden (Opus, etc.)
5. ✅ **Worker-Scripts** - Alle 5 Worker-Dateien Syntax-korrekt
6. ✅ **Audio-Dependencies** - Erforderliche NPM-Pakete installiert
7. ✅ **Audio-Module** - voice.js, audio-context-manager.js, mumble-websocket.js OK
8. ✅ **NPM Scripts** - Build-Scripts vorhanden
9. ✅ **Webpack Build** - dist/ Verzeichnis korrekt generiert
10. ✅ **Audio-Paket-Generierung** - 440Hz Testton kann generiert werden

### Expected Output (Success)

```
╔════════════════════════════════════════════════════════════╗
║         Automated Audio System Test                       ║
║         (No Live Server Required)                          ║
╚════════════════════════════════════════════════════════════╝

[✅] Mumble-Client Build (30.5 KB)
[✅] Mumble-Client Import
[✅] Mumble-Client Instantiation
[✅] Audio Codecs
[✅] Worker Scripts (5 files)
[✅] Audio Dependencies
[✅] Audio Modules
[✅] NPM Scripts
[✅] Webpack Build
[✅] Audio Packet Generation (440 Hz)

✅ ALL TESTS PASSED (10/10 in 0.3s)
   Audio system ready for production!
```

### When Do Tests Fail?

The test immediately detects problems after:

- ❌ **Package updates** that break mumble-client
- ❌ **Missing dependencies** after npm install
- ❌ **Broken builds** after code changes
- ❌ **Syntax errors** in worker scripts
- ❌ **Missing files** after refactoring

**Example Error Output:**

```
❌ TESTS FAILED
   3 problem(s) found

[❌] Mumble-Client Build - File not found
[❌] Worker Scripts - Syntax error in recorder-worker.js
[✅] Audio Codecs

🔧 Fix:
   - npm run build:vendor:mumble-client
   - npm run build
   - Check app/recorder-worker.js line 42
```

---

## 🔬 Test Scenarios

### Scenario 1: Automated Audio Roundtrip (with Server)

Sends a synthetic test tone and checks if packets are transmitted correctly.

```bash
# Standard test (10 seconds, 440 Hz)
MUMBLE_SERVER=localhost:64738 node scripts/audio-test.cjs

# Longer test with higher frequency
TEST_DURATION=30 TONE_FREQUENCY=1000 MUMBLE_SERVER=localhost:64738 node scripts/audio-test.cjs

# Receive-only test (no sending)
GENERATE_TONE=false TEST_DURATION=20 MUMBLE_SERVER=localhost:64738 node scripts/audio-test.cjs
```

**Expected Output:**
```
✅ Connected as "AudioTestBot"
🎵 Starting test signal (440 Hz)...
📤 First audio packet sent
📊 50 packets received (XX KB)
✅ Test PASSED: Audio send and receive working!
```

### Scenario 2: Two-Client Test (Loopback)

To test complete audio reception, you need a second client.

#### Option A: Official Mumble Desktop Client

1. Install the [Mumble Client](https://www.mumble.info/downloads/)
2. Connect to `localhost:64738` (or port from `MURMUR_PORT`)
3. Run the audio test:
   ```bash
   npm run test:audio:suite
   ```
4. You should hear the 440 Hz test tone in the desktop client

#### Option B: Two Browser Instances

1. Start the dev server:
   ```bash
   MUMBLE_SERVER=localhost:64738 ./start-dev-server.sh
   ```
2. Open two browser tabs with `http://local.flexpair.app`
3. Log in to both tabs
4. Speak in one tab, observe the voice indicator icon in the other

#### Option C: Container-Based Test Server

Your setup uses the official `goofball222/murmur` container:

```bash
# View server configuration
ls -la .devcontainer/murmur_config/

# Start server
npm run test:server:up

# Check status
npm run test:server:logs

# Access from outside the container
# Port is mapped: ${MURMUR_PORT:-64738}:${MURMUR_PORT:-64738}
```

### Scenario 3: Real-time Monitoring

Monitor audio streams in real-time with VU-meter display:

```bash
# Server must be running
npm run test:server:up

# Start monitor
MUMBLE_SERVER=localhost:64738 node scripts/audio-monitor.cjs
```

**Display:**
- ✅ Active users and their audio levels
- 📊 Packet rate and bandwidth
- 📈 Audio amplitude visualization
- 🔗 Connection statistics

### Scenario 4: Browser-Based Interactive Tests

For manual end-to-end tests:

1. **Start Test Server:**
   ```bash
   npm run test:server:up
   ```

2. **Start Dev Server:**
   ```bash
   MUMBLE_SERVER=localhost:64738 ./start-dev-server.sh
   ```

3. **Test in Browser:**
   - Open `http://local.flexpair.app`
   - Allow microphone access
   - Connect to server
   - Speak and check voice indicator
   - Check console for errors

4. **Verification:**
   - Voice indicator turns green when speaking
   - No console errors
   - Audio packets are sent (see Dev Tools Network tab)

---

## 🌩️ Testing in GitHub Codespaces

### Quick Start for Codespaces

#### 1️⃣ Check Server Availability

The Murmur container should start automatically. Check its status:

```bash
# In DevContainer terminal:
timeout 1 bash -c "echo > /dev/tcp/localhost/64738" 2>/dev/null && echo "✅ Running" || echo "❌ Not available"
```

If not available, start the server:

**Option A: Via Docker Extension (recommended)**
1. Open the Docker extension in VS Code (left sidebar)
2. Find "Containers" → locate `murmur`
3. Right-click → "Start" (if not already green)

**Option B: Via Terminal**
```bash
# Open a NEW terminal (outside the container)
# Press: Ctrl+Shift+` or Terminal → New Terminal

docker compose -f .devcontainer/docker-compose.yml up -d murmur

# Check status:
docker compose -f .devcontainer/docker-compose.yml ps murmur
```

#### 2️⃣ Run Tests

**In DevContainer Terminal:**

```bash
# Recommended: Simple audio system test
npm run test:audio:system

# Optional: Test with live server connection
./scripts/test-audio-simple.sh

# Or directly:
MUMBLE_SERVER=localhost:64738 node scripts/audio-test.cjs
```

### Expected Output in Codespaces

```
╔════════════════════════════════════════════════════════════╗
║         Audio Test (Codespace Edition)                    ║
╚════════════════════════════════════════════════════════════╝

Server: localhost:64738
Checking server availability...
✅ Server reachable at localhost:64738

Running audio test (10s)...

[0.1s] Connecting to localhost:64738...
[0.5s] ✅ Connected as "AudioTestBot"
[0.5s] 🎵 Starting test signal (440 Hz)...
[0.6s] 📤 First audio packet sent
[10.0s] ⏱️  Test duration reached, ending test...

╔════════════════════════════════════════════════════════════╗
║                    Test Results                            ║
╚════════════════════════════════════════════════════════════╝
Connected:           ✅ Yes
Connection time:     450 ms

Audio sent:
  Packets:            500
  Expected packets:  ~500
  Success rate:       ✅ 100.0%

✅ Test PASSED: Audio sending works!
```

### Codespace-Specific Test Commands

```bash
# Standard test (10 seconds)
MUMBLE_SERVER=localhost:64738 node scripts/audio-test.cjs

# Longer test (30 seconds)
TEST_DURATION=30 MUMBLE_SERVER=localhost:64738 node scripts/audio-test.cjs

# Different frequency
TONE_FREQUENCY=1000 MUMBLE_SERVER=localhost:64738 node scripts/audio-test.cjs

# Receive only (no sending)
GENERATE_TONE=false MUMBLE_SERVER=localhost:64738 node scripts/audio-test.cjs
```

---

## 🔄 CI/CD Integration

### GitHub Actions Workflow

### Wann schlagen Tests fehl?

Der Test erkennt sofort Probleme nach:

- ❌ **Paket-Updates** die mumble-client kaputtmachen
- ❌ **Fehlende Dependencies** nach npm install
- ❌ **Kaputte Builds** nach Code-Änderungen
- ❌ **Syntax-Fehler** in Worker-Scripts
- ❌ **Fehlende Dateien** nach Refactorings

**Beispiel-Fehler-Ausgabe:**

```
❌ TESTS FEHLGESCHLAGEN
   3 Problem(e) gefunden

[❌] Mumble-Client Build - Datei nicht gefunden
[❌] Worker-Scripts - Syntax-Fehler in recorder-worker.js
[✅] Audio-Codecs

🔧 Behebung:
   - npm run build:vendor:mumble-client
   - npm run build
   - Prüfe app/audio/recorder-worker.js Zeile 42
```

---

## 🔬 Test-Szenarien

### Szenario 1: Automatisierter Audio-Roundtrip (mit Server)

Sendet einen synthetischen Testton und prüft, ob Pakete korrekt übertragen werden.

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

### Szenario 2: Zwei-Client-Test (Loopback)

Um vollständigen Audio-Empfang zu testen, benötigst du einen zweiten Client.

#### Option A: Offizieller Mumble Desktop-Client

1. Installiere den [Mumble-Client](https://www.mumble.info/downloads/)
2. Verbinde zu `localhost:64738` (oder Port aus `MURMUR_PORT`)
3. Führe den Audio-Test aus:
   ```bash
   npm run test:audio:suite
   ```
4. Du solltest den 440 Hz Testton im Desktop-Client hören

#### Option B: Zwei Browser-Instanzen

1. Starte den Dev-Server:
   ```bash
   MUMBLE_SERVER=localhost:64738 ./start-dev-server.sh
   ```
2. Öffne zwei Browser-Tabs mit `http://local.flexpair.app`
3. Melde dich in beiden Tabs an
4. Spreche in einem Tab, beobachte das Voice-Indicator-Icon im anderen

#### Option C: Container-basierter Test-Server

Dein Setup nutzt den offiziellen `goofball222/murmur` Container:

```bash
# Server-Konfiguration einsehen
ls -la .devcontainer/murmur_config/

# Server starten
npm run test:server:up

# Status prüfen
npm run test:server:logs

# Zugriff von außerhalb des Containers
# Port wird gemappt: ${MURMUR_PORT:-64738}:${MURMUR_PORT:-64738}
```

### Szenario 3: Echtzeit-Monitoring

Monitor audio streams in Echtzeit mit VU-Meter-Darstellung:

```bash
# Server muss laufen
npm run test:server:up

# Monitor starten
MUMBLE_SERVER=localhost:64738 node scripts/audio-monitor.cjs
```

**Anzeige:**
- ✅ Aktive Benutzer und ihre Audio-Pegel
- 📊 Paket-Rate und Bandbreite
- 📈 Audio-Amplitude-Visualisierung
- 🔗 Verbindungsstatistiken

### Szenario 4: Browser-basierte interaktive Tests

Für manuelle End-to-End-Tests:

1. **Starte Test-Server:**
   ```bash
   npm run test:server:up
   ```

2. **Starte Dev-Server:**
   ```bash
   MUMBLE_SERVER=localhost:64738 ./start-dev-server.sh
   ```

3. **Teste im Browser:**
   - Öffne `http://local.flexpair.app`
   - Erlaube Mikrofon-Zugriff
   - Verbinde zum Server
   - Sprich und prüfe Voice-Indicator
   - Prüfe Console auf Fehler

4. **Verifikation:**
   - Voice-Indicator wird grün beim Sprechen
   - Keine Console-Fehler
   - Audio-Pakete werden gesendet (siehe Dev-Tools Network-Tab)

---

## 🌩️ Testing in GitHub Codespaces

### Schnellstart für Codespaces

#### 1️⃣ Server-Verfügbarkeit prüfen

Der Murmur-Container sollte automatisch gestartet sein. Prüfe den Status:

```bash
# Im DevContainer-Terminal:
timeout 1 bash -c "echo > /dev/tcp/localhost/64738" 2>/dev/null && echo "✅ Läuft" || echo "❌ Nicht verfügbar"
```

Falls nicht verfügbar, starte den Server:

**Option A: Via Docker Extension (empfohlen)**
1. Öffne die Docker-Extension in VS Code (linke Seitenleiste)
2. Suche "Containers" → finde `murmur`
3. Rechtsklick → "Start" (falls nicht bereits grün)

**Option B: Via Terminal**
```bash
# Öffne ein NEUES Terminal (außerhalb des Containers)
# Drücke: Strg+Shift+` oder Terminal → New Terminal

docker compose -f .devcontainer/docker-compose.yml up -d murmur

# Status prüfen:
docker compose -f .devcontainer/docker-compose.yml ps murmur
```

#### 2️⃣ Tests ausführen

**Im DevContainer-Terminal:**

```bash
# Empfohlen: Einfacher Audio-System-Test
npm run test:audio:system

# Optional: Test mit Live-Server-Verbindung
./scripts/test-audio-simple.sh

# Oder direkt:
MUMBLE_SERVER=localhost:64738 node scripts/audio-test.cjs
```

### Erwartete Ausgabe in Codespaces

```
╔════════════════════════════════════════════════════════════╗
║         Audio-Test (Codespace Edition)                    ║
╚════════════════════════════════════════════════════════════╝

Server: localhost:64738
Prüfe Server-Verfügbarkeit...
✅ Server erreichbar auf localhost:64738

Führe Audio-Test aus (10s)...

[0.1s] Verbinde zu localhost:64738...
[0.5s] ✅ Verbunden als "AudioTestBot"
[0.5s] 🎵 Starte Testsignal (440 Hz)...
[0.6s] 📤 Erstes Audio-Paket gesendet
[10.0s] ⏱️  Testdauer erreicht, beende Test...

╔════════════════════════════════════════════════════════════╗
║                    Test-Ergebnisse                         ║
╚════════════════════════════════════════════════════════════╝
Verbunden:           ✅ Ja
Verbindungszeit:     450 ms

Audio gesendet:
  Pakete:            500
  Erwartete Pakete:  ~500
  Erfolgsrate:       ✅ 100.0%

✅ Test BESTANDEN: Audio senden funktioniert!
```

### Codespace-spezifische Test-Kommandos

```bash
# Standard-Test (10 Sekunden)
MUMBLE_SERVER=localhost:64738 node scripts/audio-test.cjs

# Längerer Test (30 Sekunden)
TEST_DURATION=30 MUMBLE_SERVER=localhost:64738 node scripts/audio-test.cjs

# Andere Frequenz
TONE_FREQUENCY=1000 MUMBLE_SERVER=localhost:64738 node scripts/audio-test.cjs

# Nur empfangen (kein Senden)
GENERATE_TONE=false MUMBLE_SERVER=localhost:64738 node scripts/audio-test.cjs
```

---

## 🔄 CI/CD Integration

### GitHub Actions Workflow

```yaml
name: Audio System Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    
    steps:
      - uses: actions/checkout@v3
      
      - uses: actions/setup-node@v3
        with:
          node-version: '22'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Build application
        run: npm run build
      
      - name: Run audio system tests (no server required)
        run: npm run test:audio:system
      
      - name: Run E2E tests
        run: npm run test:e2e
      
      - name: Security audit
        run: npm audit --production
```

### Pre-Commit Hook

Prevent broken commits with a Git hook:

```bash
# .git/hooks/pre-commit
#!/bin/bash

echo "🧪 Running audio system tests..."

if ! npm run test:audio:system; then
  echo "❌ Audio system tests failed!"
  echo "   Commit aborted."
  exit 1
fi

echo "✅ Tests passed, continuing with commit..."
```

Enable the hook:
```bash
chmod +x .git/hooks/pre-commit
```

### Docker-based CI

```yaml
# .gitlab-ci.yml (example)
test:audio:
  image: node:22
  services:
    - name: goofball222/murmur:latest
      alias: murmur
  
  variables:
    MUMBLE_SERVER: "murmur:64738"
  
  script:
    - npm ci
    - npm run build
    - npm run test:audio:system
    - npm run test:audio
```

---

## 🔧 Troubleshooting

### Problem: Server not reachable

```bash
# Check if the container is running
docker ps | grep murmur

# Check port binding
docker port <container-id> 64738

# Check logs
npm run test:server:logs

# Test manual connection
timeout 1 bash -c "echo > /dev/tcp/localhost/64738" && echo "OK" || echo "FAIL"
```

### Problem: Audio packets not being sent

**Possible causes:**
- AudioContext is suspended (browser policy)
- Microphone permission missing
- Worker script error

**Solution:**
```bash
# 1. Check build
npm run build

# 2. Check worker scripts
npm run test:audio:system

# 3. Open browser console and check:
#    - No errors in worker.js
#    - AudioContext state = "running"
#    - getUserMedia() successful
```

### Problem: Tests fail after npm install

```bash
# Rebuild vendored dependencies
npm run build:vendor:mumble-client

# Rebuild
npm run build

# Test again
npm run test:audio:system
```

### Problem: Mumble-Client import fails

```bash
# Check if lib/ directory exists
ls -la vendors/mumble-client/lib/

# If not, start Babel compilation:
cd vendors/mumble-client
npm run build
cd ../..

# Or directly:
npm run build:vendor:mumble-client
```

### Problem: Worker script error

**Symptoms:**
- Console error: "Failed to load worker script"
- Audio doesn't work

**Solution:**
```bash
# 1. Check syntax of all workers
node -c app/worker.js
node -c app/recorder-worker.js
node -c app/encode-worker.js
node -c app/decode-worker.js

# 2. Rebuild
npm run build

# 3. System test
npm run test:audio:system
```

### Problem: "AudioContext suspended"

**Cause:** Browser requires user interaction before audio starts

**Solution:**
- Click "Connect" button in UI
- Or: Call in browser console:
  ```javascript
  audioContextManager.ensureAudioContext().then(ctx => ctx.resume())
  ```

### Problem: Codespace container won't start

```bash
# Check Docker Compose configuration
cd .devcontainer
docker-compose config

# Manual container management
docker-compose up -d murmur

# Check logs
docker-compose logs murmur
```

---

## 📈 Test Success Metrics

### ✅ Successful tests should show:

- **Connection:** WebSocket connection established
- **Packet rate:** ~50 packets/second (20ms frames at 48kHz)
- **Success rate:** > 95% of packets successful
- **Latency:** < 100ms connection setup
- **No errors:** No encoder/decoder errors

### ⚠️ Normal warnings:

- "No audio received" - Normal when no other clients are sending
- "Partial test" - Expected in solo tests without second client
- "AudioContext suspended" - Browser policy, resolved by user interaction

### 📊 Performance Benchmarks

Typical values for successful tests:

| Metric | Expected Value |
|--------|----------------|
| Packet Rate | 48-52 packets/second |
| Packet Size | ~100-200 bytes (Opus) |
| Bandwidth | 5-10 KB/s |
| Connection Time | < 500ms |
| First-Packet Latency | < 100ms |

---

## 📚 Additional Resources

- **Main README:** [README.md](./README.md) - Project overview and quick start
- **Architecture:** [CLAUDE.md](./CLAUDE.md) - Detailed technical documentation
- **Copilot Context:** [.github/copilot-instructions.md](.github/copilot-instructions.md)

---

## 🎯 Summary

### For quick tests:
```bash
npm run test:audio:system  # No server needed
```

### For complete tests:
```bash
npm run test:full          # E2E + Audio + Security
```

### For development:
```bash
npm run test:server:up     # Start server
npm run test:audio:suite   # Run tests
npm run test:server:down   # Stop server
```

### For CI/CD:
```bash
npm run test:audio:system  # Include in pipeline
```

---

<p align="center">
  <strong>Happy Testing! 🎤</strong><br>
  For problems see <a href="#-troubleshooting">Troubleshooting</a>
</p>

### Pre-Commit Hook

Verhindere defekte Commits mit einem Git-Hook:

```bash
# .git/hooks/pre-commit
#!/bin/bash

echo "🧪 Führe Audio-System-Tests aus..."

if ! npm run test:audio:system; then
  echo "❌ Audio-System-Tests fehlgeschlagen!"
  echo "   Commit abgebrochen."
  exit 1
fi

echo "✅ Tests bestanden, Commit wird fortgesetzt..."
```

Aktiviere den Hook:
```bash
chmod +x .git/hooks/pre-commit
```

### Docker-basierte CI

```yaml
# .gitlab-ci.yml (Beispiel)
test:audio:
  image: node:22
  services:
    - name: goofball222/murmur:latest
      alias: murmur
  
  variables:
    MUMBLE_SERVER: "murmur:64738"
  
  script:
    - npm ci
    - npm run build
    - npm run test:audio:system
    - npm run test:audio
```

---

## 🔧 Troubleshooting

### Problem: Server nicht erreichbar

```bash
# Prüfe, ob der Container läuft
docker ps | grep murmur

# Prüfe Port-Binding
docker port <container-id> 64738

# Prüfe Logs
npm run test:server:logs

# Manuelle Verbindung testen
timeout 1 bash -c "echo > /dev/tcp/localhost/64738" && echo "OK" || echo "FAIL"
```

### Problem: Audio-Pakete werden nicht gesendet

**Mögliche Ursachen:**
- AudioContext ist suspendiert (Browser-Richtlinie)
- Mikrofon-Berechtigung fehlt
- Worker-Script-Fehler

**Lösung:**
```bash
# 1. Prüfe Build
npm run build

# 2. Prüfe Worker-Scripts
npm run test:audio:system

# 3. Browser-Console öffnen und prüfen:
#    - Keine Fehler in worker.js
#    - AudioContext state = "running"
#    - getUserMedia() erfolgreich
```

### Problem: Tests schlagen fehl nach npm install

```bash
# Rebuild vendored dependencies
npm run build:vendor:mumble-client

# Rebuild
npm run build

# Test erneut
npm run test:audio:system
```

### Problem: Mumble-Client Import fehlschlägt

```bash
# Prüfe, ob lib/ Verzeichnis existiert
ls -la vendors/mumble-client/lib/

# Falls nicht, Babel-Kompilierung starten:
cd vendors/mumble-client
npm run build
cd ../..

# Oder direkt:
npm run build:vendor:mumble-client
```

### Problem: Worker-Script-Fehler

**Symptome:**
- Console-Fehler: "Failed to load worker script"
- Audio funktioniert nicht

**Lösung:**
```bash
# 1. Prüfe Syntax aller Worker
node -c app/worker.js
node -c app/audio/recorder-worker.js
node -c app/audio/encode-worker.js
node -c app/audio/decode-worker.js

# 2. Rebuild
npm run build

# 3. System-Test
npm run test:audio:system
```

### Problem: "AudioContext suspended"

**Ursache:** Browser erfordert User-Interaktion vor Audio-Start

**Lösung:**
- Klicke auf "Connect" Button im UI
- Oder: Rufe im Browser-Console auf:
  ```javascript
  audioContextManager.ensureAudioContext().then(ctx => ctx.resume())
  ```

### Problem: Codespace-Container startet nicht

```bash
# Prüfe Docker-Compose-Konfiguration
cd .devcontainer
docker-compose config

# Manuelle Container-Verwaltung
docker-compose up -d murmur

# Logs prüfen
docker-compose logs murmur
```

---

## 📈 Test-Erfolgsmetriken

### ✅ Erfolgreiche Tests sollten zeigen:

- **Verbindung:** WebSocket-Verbindung etabliert
- **Paket-Rate:** ~50 Pakete/Sekunde (20ms Frames bei 48kHz)
- **Erfolgsrate:** > 95% der Pakete erfolgreich
- **Latenz:** < 100ms Verbindungsaufbau
- **Keine Fehler:** Keine Encoder/Decoder-Fehler

### ⚠️ Normale Warnungen:

- "No audio received" - Normal wenn keine anderen Clients senden
- "Partial test" - Erwartet bei Solo-Tests ohne zweiten Client
- "AudioContext suspended" - Browser-Policy, durch User-Interaktion behoben

### 📊 Performance-Benchmarks

Typische Werte für erfolgreiche Tests:

| Metrik | Erwarteter Wert |
|--------|----------------|
| Paket-Rate | 48-52 Pakete/Sekunde |
| Paket-Größe | ~100-200 Bytes (Opus) |
| Bandbreite | 5-10 KB/s |
| Verbindungszeit | < 500ms |
| First-Packet-Latency | < 100ms |

---

## 📚 Weitere Ressourcen

- **Haupt-README:** [README.md](./README.md) - Projektübersicht und Schnellstart
- **Architektur:** [CLAUDE.md](./CLAUDE.md) - Detaillierte technische Dokumentation
- **Copilot-Kontext:** [.github/copilot-instructions.md](.github/copilot-instructions.md)

---

## 🎯 Zusammenfassung

### Für schnelle Tests:
```bash
npm run test:audio:system  # Kein Server nötig
```

### Für vollständige Tests:
```bash
npm run test:full          # E2E + Audio + Security
```

### Für Entwicklung:
```bash
npm run test:server:up     # Server starten
npm run test:audio:suite   # Tests durchführen
npm run test:server:down   # Server stoppen
```

### Für CI/CD:
```bash
npm run test:audio:system  # In Pipeline einbinden
```

---

<p align="center">
  <strong>Happy Testing! 🎤</strong><br>
  Bei Problemen siehe <a href="#-troubleshooting">Troubleshooting</a>
</p>
