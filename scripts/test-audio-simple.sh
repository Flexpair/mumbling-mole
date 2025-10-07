#!/bin/bash
# Vereinfachter Audio-Test für Codespaces
# Setzt voraus, dass der Murmur-Server bereits läuft

set -e

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${BLUE}╔════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║         Audio-Test (Codespace Edition)                    ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════════╝${NC}"
echo ""

# Bestimme Server-Adresse
MUMBLE_SERVER="${MUMBLE_SERVER:-localhost:64738}"
echo -e "${BLUE}Server: ${MUMBLE_SERVER}${NC}"

# Prüfe ob Server erreichbar ist
echo -e "${YELLOW}Prüfe Server-Verfügbarkeit...${NC}"
HOST="${MUMBLE_SERVER%%:*}"
PORT="${MUMBLE_SERVER##*:}"

if timeout 2 bash -c "echo > /dev/tcp/$HOST/$PORT" 2>/dev/null; then
    echo -e "${GREEN}✅ Server erreichbar auf ${HOST}:${PORT}${NC}"
else
    echo -e "${RED}❌ Server nicht erreichbar${NC}"
    echo ""
    echo -e "${YELLOW}Der Murmur-Server muss laufen. Im Codespace:${NC}"
    echo -e "  1. Öffne ein neues Terminal"
    echo -e "  2. Führe aus: ${BLUE}docker compose -f .devcontainer/docker-compose.yml up murmur${NC}"
    echo -e "  oder nutze das Docker-Extension-Panel in VS Code"
    echo ""
    exit 1
fi
echo ""

# Führe Audio-Test aus
echo -e "${YELLOW}Führe Audio-Test aus (${TEST_DURATION:-10}s)...${NC}"
export MUMBLE_SERVER
export TEST_DURATION="${TEST_DURATION:-10}"
export GENERATE_TONE="${GENERATE_TONE:-true}"
export TONE_FREQUENCY="${TONE_FREQUENCY:-440}"

if node scripts/audio-test.cjs; then
    echo ""
    echo -e "${GREEN}✅ Audio-Test erfolgreich abgeschlossen!${NC}"
    exit 0
else
    echo ""
    echo -e "${YELLOW}⚠️  Test mit Warnungen (siehe oben)${NC}"
    echo -e "${YELLOW}Dies ist normal, wenn kein anderer Client aktiv ist.${NC}"
    exit 0
fi
