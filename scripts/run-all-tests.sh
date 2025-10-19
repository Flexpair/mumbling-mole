#!/bin/bash
# Führt alle Tests aus und zeigt eine Zusammenfassung am Ende

set +e  # Nicht bei erstem Fehler abbrechen

# Farben für bessere Lesbarkeit
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color
BOLD='\033[1m'

# Ergebnis-Arrays
declare -a TEST_NAMES
declare -a TEST_RESULTS
declare -a TEST_TIMES

TOTAL_START=$(date +%s%3N)

# Funktion zum Ausführen eines Tests
run_test() {
    local name="$1"
    local command="$2"
    
    echo ""
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo -e "${BOLD}${BLUE}▶ $name${NC}"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    
    START=$(date +%s%3N)
    eval "$command"
    EXIT_CODE=$?
    END=$(date +%s%3N)
    
    DURATION=$((END - START))
    
    TEST_NAMES+=("$name")
    TEST_TIMES+=("${DURATION}ms")
    
    if [ $EXIT_CODE -eq 0 ]; then
        TEST_RESULTS+=("PASS")
        echo -e "${GREEN}✅ $name bestanden${NC} (${DURATION}ms)"
    else
        TEST_RESULTS+=("FAIL")
        echo -e "${RED}❌ $name fehlgeschlagen${NC} (Exit Code: $EXIT_CODE, ${DURATION}ms)"
    fi
    
    return $EXIT_CODE
}

# Banner
echo ""
echo "╔═══════════════════════════════════════════════════════════════════════════╗"
echo "║                    MUMBLING-MOLE TEST SUITE                               ║"
echo "╚═══════════════════════════════════════════════════════════════════════════╝"
echo ""

# Alle Tests ausführen
run_test "Playwright Loopback Test" "npm run test:loopback"
LOOPBACK_RESULT=$?

run_test "Dependency Audit" "npm run audit:ci"
AUDIT_RESULT=$?

TOTAL_END=$(date +%s%3N)
TOTAL_DURATION=$((TOTAL_END - TOTAL_START))

# Zusammenfassung erstellen
echo ""
echo ""
echo "╔═══════════════════════════════════════════════════════════════════════════╗"
echo "║                         TEST ZUSAMMENFASSUNG                              ║"
echo "╚═══════════════════════════════════════════════════════════════════════════╝"
echo ""

PASS_COUNT=0
FAIL_COUNT=0

for i in "${!TEST_NAMES[@]}"; do
    NAME="${TEST_NAMES[$i]}"
    RESULT="${TEST_RESULTS[$i]}"
    TIME="${TEST_TIMES[$i]}"
    
    if [ "$RESULT" = "PASS" ]; then
        echo -e "  ${GREEN}✅ PASS${NC}  ${NAME} ${BLUE}(${TIME})${NC}"
        ((PASS_COUNT++))
    else
        echo -e "  ${RED}❌ FAIL${NC}  ${NAME} ${BLUE}(${TIME})${NC}"
        ((FAIL_COUNT++))
    fi
done

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

TOTAL_COUNT=$((PASS_COUNT + FAIL_COUNT))

if [ $FAIL_COUNT -eq 0 ]; then
    echo -e "${BOLD}${GREEN}✅ ALLE $TOTAL_COUNT TESTS BESTANDEN${NC}"
else
    echo -e "${BOLD}Ergebnis: ${GREEN}$PASS_COUNT bestanden${NC}, ${RED}$FAIL_COUNT fehlgeschlagen${NC} (von $TOTAL_COUNT)${NC}"
fi

echo -e "${BLUE}Gesamtdauer: ${TOTAL_DURATION}ms${NC}"
echo ""

# Exit mit dem entsprechenden Code
if [ $FAIL_COUNT -gt 0 ]; then
    exit 1
else
    exit 0
fi
