#!/bin/bash
# ============================================================================
# generate-proto.sh - Generiert mumble-proto-minimal.js aus Mumble.proto
# ============================================================================
#
# Verwendung:
#   ./scripts/generate-proto.sh
#
# Voraussetzungen:
#   - Node.js >= 22
#   - npm install (protobufjs muss installiert sein)
#
# Was passiert:
#   1. Prüft ob protobufjs installiert ist
#   2. Generiert statisches JS-Modul aus Mumble.proto (camelCase Feldnamen)
#   3. Konvertiert zu ES Module Format
#   4. Entfernt überflüssige Methoden (verify, fromObject, toObject, *Delimited)
#      → Reduziert Dateigröße von ~270KB auf ~125KB
#   5. Führt Tests aus um Kompatibilität zu prüfen
#
# Optimierung:
#   Die App nutzt nur 4 von 9 protobufjs-Methoden pro Message-Typ:
#   - create(): Message-Instanz aus Plain Object erzeugen
#   - encode(): Message zu Protobuf-Bytes serialisieren
#   - decode(): Protobuf-Bytes zu Message deserialisieren
#   - getTypeUrl(): Intern von protobufjs benötigt
#
#   Entfernte Methoden (nicht benötigt):
#   - verify: Server validiert sowieso
#   - fromObject/toObject: create() reicht, dekodierte Messages direkt nutzbar
#   - encodeDelimited/decodeDelimited: Mumble nutzt eigenes Header-Format
#
# Zum Aktualisieren der Proto-Definition:
#   1. Aktuelle Mumble.proto von GitHub holen:
#      curl -o app/mumble-streams/Mumble.proto \
#        https://raw.githubusercontent.com/mumble-voip/mumble/master/src/Mumble.proto
#   2. Dieses Script ausführen
#   3. Tests ausführen: npm run test:unit
#
# ============================================================================

set -e  # Bei Fehler abbrechen

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
PROTO_DIR="$PROJECT_ROOT/app/mumble-streams"
PROTO_FILE="$PROTO_DIR/Mumble.proto"
OUTPUT_FILE="$PROTO_DIR/mumble-proto-minimal.js"
BACKUP_FILE="$PROTO_DIR/mumble-proto-minimal.js.backup"

# Farben für Ausgabe
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo "=============================================="
echo "  Mumble Proto Generator"
echo "=============================================="
echo ""

# Prüfe ob Proto-Datei existiert
if [ ! -f "$PROTO_FILE" ]; then
    echo -e "${RED}Fehler: $PROTO_FILE nicht gefunden${NC}"
    echo ""
    echo "Aktuelle Proto-Definition von Mumble holen:"
    echo "  curl -o $PROTO_FILE \\"
    echo "    https://raw.githubusercontent.com/mumble-voip/mumble/master/src/Mumble.proto"
    exit 1
fi

# Prüfe ob protobufjs-cli installiert ist
PBJS="$PROJECT_ROOT/node_modules/.bin/pbjs"

if [ ! -f "$PBJS" ]; then
    echo -e "${YELLOW}protobufjs-cli nicht installiert, installiere...${NC}"
    cd "$PROJECT_ROOT"
    npm install --save-dev protobufjs-cli
    
    if [ ! -f "$PBJS" ]; then
        echo -e "${RED}Fehler: pbjs konnte nicht installiert werden${NC}"
        exit 1
    fi
fi

# Backup erstellen
if [ -f "$OUTPUT_FILE" ]; then
    echo -e "${YELLOW}Erstelle Backup: $BACKUP_FILE${NC}"
    cp "$OUTPUT_FILE" "$BACKUP_FILE"
fi

echo ""
echo "Generiere JavaScript aus Proto-Definition..."
echo "  Input:  $PROTO_FILE"
echo "  Output: $OUTPUT_FILE"
echo ""

# Temporäre Datei für CommonJS Output
TEMP_FILE=$(mktemp)

# Generiere statisches Modul (ES6)
# Ohne --keep-case: protobufjs konvertiert automatisch snake_case → camelCase
# --no-comments entfernt JSDoc für kleinere Dateigröße ("minimal")
echo "Führe aus: $PBJS --target static-module --wrap es6 --es6 --no-comments ..."
"$PBJS" \
    --target static-module \
    --wrap es6 \
    --es6 \
    --no-comments \
    "$PROTO_FILE" \
    > "$TEMP_FILE"

# Post-Processing: 
# 1. Import-Pfad anpassen (protobufjs/minimal.js statt protobufjs/minimal)
# 2. Import-Syntax anpassen (default export statt namespace import)
# 3. Überflüssige Methoden entfernen (wir nutzen nur create, encode, decode, getTypeUrl)
#    - verify: Wir vertrauen unseren eigenen Daten, Server validiert sowieso
#    - fromObject: create() reicht - wir haben schon die richtigen Typen
#    - toObject: Dekodierte Messages sind direkt nutzbar
#    - toJSON: Nutzt intern toObject, nicht benötigt
#    - encodeDelimited/decodeDelimited: Mumble nutzt eigenes Header-Format

echo "Post-Processing: Import-Syntax anpassen..."
sed -i '' 's|from "protobufjs/minimal"|from "protobufjs/minimal.js"|g' "$TEMP_FILE"
sed -i '' 's|import \* as \$protobuf|import \$protobuf|g' "$TEMP_FILE"

