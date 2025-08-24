#!/usr/bin/env bash
set -euo pipefail

# Erwartete ENV-Variablen prüfen
: "${WS_SOURCE_PORT:?Must set WS_SOURCE_PORT}"
: "${WS_TARGET_ADDR:?Must set WS_TARGET_ADDR}"
: "${WS_TARGET_PORT:?Must set WS_TARGET_PORT}"

# Optional: Dev-Testmodus
if [ "${DEV_TEST:-}" = "true" ]; then
  echo "[DEV_TEST] Would run: websockify ${WS_SOURCE_PORT} ${WS_TARGET_ADDR}:${WS_TARGET_PORT}"
  exit 0
fi

exec websockify "${WS_SOURCE_PORT}" "${WS_TARGET_ADDR}:${WS_TARGET_PORT}"
