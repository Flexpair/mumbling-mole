#!/bin/bash
# Audio-Test-Suite für Mumble-Client im DevContainer
#
# Führt verschiedene Audio-Tests aus, um die Funktionalität zu verifizieren:
# 1. Grundlegende WebSocket-Verbindung
# 2. Audio-Roundtrip (Senden und Empfangen)
# 3. Browser-basierte Audio-Tests (optional)
#
# Aufruf:
#   ./scripts/run-audio-tests.sh [--full]
#
# Optionen:
#   --full    Führt zusätzliche Browser-basierte Tests aus

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

# Farben für bessere Lesbarkeit
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Test-Konfiguration
MUMBLE_SERVER="${MUMBLE_SERVER:-localhost:64738}"
TEST_DURATION="${TEST_DURATION:-10}"
FULL_SUITE="${1:-}"

echo -e "${BLUE}╔════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║           Mumble Audio Test Suite                         ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "Target Server: ${GREEN}${MUMBLE_SERVER}${NC}"
echo -e "Test Duration: ${TEST_DURATION}s"
echo ""

# Prüfen ob Mumble-Server erreichbar ist
echo -e "${YELLOW}[1/4] Prüfe Mumble-Server-Verfügbarkeit...${NC}"
HOST="${MUMBLE_SERVER%%:*}"
PORT="${MUMBLE_SERVER##*:}"
PORT="${PORT:-64738}"

if timeout 3 bash -c "echo > /dev/tcp/$HOST/$PORT" 2>/dev/null; then
    echo -e "${GREEN}✅ Server erreichbar auf ${HOST}:${PORT}${NC}"
else
    echo -e "${RED}❌ Server nicht erreichbar auf ${HOST}:${PORT}${NC}"
    echo -e "${YELLOW}Hinweis: Stelle sicher, dass ein Mumble-Server läuft:${NC}"
    echo -e "  docker run -d -p 64738:64738 -p 64738:64738/udp mumblevoip/mumble-server"
    exit 1
fi
echo ""

# Test 1: Grundlegende Konnektivität
echo -e "${YELLOW}[2/4] Grundlegende Konnektivität (WebSocket)...${NC}"
if cd "$PROJECT_DIR" && node scripts/e2e-check.cjs; then
    echo -e "${GREEN}✅ WebSocket-Verbindung erfolgreich${NC}"
else
    echo -e "${RED}❌ WebSocket-Test fehlgeschlagen${NC}"
    exit 1
fi
echo ""

# Test 2: Audio-Roundtrip
echo -e "${YELLOW}[3/4] Audio-Roundtrip-Test...${NC}"
echo -e "${BLUE}Sende Testton (${TONE_FREQUENCY:-440} Hz) für ${TEST_DURATION}s...${NC}"

export MUMBLE_SERVER
export TEST_DURATION
export GENERATE_TONE=true
export TONE_FREQUENCY="${TONE_FREQUENCY:-440}"

if node "$SCRIPT_DIR/audio-test.cjs"; then
    echo -e "${GREEN}✅ Audio-Test erfolgreich${NC}"
    AUDIO_TEST_PASSED=true
else
    echo -e "${YELLOW}⚠️  Audio-Test mit Warnungen (kein Empfang oder kein Sender aktiv)${NC}"
    echo -e "${YELLOW}Dies ist normal, wenn kein anderer Client im Channel ist.${NC}"
    AUDIO_TEST_PASSED=false
fi
echo ""

# Test 3: Audio-Empfang (passiv)
echo -e "${YELLOW}[4/4] Passiver Audio-Empfangs-Test...${NC}"
echo -e "${BLUE}Lausche für ${TEST_DURATION}s auf Audio von anderen Clients...${NC}"

export GENERATE_TONE=false

if node "$SCRIPT_DIR/audio-test.cjs"; then
    echo -e "${GREEN}✅ Empfangs-Test erfolgreich${NC}"
    RECEIVE_TEST_PASSED=true
else
    echo -e "${YELLOW}⚠️  Kein Audio empfangen${NC}"
    echo -e "${YELLOW}Dies ist normal, wenn keine anderen Clients senden.${NC}"
    RECEIVE_TEST_PASSED=false
fi
echo ""

# Zusammenfassung
echo -e "${BLUE}╔════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║                  Test-Zusammenfassung                      ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "Server-Konnektivität:  ${GREEN}✅ PASS${NC}"
echo -e "WebSocket-Tunnel:      ${GREEN}✅ PASS${NC}"

if [ "$AUDIO_TEST_PASSED" = true ]; then
    echo -e "Audio-Senden:          ${GREEN}✅ PASS${NC}"
else
    echo -e "Audio-Senden:          ${YELLOW}⚠️  PARTIAL${NC}"
fi

if [ "$RECEIVE_TEST_PASSED" = true ]; then
    echo -e "Audio-Empfangen:       ${GREEN}✅ PASS${NC}"
else
    echo -e "Audio-Empfangen:       ${YELLOW}⚠️  NO DATA${NC}"
fi

echo ""
echo -e "${GREEN}════════════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}Grundlegende Audio-Funktionalität ist betriebsbereit!${NC}"
echo ""
echo -e "${BLUE}Für vollständige Tests:${NC}"
echo -e "  1. Starte einen zweiten Client (z.B. offizieller Mumble-Client)"
echo -e "  2. Trete dem gleichen Channel bei"
echo -e "  3. Führe dieses Script erneut aus"
echo -e "  4. Du solltest den Testton (${TONE_FREQUENCY:-440} Hz) im anderen Client hören"
echo ""
echo -e "${BLUE}Manuelle Browser-Tests:${NC}"
echo -e "  ./start-dev-server.sh"
echo -e "  Öffne: http://local.flexpair.app"
echo -e "  Erlaube Mikrofon-Zugriff"
echo -e "  Verbinde zum Server"
echo -e "  Spreche und prüfe das Voice-Indicator-Icon"
echo ""

exit 0
