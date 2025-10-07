# 🚀 CI Integration Tests - Feature Branch

Dieser Branch fügt vollständige Multi-Service-Integration-Tests zur CI-Pipeline hinzu.

## 🎯 Ziel

Maximale Ähnlichkeit zwischen lokaler Entwicklung (Docker Compose) und CI/CD-Tests, um Produktionsprobleme frühzeitig zu erkennen.

## ✨ Neue Features

### 1. CI-optimierte Docker Compose Konfiguration

**Datei:** `.devcontainer/docker-compose.ci.yml`

- ✅ Health-Checks für alle Services
- ✅ Selbstsignierte SSL-Zertifikate (keine Let's Encrypt Abhängigkeit)
- ✅ Inline-Konfiguration (keine Volume-Mounts)
- ✅ Optimierte Startup-Zeit (~15s statt ~30s)
- ✅ Separates Netzwerk (vermeidet Konflikte mit Dev-Setup)

**Services:**
- `murmur` - Mumble Server (Port 64738)
- `mumble` - Mumble Web Client (Port 8081)
- `guacamole` - Remote Desktop Gateway (Port 8080)
- `postgres` - Datenbank für Guacamole
- `guacd` - Guacamole Daemon
- `nginx` - Reverse Proxy mit SSL (Port 8443/8000)

### 2. Health-Check Script

**Datei:** `scripts/health-check.cjs`

Prüft automatisch die Bereitschaft aller Services:

```bash
# Verwendung
COMPOSE_FILE=.devcontainer/docker-compose.ci.yml node scripts/health-check.cjs

# Mit Timeout
HEALTH_CHECK_TIMEOUT=180 npm run test:integration:health
```

**Features:**
- TCP-Port-Checks (Murmur)
- HTTP/HTTPS-Checks (Mumble, Guacamole, Nginx)
- Container-Status-Anzeige
- Automatisches Warten (bis zu 120s)
- Detaillierte Fehlerdiagnostik

### 3. Integration-Test Suite

**Datei:** `scripts/integration-test.cjs`

Testet die vollständige Service-Interaktion:

```bash
# Verwendung
npm run test:integration

# Verbose Modus
INTEGRATION_TEST_VERBOSE=1 npm run test:integration

# Komplett (Health + Integration)
npm run test:integration:full
```

**Test-Kategorien:**
- 🎤 **Mumble Service** (4 Tests)
  - HTTP Endpoint, WebSocket, Static Assets, UI
- 🖥️ **Guacamole Service** (3 Tests)
  - Endpoint, Login Page, Resources
- 🔀 **Nginx Proxy** (5 Tests)
  - HTTP/HTTPS, SSL, Proxy-Routing
- 🔗 **Cross-Service** (3 Tests)
  - Backend-Kommunikation, Timeouts

**Gesamt: 15 Integration-Tests**

### 4. GitHub Actions Workflow

**Datei:** `.github/workflows/docker-image.yml`

Neuer Job: `integration`

**Ablauf:**
1. ✅ Build Docker Image
2. ✅ Start Docker Compose Stack
3. ✅ Wait for Health-Checks (max 180s)
4. ✅ Run Integration Tests
5. ✅ Cleanup (auch bei Fehlern)

**Wann läuft der Job?**
- Bei Pull Requests
- Bei Push auf `lite` Branch
- Nach erfolgreichem `docker` Job

### 5. NPM Scripts

Neue Scripts in `package.json`:

```json
{
  "test:integration": "node scripts/integration-test.cjs",
  "test:integration:health": "node scripts/health-check.cjs",
  "test:integration:full": "npm run test:integration:health && npm run test:integration"
}
```

### 6. Erweiterte Dokumentation

**Datei:** `TESTING.md`

Neue Sektionen:
- 🔗 Integration-Tests
- 🏥 Health-Check System
- 🚀 CI/CD Best Practices
- 📊 Multi-Service Test-Matrix

## 🧪 Lokales Testing

### Quick Start

```bash
# 1. Docker Compose Stack starten
docker compose -f .devcontainer/docker-compose.ci.yml up -d

# 2. Auf Services warten
npm run test:integration:health

# 3. Tests ausführen
npm run test:integration

# 4. Cleanup
docker compose -f .devcontainer/docker-compose.ci.yml down -v
```

### Erwartete Ausgabe

```
🏥 Service Health Check
======================================================================
Compose file: .devcontainer/docker-compose.ci.yml
Timeout: 120s

📦 Container Status:
✅ murmur               running (healthy)
✅ mumble               running (healthy)
✅ guacamole            running (healthy)
✅ nginx                running (healthy)

📊 Health Check Results:

✅ Mumble Server (TCP)   HEALTHY
✅ Mumble Web Client     HEALTHY
✅ Guacamole Web         HEALTHY
✅ Nginx HTTP            HEALTHY
✅ Nginx HTTPS           HEALTHY

✅ All services HEALTHY (12.3s)
======================================================================

🧪 Integration Test Suite
======================================================================

🎤 Testing Mumble Service
  ✅ HTTP endpoint accessible (245ms)
  ✅ Serves static assets (config.js) (123ms)
  ✅ WebSocket upgrade capability (89ms)
  ✅ Contains Mumble UI elements (156ms)

... (weitere Tests)

✅ All integration tests passed!
```

## 🔄 CI/CD Integration

### GitHub Actions Pipeline

```
┌────────────────────────────────────────────────┐
│  Job 1: docker (Fast Lane)                     │
│  ├─ Security Audit                             │
│  ├─ Audio System Tests                         │
│  ├─ Docker Build                               │
│  └─ E2E Tests                                  │
│      │                                          │
│      ▼ (on success)                             │
│  Job 2: integration (Full Stack) ⭐ NEU        │
│  ├─ Docker Compose Setup                       │
│  ├─ Health Checks                              │
│  ├─ Integration Tests                          │
│  └─ Cleanup                                    │
└────────────────────────────────────────────────┘
```

### Vorteile

1. **Früherkennung von Integrationsproblemen**
   - Service-Kommunikation
   - Proxy-Routing
   - SSL/TLS-Setup

2. **Produktionsnähe**
   - Identisches Setup wie lokal
   - Realistische Netzwerk-Konfiguration
   - Vollständiger Service-Stack

3. **Schnelles Feedback**
   - Parallele Jobs (wenn möglich)
   - Optimierte Container-Images
   - Health-Check-basiertes Warten

4. **Debugging-Freundlich**
   - Detaillierte Service-Logs bei Fehlern
   - Container-Status-Informationen
   - Netzwerk-Diagnostik

## 📊 Vergleich: Development vs CI

| Aspekt | docker-compose.yml | docker-compose.ci.yml |
|--------|-------------------|----------------------|
| **Volumes** | Mounted (live reload) | None (in image) |
| **Certificates** | Let's Encrypt | Self-signed |
| **Configuration** | External files | Inline/generated |
| **Health Checks** | Optional | Required |
| **Network** | guacamole_net | ci_test_net |
| **Startup** | ~30s | ~15s |
| **Use Case** | Development | CI/CD |

## 🐛 Debugging

### Services starten nicht

```bash
# Container-Logs anzeigen
docker compose -f .devcontainer/docker-compose.ci.yml logs

# Spezifischer Service
docker compose -f .devcontainer/docker-compose.ci.yml logs mumble

# Live-Follow
docker compose -f .devcontainer/docker-compose.ci.yml logs -f
```

### Health-Checks schlagen fehl

```bash
# Verbose Health-Check
COMPOSE_FILE=.devcontainer/docker-compose.ci.yml \
HEALTH_CHECK_TIMEOUT=300 \
node scripts/health-check.cjs

# Container-Status prüfen
docker compose -f .devcontainer/docker-compose.ci.yml ps

# Netzwerk prüfen
docker network inspect ci_test_net
```

### Integration-Tests scheitern

```bash
# Verbose Test-Modus
INTEGRATION_TEST_VERBOSE=1 npm run test:integration

# Einzelne Services manuell testen
curl http://127.0.0.1:8081/              # Mumble
curl http://127.0.0.1:8080/guacamole/    # Guacamole
curl https://127.0.0.1:8443/ -k          # Nginx HTTPS
```

### Cleanup-Probleme

```bash
# Komplettes Cleanup
docker compose -f .devcontainer/docker-compose.ci.yml down -v --remove-orphans

# Dangling Container entfernen
docker ps -a --filter "name=_ci" --format "{{.Names}}" | xargs -r docker rm -f

# Dangling Images
docker image prune -f
```

## 📝 Checklist für Review

- [x] CI-optimierte docker-compose.ci.yml erstellt
- [x] Health-Check Script implementiert
- [x] Integration-Test Suite implementiert
- [x] GitHub Actions Workflow erweitert
- [x] NPM Scripts hinzugefügt
- [x] TESTING.md aktualisiert
- [x] Lokale Tests erfolgreich
- [ ] CI-Tests auf GitHub erfolgreich (nach Merge)

## 🚀 Next Steps

1. **Merge in `lite` Branch**
   ```bash
   git checkout lite
   git merge feature/ci-compose-integration
   git push origin lite
   ```

2. **GitHub Actions beobachten**
   - Prüfe, ob Integration-Job läuft
   - Validiere Test-Ergebnisse
   - Überprüfe Logs bei Fehlern

3. **Optional: Weitere Tests hinzufügen**
   - Audio-Roundtrip über Proxy
   - Guacamole-Verbindungstest
   - Performance-Tests

## 📚 Referenzen

- [Docker Compose Documentation](https://docs.docker.com/compose/)
- [GitHub Actions Documentation](https://docs.github.com/en/actions)
- [Docker Health Checks](https://docs.docker.com/engine/reference/builder/#healthcheck)
- [Project Testing Guide](./TESTING.md)

## 💡 Tipps

- Nutze `docker compose -f .devcontainer/docker-compose.ci.yml` für alle CI-bezogenen Befehle
- Health-Checks sind kritisch - ohne sie starten Tests zu früh
- Verbose-Modus hilft beim Debugging: `INTEGRATION_TEST_VERBOSE=1`
- Cleanup ist wichtig - sonst blockieren alte Container die Ports

---

**Autor:** GitHub Copilot  
**Datum:** 2025-10-07  
**Branch:** feature/ci-compose-integration
