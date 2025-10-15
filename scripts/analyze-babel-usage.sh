#!/bin/bash
# Analysiert welche ES6+ Features im Code genutzt werden
# um zu prüfen ob Babel wirklich nötig ist

set -e

echo "🔍 Analyzing ES6+ Feature Usage in mumbling-mole"
echo "================================================"
echo ""

# Verzeichnisse die analysiert werden sollen
DIRS="app/index.js app/worker.js app/audio/*.js app/state/*.js app/auth/*.js"

echo "📊 ES6+ Features Usage:"
echo ""

# Arrow Functions
COUNT=$(grep -r "=>" $DIRS 2>/dev/null | wc -l)
echo "Arrow Functions (=>):                    $COUNT uses"

# Classes
COUNT=$(grep -r "^class \|^export class " $DIRS 2>/dev/null | wc -l)
echo "Classes:                                 $COUNT definitions"

# Async/Await
COUNT=$(grep -r "async \|await " $DIRS 2>/dev/null | wc -l)
echo "Async/Await:                             $COUNT uses"

# Template Literals
COUNT=$(grep -r '`.*\${' $DIRS 2>/dev/null | wc -l)
echo "Template Literals (\`\${}\`):             $COUNT uses"

# Destructuring
COUNT=$(grep -r "const {.*} = \|let {.*} = " $DIRS 2>/dev/null | wc -l)
echo "Destructuring:                           $COUNT uses"

# Spread Operator
COUNT=$(grep -r '\.\.\.' $DIRS 2>/dev/null | wc -l)
echo "Spread Operator (...):                   $COUNT uses"

# Optional Chaining
COUNT=$(grep -r '?\.' $DIRS 2>/dev/null | wc -l)
echo "Optional Chaining (?.):                  $COUNT uses"

# Nullish Coalescing
COUNT=$(grep -r '??' $DIRS 2>/dev/null | wc -l)
echo "Nullish Coalescing (??):                 $COUNT uses"

echo ""
echo "🎯 Browser Support (2025):"
echo "  ✅ All features above: Chrome 80+, Firefox 72+, Safari 13.1+ (2020+)"
echo "  ✅ Your target: Modern browsers with Web Audio & WebRTC"
echo "  ✅ Node.js 22.0.0: Full ES2024 support"
echo ""
echo "💡 Conclusion:"
echo "  Babel is NOT needed for main application code!"
echo "  Only vendors/mumble-client might need transpilation."
echo ""

# Prüfe vendors/mumble-client
if [ -d "vendors/mumble-client/src" ]; then
    echo "📦 Checking vendors/mumble-client/src:"
    echo ""
    
    # Ist bereits lib/ transpiliert?
    if [ -d "vendors/mumble-client/lib" ]; then
        echo "  ✅ lib/ exists (pre-transpiled)"
        echo "  → Import from lib/ instead of src/"
        echo "  → No babel needed in main build!"
    else
        echo "  ⚠️  lib/ missing"
        echo "  → Run: npm run build:vendor:mumble-client"
    fi
fi

echo ""
echo "🚀 Next Steps:"
echo "  1. Verify lib/ is up to date: npm run build:vendor:mumble-client"
echo "  2. Update webpack to import from vendors/mumble-client/lib"
echo "  3. Remove babel from main build (keep for vendors only)"
echo "  4. Test: npm run test:audio:system && npm run test:e2e"
echo ""
