#!/usr/bin/env bash
set -euo pipefail

log() { printf '%s %s\n' "[smart-build]" "$*"; }
fail() { printf '%s %s\n' "[smart-build][FAIL]" "$*" >&2; exit 1; }

FORCE_BUILD=false
if [[ ${1:-} == "--force" ]]; then
    FORCE_BUILD=true
    log "Force build requested"
fi

MODE="${WEBPACK_MODE:-production}"

ensure_vendor() {
    # Build vendors/mumble-client if lib missing (sustainable approach)
    if [[ ! -s vendors/mumble-client/lib/client.js ]]; then
        log "Vendor mumble-client lib missing → building (babel)"
        pushd vendors/mumble-client >/dev/null
            npm install --no-audit --no-fund
            npx babel src --out-dir lib
        popd >/dev/null
    fi
}

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

do_build() {
    ensure_vendor
    # Polyfill plugin is already a devDependency (installed via npm ci); avoid dynamic installs for determinism
    log "Running webpack (mode=${MODE})"
    mkdir -p dist
    WEBPACK_MODE="${MODE}" npx webpack --progress --mode "${MODE}"
    [[ -f dist/config.local.js ]] || cp app/config.local.js dist/
    cp app/recorder-worker.js dist/
    touch dist/.build-marker
    printf '%s' "${MODE}" > dist/.build-mode
    validate_artifacts
}

log "Build decision phase"
if $FORCE_BUILD; then
    log "Force rebuild: cleaning dist"
    rm -rf dist
    mkdir -p dist
    do_build
    exit 0
fi

if [[ ! -f dist/index.js ]]; then
    log "No existing build → building"
    do_build
    exit 0
fi

if [[ ! -f dist/.build-marker ]]; then
    log "No build marker → rebuilding"
    do_build
    exit 0
fi

if [[ ! -f dist/.build-mode ]]; then
    log "No build mode file → rebuilding"
    do_build
    exit 0
fi

CURRENT_MODE=$(<dist/.build-mode)
if [[ "${CURRENT_MODE}" != "${MODE}" ]]; then
    log "Build mode mismatch (found ${CURRENT_MODE} vs ${MODE}) → rebuilding"
    do_build
    exit 0
fi

log "Checking source timestamps"
NEED=false
for f in app/*.js app/*.html; do
    if [[ -f $f && $f -nt dist/.build-marker ]]; then
        log "Change detected: $f"
        NEED=true
        break
    fi
done

if $NEED; then
    log "Sources changed → rebuilding"
    do_build
    exit 0
fi

log "Existing build fresh; validating artifacts"
validate_artifacts
log "Up to date (no rebuild)"
