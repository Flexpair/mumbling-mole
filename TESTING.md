# 🧪 Testing Guide für Mumbling Mole

Umfassende Dokumentation für das Testing des Audio-Systems und der Multi-Service-Integration, sowohl lokal als auch in CI/CD.

## 📋 Inhaltsverzeichnis

- [Schnellstart](#-schnellstart)
- [Test-Übersicht](#-test-übersicht)
- [Audio-System-Tests](#-audio-system-tests)
- [Integration-Tests](#-integration-tests)
- [Test-Szenarien](#-test-szenarien)
- [Codespace-spezifische Anleitung](#-testing-in-github-codespaces)
- [CI/CD Integration](#-cicd-integration)
- [Troubleshooting](#-troubleshooting)

---

## 🚀 Schnellstart

### Minimaler Test (empfohlen)

Der schnellste Weg, um alle kritischen Audio-Komponenten zu testen:

```bash
# Automatisierter Audio-System Test (kein Live-Server erforderlich)
npm run test:audio:system

# Vollständige Test-Suite
npm run test:full
```

### Integration-Tests (Multi-Service)

Testet die vollständige Service-Stack-Interaktion (Mumble, Guacamole, Nginx):

```bash
# Starte Docker Compose Stack
docker compose -f .devcontainer/docker-compose.ci.yml up -d

# Warte auf Health-Checks
npm run test:integration:health

# Führe Integration-Tests aus
npm run test:integration

# Oder alles zusammen
npm run test:integration:full

# Cleanup
docker compose -f .devcontainer/docker-compose.ci.yml down -v
```

### All-in-One Test mit Live-Server

```bash
# Startet automatisch einen Test-Server, führt Tests aus und räumt auf
./scripts/quick-audio-test.sh
```

---

## 📊 Test-Übersicht

### Verfügbare NPM Scripts

| Script | Beschreibung |
|--------|--------------|
| `npm run test` | E2E Tests + Security Audit |
| `npm run test:full` | Alle Tests (E2E + Audio + Audit) |
| `npm run test:quick` | Schnelle Test-Suite (Audio System + E2E + Audit) |
| `npm run test:audio:system` | Audio-System-Test (kein Server nötig) |
| `npm run test:audio` | Einzelner Audio-Roundtrip-Test |
| `npm run test:audio:suite` | Vollständige Audio-Test-Suite |
| `npm run test:e2e` | WebSocket Smoke Test |
| `npm run test:integration` | Multi-Service Integration-Tests |
| `npm run test:integration:health` | Health-Check aller Services |
| `npm run test:integration:full` | Health-Check + Integration-Tests |
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

6. **`scripts/health-check.cjs`** ⭐ NEU - Service Health-Check
   - Prüft alle Docker Compose Services
   - Wartet auf Service-Bereitschaft
   - TCP/HTTP/HTTPS Checks
   - Zeigt detaillierte Service-Status

7. **`scripts/integration-test.cjs`** ⭐ NEU - Multi-Service Integration
   - Testet Mumble ↔ Murmur Kommunikation
   - Prüft Nginx Reverse Proxy Routing
   - Validiert Guacamole Verfügbarkeit
   - Cross-Service-Tests

---

## 🔗 Integration-Tests

### Übersicht

Die Integration-Tests validieren das vollständige Multi-Service-Setup:

```
┌─────────────────────────────────────────────────────┐
│  Nginx (Reverse Proxy)                              │
│  ├─ /mumble/     → Mumble Web Client                │
│  └─ /guacamole/  → Guacamole                        │
└─────────────────────────────────────────────────────┘
         │                           │
         ▼                           ▼
┌──────────────────┐       ┌──────────────────┐
│  Mumble Web      │       │  Guacamole       │
│  (Port 8081)     │       │  (Port 8080)     │
└──────────────────┘       └──────────────────┘
         │                           │
         ▼                           ▼
┌──────────────────┐       ┌──────────────────┐
│  Murmur Server   │       │  Guacd + DB      │
│  (Port 64738)    │       │                  │
└──────────────────┘       └──────────────────┘
```

### Was wird getestet?

#### 1. Mumble Service Tests
- ✅ HTTP endpoint erreichbar
- ✅ Statische Assets verfügbar (config.js, theme.js)
- ✅ WebSocket-Upgrade funktioniert
- ✅ UI-Elemente vorhanden

#### 2. Guacamole Service Tests
- ✅ Guacamole endpoint erreichbar
- ✅ Login-Seite lädt korrekt
- ✅ Statische Ressourcen verfügbar

#### 3. Nginx Proxy Tests
- ✅ HTTP → HTTPS Redirect
- ✅ SSL/TLS Zertifikat (self-signed)
- ✅ `/mumble/` Routing zum Backend
- ✅ `/guacamole/` Routing zum Backend

#### 4. Cross-Service Tests
- ✅ Nginx → Mumble Kommunikation
- ✅ Nginx → Guacamole Kommunikation
- ✅ Alle Services antworten innerhalb Timeout

### Lokale Ausführung

```bash
# 1. Docker Compose Stack starten
docker compose -f .devcontainer/docker-compose.ci.yml up -d

# 2. Auf Services warten (max 180s)
HEALTH_CHECK_TIMEOUT=180 npm run test:integration:health

# 3. Integration-Tests ausführen
npm run test:integration

# Optional: Verbose Modus für Debugging
INTEGRATION_TEST_VERBOSE=1 npm run test:integration

# 4. Cleanup
docker compose -f .devcontainer/docker-compose.ci.yml down -v
```

### Erwartete Ausgabe

```
======================================================================
🧪 Integration Test Suite
======================================================================

🎤 Testing Mumble Service
  ✅ HTTP endpoint accessible (245ms)
  ✅ Serves static assets (config.js) (123ms)
  ✅ WebSocket upgrade capability (89ms)
  ✅ Contains Mumble UI elements (156ms)

🖥️  Testing Guacamole Service
  ✅ Guacamole endpoint accessible (312ms)
  ✅ Guacamole login page loads (189ms)
  ✅ Guacamole serves static resources (134ms)

🔀 Testing Nginx Reverse Proxy
  ✅ HTTP endpoint (port 8000) (67ms)
  ✅ HTTPS endpoint (port 8443) (98ms)
  ✅ Mumble proxy route (/mumble/) (145ms)
  ✅ Guacamole proxy route (/guacamole/) (167ms)
  ✅ SSL/TLS certificate (self-signed) (76ms)

🔗 Testing Cross-Service Communication
  ✅ Nginx → Mumble backend (234ms)
  ✅ Nginx → Guacamole backend (198ms)
  ✅ All services respond within timeout (456ms)

======================================================================
📊 Integration Tests - Summary
======================================================================
Total tests: 15
Passed: 15
Failed: 0
Duration: 3.42s
======================================================================

✅ All integration tests passed!
```

### CI-optimierte Docker Compose Konfiguration

Die Datei `.devcontainer/docker-compose.ci.yml` ist speziell für CI/CD optimiert:

**Unterschiede zu `docker-compose.yml`:**

| Feature | Development | CI |
|---------|-------------|-----|
| Volumes | Mounted (live reload) | None (in image) |
| Health Checks | Optional | Required |
| Networks | Named persistent | Ephemeral |
| Certificates | Let's Encrypt | Self-signed |
| Configuration | External files | Inline/generated |
| Startup Time | ~30s | ~15s |
| Cleanup | Manual | Automatic |

**Key Features:**
- ✅ Health-Checks für alle Services
- ✅ Automatische Zertifikat-Generierung
- ✅ Inline-Konfiguration (keine Volumes)
- ✅ Optimierte Startup-Reihenfolge
- ✅ Separate Netzwerk-Ranges (vermeidet Konflikte)

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

### Erwartete Ausgabe (Erfolg)

```
╔════════════════════════════════════════════════════════════╗
║         Automatisierter Audio-System Test                 ║
║         (Kein Live-Server erforderlich)                    ║
╚════════════════════════════════════════════════════════════╝

[✅] Mumble-Client Build (30.5 KB)
[✅] Mumble-Client Import
[✅] Mumble-Client Instanziierung
[✅] Audio-Codecs
[✅] Worker-Scripts (5 Dateien)
[✅] Audio-Dependencies
[✅] Audio-Module
[✅] NPM Scripts
[✅] Webpack Build
[✅] Audio-Paket-Generierung (440 Hz)

✅ ALLE TESTS BESTANDEN (10/10 in 0.3s)
   Audio-System bereit für Produktion!
```

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
   - Prüfe app/recorder-worker.js Zeile 42
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

### GitHub Actions Workflow-Struktur

Das Projekt nutzt einen **mehrstufigen CI/CD-Ansatz** für optimale Test-Abdeckung:

```
GitHub Actions Pipeline
├── Job 1: docker (Fast Lane)
│   ├── Security Audit
│   ├── Dependency Check
│   ├── Audio System Tests (no server)
│   ├── Docker Build
│   ├── HTML Smoke Test (single container)
│   ├── E2E WebSocket Test
│   └── Docker Push (on success)
│
└── Job 2: integration (Full Stack) ⭐ NEU
    ├── Docker Compose Setup
    ├── Health Checks (all services)
    ├── Integration Tests (multi-service)
    └── Cleanup
```

#### Job 1: Fast Lane (docker)

**Zweck:** Schnelles Feedback für häufige Probleme

- ⚡ Läuft bei jedem Push/PR
- 🔒 Security & Dependency Checks
- 🧪 Audio-System-Tests (ohne Server)
- 🐳 Docker Build & Smoke Tests
- ⏱️ Dauer: ~3-5 Minuten

#### Job 2: Integration Tests (integration) ⭐ NEU

**Zweck:** Vollständige Multi-Service-Validierung

- 🔗 Startet kompletten Docker Compose Stack
- 🏥 Health-Checks für alle Services
- 🧪 Cross-Service-Integration-Tests
- 🔀 Nginx Reverse-Proxy-Tests
- ⏱️ Dauer: ~5-7 Minuten

**Wann läuft es?**
- ✅ Bei Pull Requests (vor Merge)
- ✅ Bei Push auf `lite` Branch
- ⏭️ Nach erfolgreichem `docker` Job

### Lokale CI-Simulation

Teste die komplette CI-Pipeline lokal:

```bash
# 1. Schnelle Tests (wie CI Job 1)
npm run test:quick

# 2. Integration-Tests (wie CI Job 2)
docker compose -f .devcontainer/docker-compose.ci.yml up -d
npm run test:integration:full
docker compose -f .devcontainer/docker-compose.ci.yml down -v

# 3. Vollständige Suite
npm run test:full
```

### CI-Spezifische Umgebungsvariablen

```bash
# Health-Check Timeout (Standard: 120s)
HEALTH_CHECK_TIMEOUT=180

# Integration-Test Verbose-Modus
INTEGRATION_TEST_VERBOSE=1

# Docker Compose Datei
COMPOSE_FILE=.devcontainer/docker-compose.ci.yml

# E2E Test Konfiguration
E2E_WS_PORT=8082
E2E_TCP_PORT=5900
E2E_TARGET_HOST=127.0.0.1
```

### GitHub Actions Workflow (Auszug)

```yaml
# .github/workflows/docker-image.yml

jobs:
  docker:
    runs-on: ubuntu-latest
    steps:
      # ... Build & Test Steps ...
      
  integration:
    runs-on: ubuntu-latest
    needs: docker
    steps:
      - name: Start Docker Compose services
        run: |
          docker compose -f .devcontainer/docker-compose.ci.yml up -d
      
      - name: Wait for services to be healthy
        env:
          HEALTH_CHECK_TIMEOUT: "180"
        run: node scripts/health-check.cjs
      
      - name: Run integration tests
        run: node scripts/integration-test.cjs
      
      - name: Cleanup
        if: always()
        run: |
          docker compose -f .devcontainer/docker-compose.ci.yml down -v
```

### Pre-Commit Hooks

Verhindere defekte Commits lokal:

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

### Andere CI-Systeme

#### GitLab CI (.gitlab-ci.yml)

```yaml
stages:
  - test
  - integration

test:audio:
  stage: test
  image: node:22
  script:
    - npm ci
    - npm run test:audio:system
    - npm run test:quick

integration:multi-service:
  stage: integration
  image: docker:latest
  services:
    - docker:dind
  before_script:
    - apk add --no-cache docker-compose nodejs npm
  script:
    - npm ci
    - docker compose -f .devcontainer/docker-compose.ci.yml up -d
    - npm run test:integration:full
    - docker compose -f .devcontainer/docker-compose.ci.yml down -v
```

#### Jenkins (Jenkinsfile)

```groovy
pipeline {
  agent any
  
  stages {
    stage('Test') {
      steps {
        sh 'npm ci'
        sh 'npm run test:audio:system'
      }
    }
    
    stage('Integration') {
      steps {
        sh 'docker compose -f .devcontainer/docker-compose.ci.yml up -d'
        sh 'npm run test:integration:full'
      }
    }
  }
  
  post {
    always {
      sh 'docker compose -f .devcontainer/docker-compose.ci.yml down -v'
    }
  }
}
```

### Best Practices für CI

1. **Parallele Ausführung nutzen**
   - Audio-System-Tests laufen ohne Server (schnell)
   - Integration-Tests nur bei wichtigen Branches

2. **Caching aktivieren**
   ```yaml
   - uses: actions/cache@v3
     with:
       path: ~/.npm
       key: ${{ runner.os }}-node-${{ hashFiles('**/package-lock.json') }}
   ```

3. **Timeout-Limits setzen**
   ```yaml
   timeout-minutes: 15  # Verhindert hängende Jobs
   ```

4. **Artifacts speichern bei Fehlern**
   ```yaml
   - uses: actions/upload-artifact@v3
     if: failure()
     with:
       name: service-logs
       path: /tmp/*.log
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
npm run build:force

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

# Clean rebuild
npm run build:force

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
node -c app/recorder-worker.js
node -c app/encode-worker.js
node -c app/decode-worker.js

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
