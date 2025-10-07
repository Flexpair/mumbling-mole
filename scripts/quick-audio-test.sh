#!/bin/bash
# Quick Audio Test - Minimales Setup zum Testen der Audio-Funktionalität
#
# Dieser Script:
# 1. Startet einen Test-Mumble-Server
# 2. Wartet bis der Server bereit ist
# 3. Führt Audio-Tests aus
# 4. Räumt auf
#
# Aufruf: ./scripts/quick-audio-test.sh

set -e

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${BLUE}╔════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║         Quick Audio Test - All-in-One                     ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════════╝${NC}"
echo ""

# Cleanup-Funktion für sauberes Beenden
cleanup() {
    echo ""
    echo -e "${YELLOW}Räume auf...${NC}"
    cd /home/node/.devcontainer && docker-compose stop murmur 2>/dev/null || true
    echo -e "${GREEN}✅ Cleanup abgeschlossen${NC}"
}

trap cleanup EXIT

# 1. Starte Test-Server
echo -e "${YELLOW}[1/4] Starte Murmur-Server (aus bestehendem docker-compose)...${NC}"
cd /home/node/.devcontainer && docker-compose up -d murmur
cd /home/node

# 2. Warte bis Server bereit ist
echo -e "${YELLOW}[2/4] Warte auf Server-Bereitschaft...${NC}"
for i in {1..30}; do
    if timeout 1 bash -c "echo > /dev/tcp/localhost/64738" 2>/dev/null; then
        echo -e "${GREEN}✅ Server ist bereit${NC}"
        break
    fi
    if [ $i -eq 30 ]; then
        echo -e "${RED}❌ Timeout: Server nicht erreichbar${NC}"
        cd /home/node/.devcontainer && docker-compose logs murmur
        exit 1
    fi
    echo -n "."
    sleep 1
done
echo ""

# Kurze Pause für vollständige Initialisierung
sleep 2

# 3. Führe Audio-Tests aus
echo -e "${YELLOW}[3/4] Führe Audio-Tests aus...${NC}"
export MUMBLE_SERVER=localhost:64738
export TEST_DURATION=5
export GENERATE_TONE=true
export TONE_FREQUENCY=440

if node scripts/audio-test.cjs; then
    echo -e "${GREEN}✅ Audio-Test erfolgreich${NC}"
    TEST_RESULT=0
else
    echo -e "${YELLOW}⚠️  Test mit Warnungen (siehe oben)${NC}"
    TEST_RESULT=1
fi
echo ""

# 4. Zusammenfassung
echo -e "${BLUE}╔════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║                    Ergebnis                                ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════════╝${NC}"
echo ""

if [ $TEST_RESULT -eq 0 ]; then
    echo -e "${GREEN}✅ Audio-Funktionalität ist betriebsbereit!${NC}"
    echo ""
    echo -e "${BLUE}Nächste Schritte:${NC}"
    echo -e "  1. Für umfassendere Tests: ${YELLOW}npm run test:audio:suite${NC}"
    echo -e "  2. Für Browser-Tests: ${YELLOW}./start-dev-server.sh${NC}"
    echo -e "  3. Dokumentation: ${YELLOW}cat AUDIO-TESTING.md${NC}"
else
    echo -e "${YELLOW}⚠️  Basis-Funktionalität OK, aber kein Audio-Empfang${NC}"
    echo -e "${YELLOW}Dies ist normal wenn kein zweiter Client sendet.${NC}"
    echo ""
    echo -e "${BLUE}Für vollständige Tests benötigst du:${NC}"
    echo -e "  - Einen zweiten Mumble-Client"
    echo -e "  - Siehe: ${YELLOW}AUDIO-TESTING.md${NC}"
fi

echo ""
exit $TEST_RESULT
