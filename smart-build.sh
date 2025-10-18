#!/usr/bin/env bash
set -euo pipefail

log() { printf '%s %s\n' "[smart-build]" "$*"; }
fail() { printf '%s %s\n' "[smart-build][FAIL]" "$*" >&2; exit 1; }

# Since esbuild is so fast (~1s), always do a clean build
MODE="${BUILD_MODE:-production}"

validate_artifacts() {
    local missing=()
    for f in dist/index.html dist/index.js dist/config.js dist/theme.js; do
        [[ -s $f ]] || missing+=("$f")
    done
    if (( ${#missing[@]} )); then
        ls -l dist || true
        fail "Missing or empty build artifacts: ${missing[*]}"
    fi
    local sz
    sz=$(wc -c < dist/index.html || echo 0)
    if (( sz < 1024 )); then
        head -c 200 dist/index.html | sed 's/^/[snippet] /'
        fail "index.html too small (${sz} bytes)"
    fi
    log "Artifacts OK (index.html ${sz} bytes)"
}

# Always clean and rebuild (esbuild is fast enough)
log "Cleaning dist/"
rm -rf dist

log "Running esbuild (mode=${MODE})"
mkdir -p dist
BUILD_MODE="${MODE}" node build-esbuild.mjs
# config.local.js and AudioWorklet processors are already handled by build-esbuild.mjs
validate_artifacts
log "Build complete"
