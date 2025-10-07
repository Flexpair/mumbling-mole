# 🚀 Audio-Tests im GitHub Codespace starten

## Schnellstart (2 Schritte)

### 1️⃣ Stelle sicher, dass der Murmur-Server läuft

**Option A: Via Docker Extension (empfohlen)**
1. Öffne die Docker-Extension in VS Code (linke Seitenleiste)
2. Suche "Containers" → finde `murmur`
3. Rechtsklick → "Start" (falls nicht bereits grün)

**Option B: Via Terminal**
```bash
# Öffne ein NEUES Terminal (außerhalb des Containers)
# Drücke: Strg+Shift+` oder Terminal → New Terminal
# Stelle sicher, dass du im Host bist (nicht im Container)

# Dann:
docker compose -f .devcontainer/docker-compose.yml up -d murmur

# Prüfe Status:
docker compose -f .devcontainer/docker-compose.yml ps murmur
```

**Option C: Nutze lokales Codespace-Verhalten**

Der Murmur-Container sollte automatisch beim Codespace-Start gestartet worden sein.
Prüfe ob er läuft:

```bash
# Im DevContainer-Terminal:
timeout 1 bash -c "echo > /dev/tcp/localhost/64738" 2>/dev/null && echo "✅ Läuft" || echo "❌ Nicht verfügbar"
```

### 2️⃣ Führe den Audio-Test aus

**Im DevContainer-Terminal:**

```bash
# Einfacher Test (empfohlen für Codespaces)
./scripts/test-audio-simple.sh

# Oder direkt:
MUMBLE_SERVER=localhost:64738 node scripts/audio-test.cjs
```

## 📊 Was passiert:

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

## 🔧 Alternativen

### Test-Kommandos:

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

### Echtzeit-Monitor:

```bash
MUMBLE_SERVER=localhost:64738 node scripts/audio-monitor.cjs
```

Zeigt Live-Statistiken und VU-Meter. Beenden mit `Strg+C`.

## ❌ Troubleshooting

### Problem: "Server nicht erreichbar"

**1. Prüfe ob Container läuft:**
```bash
# Im Host-Terminal (NICHT im DevContainer):
docker ps | grep murmur
```

Sollte zeigen:
```
CONTAINER ID   IMAGE                  ... STATUS         PORTS
abc123def456   goofball222/murmur     ... Up 5 minutes   0.0.0.0:64738->64738/tcp, ...
```

**2. Starte Container manuell:**
```bash
# Im Host-Terminal:
docker compose -f .devcontainer/docker-compose.yml up -d murmur

# Warte 5 Sekunden
sleep 5

# Prüfe Logs:
docker compose -f .devcontainer/docker-compose.yml logs murmur
```

**3. Prüfe Port-Forwarding im Codespace:**

VS Code sollte automatisch Port 64738 weiterleiten.
- Öffne: "Ports" Tab (neben Terminal)
- Prüfe ob Port 64738 gelistet ist
- Falls nicht: "Forward a Port" → 64738

### Problem: "Kein Audio empfangen"

**Das ist normal!** Die automatisierten Tests prüfen nur das **Senden**.

Um Audio zu **empfangen**, brauchst du einen zweiten Client:

**Option 1: Mumble Desktop-Client**
1. Installiere von https://www.mumble.info/downloads/
2. Port-Forwarding-URL aus Codespace kopieren (Ports Tab → Port 64738)
3. Verbinde mit dieser URL
4. Führe Test aus → Du hörst den 440 Hz Testton! 🔊

**Option 2: Zweiter Browser-Tab**
```bash
# Terminal 1:
MUMBLE_SERVER=localhost:64738 ./start-dev-server.sh

# Browser Tab 1: http://localhost:PORT (siehe Terminal)
# → Verbinden, Mikrofon erlauben

# Browser Tab 2: Gleiche URL
# → Verbinden
# → Spreche in Tab 1, höre in Tab 2
```

## 📝 NPM Scripts (funktionieren teilweise nicht in Codespace)

⚠️ **Hinweis:** Die NPM Scripts, die Docker Compose steuern, funktionieren nur vom **Host**, nicht vom DevContainer:

```bash
# ❌ Funktioniert NICHT im DevContainer:
npm run test:server:up
npm run test:server:down

# ✅ Funktioniert im DevContainer:
npm run test:audio           # Direkt Audio-Test
./scripts/test-audio-simple.sh  # Vereinfachter Test
```

## 🎯 Empfohlener Workflow im Codespace:

```bash
# 1. Prüfe Server (sollte bereits laufen)
timeout 1 bash -c "echo > /dev/tcp/localhost/64738" 2>/dev/null && echo "✅ OK" || echo "❌ Server starten (siehe Anleitung oben)"

# 2. Führe Test aus
./scripts/test-audio-simple.sh

# 3. Bei Erfolg: Integration-Tests
npm run test:full

# 4. Optional: Monitoring
MUMBLE_SERVER=localhost:64738 node scripts/audio-monitor.cjs
```

## 🌐 Mit externem Server testen:

Wenn du einen produktions-ähnlichen Server testen willst:

```bash
export MUMBLE_SERVER=your-server.example.com:64738
export MUMBLE_PASSWORD=your_password

node scripts/audio-test.cjs
```

## ✅ Erfolgreiche Tests zeigen:

- ✅ Verbindung erfolgreich
- ✅ ~50 Pakete/Sekunde gesendet
- ✅ Erfolgsrate >95%
- ✅ Keine Encoder-Fehler

**⚠️ "Kein Audio empfangen" ist normal ohne zweiten Client!**
