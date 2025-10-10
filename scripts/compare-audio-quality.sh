#!/usr/bin/env bash
# Quick comparison test between lite (ScriptProcessorNode) and feature branch (AudioWorklet)

set -euo pipefail

echo "=== Audio Quality Comparison Test ==="
echo ""
echo "This test will:"
echo "1. Run audio roundtrip test on current branch (AudioWorklet)"
echo "2. Show sample statistics"
echo ""

if [[ ! -f dist/index.html ]]; then
    echo "Building current branch first..."
    npm run build
fi

echo ""
echo "Starting audio test with 440Hz tone for 5 seconds..."
echo ""

MUMBLE_SERVER="${MUMBLE_SERVER:-localhost:64738}" \
TEST_DURATION=5 \
GENERATE_TONE=true \
TONE_FREQUENCY=440 \
node scripts/audio-test.cjs

echo ""
echo "=== Test Complete ==="
echo ""
echo "To compare with lite branch:"
echo "  1. git stash"
echo "  2. git checkout lite"
echo "  3. npm run build"
echo "  4. ./scripts/compare-audio-quality.sh"
echo "  5. git checkout feature/replace-scriptprocessornode-with-audioworklet"
echo "  6. git stash pop"