echo "Post-Processing: Überflüssige Methoden entfernen..."
# Erstelle temporäre Datei für optimierte Ausgabe
OPTIMIZED_FILE=$(mktemp)

# Node.js Script zum Entfernen der überflüssigen Methoden
# (sed kann keine mehrzeiligen Patterns gut handhaben)
node -e "
const fs = require('fs');
const content = fs.readFileSync('$TEMP_FILE', 'utf8');

// Patterns für die 6 überflüssigen Methoden (mehrzeilig)
// Jede Methode hat das Format: TypeName.methodName = function methodName(...) { ... };
const methodsToRemove = ['verify', 'fromObject', 'toObject', 'encodeDelimited', 'decodeDelimited'];

let optimized = content;

for (const method of methodsToRemove) {
    // Pattern: NameSpace.method = function method(...) { ... };
    // Muss mehrzeilige Funktionskörper matchen
    const regex = new RegExp(
        '\\\\n\\\\s*\\\\/\\\\*\\\\*[^*]*\\\\*\\\\/\\\\n\\\\s*\\\\w+\\\\.' + method + ' = function ' + method + '\\\\([^)]*\\\\) \\\\{[\\\\s\\\\S]*?\\\\n\\\\s*\\\\};',
        'g'
    );
    optimized = optimized.replace(regex, '');
    
    // Variante ohne JSDoc (wir nutzen --no-comments, aber sicherheitshalber)
    const regexNoDoc = new RegExp(
        '\\\\n\\\\s*\\\\w+\\\\.' + method + ' = function ' + method + '\\\\([^)]*\\\\) \\\\{[\\\\s\\\\S]*?\\\\n\\\\s*\\\\};',
        'g'
    );
    optimized = optimized.replace(regexNoDoc, '');
}

// toJSON ist auf prototype definiert: TypeName.prototype.toJSON = function toJSON() { ... };
// Format: 3 Zeilen - Funktionskopf, return-Statement, schließende Klammer
const toJSONRegex = /\\n\\s*\\w+\\.prototype\\.toJSON = function toJSON\\(\\) \\{\\n[^}]+\\};/g;
optimized = optimized.replace(toJSONRegex, '');

// Entferne leere Zeilen die durch das Entfernen entstanden sind (max 2 aufeinanderfolgende)
optimized = optimized.replace(/\\n{3,}/g, '\\n\\n');

fs.writeFileSync('$OPTIMIZED_FILE', optimized);

// Statistik ausgeben
const removedLines = content.split('\\n').length - optimized.split('\\n').length;
console.log('  Entfernte Zeilen: ' + removedLines);
console.log('  Entfernte Methoden: ' + methodsToRemove.join(', '));
"

# Ersetze temporäre Datei mit optimierter Version
mv "$OPTIMIZED_FILE" "$TEMP_FILE"

# Verschiebe Datei zum Ziel
mv "$TEMP_FILE" "$OUTPUT_FILE"

echo -e "${GREEN}✓ Generierung erfolgreich!${NC}"
echo ""

# Zeige Statistiken
LINES=$(wc -l < "$OUTPUT_FILE")
SIZE=$(du -h "$OUTPUT_FILE" | cut -f1)
echo "Statistiken:"
echo "  Zeilen: $LINES"
echo "  Größe:  $SIZE"
echo ""

# Prüfe ob wichtige Message-Typen vorhanden sind
echo "Prüfe generierte Message-Typen..."
EXPECTED_TYPES=("Version" "UDPTunnel" "Authenticate" "Ping" "UserState" "ChannelState" "TextMessage")
MISSING=0

for TYPE in "${EXPECTED_TYPES[@]}"; do
    if grep -q "MumbleProto.$TYPE = " "$OUTPUT_FILE"; then
        echo -e "  ${GREEN}✓${NC} $TYPE"
    else
        echo -e "  ${RED}✗${NC} $TYPE fehlt!"
        MISSING=1
    fi
done

echo ""

if [ $MISSING -eq 1 ]; then
    echo -e "${RED}Warnung: Einige erwartete Message-Typen fehlen!${NC}"
    echo "Prüfe die Proto-Datei auf Änderungen."
fi

echo "=============================================="
echo "  Nächste Schritte:"
echo "=============================================="
echo ""
echo "1. Alle Protobuf-Tests ausführen (77 Tests):"
echo "   npm run test:unit -- --testPathPatterns=protobuf"
echo ""
echo "2. Diese Tests prüfen:"
echo "   - Struktur-Kompatibilität (46 Tests)"
echo "   - Serialisierung/camelCase (20 Tests)"  
echo "   - Regression Protection (11 Tests)"
echo ""
echo "3. Bei Fehlern: Backup wiederherstellen:"
echo "   cp $BACKUP_FILE $OUTPUT_FILE"
echo ""

# Optional: Direkt Tests ausführen
read -p "Tests jetzt ausführen? (j/N) " -n 1 -r
echo
if [[ $REPLY =~ ^[Jj]$ ]]; then
    echo ""
    echo "Führe Protobuf-Tests aus..."
    cd "$PROJECT_ROOT"
    npm run test:unit -- --testPathPatterns=protobuf || true
fi
