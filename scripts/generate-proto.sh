#!/bin/bash
# generate-proto.sh - Generiert mumble-proto-minimal.js aus Mumble.proto
# Wird automatisch im Build-Prozess (prebuild) ausgeführt.
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
PROTO_FILE="$PROJECT_ROOT/app/mumble-streams/Mumble.proto"
OUTPUT_FILE="$PROJECT_ROOT/app/mumble-streams/mumble-proto-minimal.js"
PBJS="$PROJECT_ROOT/node_modules/.bin/pbjs"

echo "📦 Proto Generator: Mumble.proto → mumble-proto-minimal.js"

# Proto-Datei prüfen
if [ ! -f "$PROTO_FILE" ]; then
    echo "❌ Fehler: $PROTO_FILE nicht gefunden"
    echo "   Hole mit: npm run update:proto"
    exit 1
fi

# Generiere ES6 Modul
TEMP_FILE=$(mktemp)
"$PBJS" --target static-module --wrap es6 --es6 --no-comments "$PROTO_FILE" > "$TEMP_FILE"

# Überflüssige Methoden entfernen (verify, fromObject, toObject, toJSON, *Delimited)
# Und Import-Syntax anpassen (ersetzt sed für Cross-Platform Kompatibilität)
node -e "
const fs = require('fs');
let code = fs.readFileSync('$TEMP_FILE', 'utf8');

// Import-Syntax anpassen
code = code.replace(/from \"protobufjs\/minimal\"/g, 'from \"protobufjs/minimal.js\"');
code = code.replace(/import \* as \\\$protobuf/g, 'import \$protobuf');

const methods = ['verify', 'fromObject', 'toObject', 'encodeDelimited', 'decodeDelimited'];
for (const m of methods) {
    code = code.replace(new RegExp('\\\\n\\\\s*\\\\w+\\\\.' + m + ' = function ' + m + '\\\\([^)]*\\\\) \\\\{[\\\\s\\\\S]*?\\\\n\\\\s*\\\\};', 'g'), '');
}
code = code.replace(/\\n\\s*\\w+\\.prototype\\.toJSON = function toJSON\\(\\) \\{\\n[^}]+\\};/g, '');
code = code.replace(/\\.decode = function decode\\(reader, length, error\\)/g, '.decode = function decode(reader, length)');
code = code.replace(/\\n\\s*if \\(tag === error\\)\\n\\s*break;\\n/g, '\\n');
code = code.replace(/\\n\\s*\\w+\\.getTypeUrl = function getTypeUrl\\(typeUrlPrefix\\) \\{[\\s\\S]*?\\n\\s*\\};\\n/g, '\\n');
code = code.replace(/\n{3,}/g, '\n\n');
fs.writeFileSync('$TEMP_FILE', code);
"

mv "$TEMP_FILE" "$OUTPUT_FILE"

# Validierung
TYPES=("Version" "UDPTunnel" "Authenticate" "Ping" "UserState" "ChannelState" "TextMessage")
for T in "${TYPES[@]}"; do
    grep -q "MumbleProto.$T = " "$OUTPUT_FILE" || { echo "❌ $T fehlt!"; exit 1; }
done

SIZE=$(du -h "$OUTPUT_FILE" | cut -f1)
echo "✅ Proto generiert ($SIZE)"
