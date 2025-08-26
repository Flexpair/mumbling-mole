#!/bin/bash
set -euo pipefail

PORT=8081
WEBROOT="/home/node/dist"

# 1. HTML-Smoke-Case: Nur Webserver, kein Tunnel
if [[ "${SKIP_TUNNEL:-}" = "1" ]]; then
  echo "[entrypoint] SKIP_TUNNEL=1 → nur statische Files auf :${PORT} aus ${WEBROOT}"
  # Python-HTTP-Server als schlanker Ersatz für Websockify
  exec python3 -m http.server --directory "${WEBROOT}" "${PORT}"
fi

# 2. Normalfall: Websockify starten
SSL_TARGET_FLAG="--ssl-target"
if [[ "${PLAIN_TARGET:-}" = "1" ]]; then
  SSL_TARGET_FLAG=""
  echo "[entrypoint] Starte websockify (Plain TCP) auf :${PORT} → ${MUMBLE_SERVER} (mit --web=${WEBROOT})"
else
  echo "[entrypoint] Starte websockify (TLS zum Ziel) auf :${PORT} → ${MUMBLE_SERVER} (mit --web=${WEBROOT})"
fi

exec websockify ${SSL_TARGET_FLAG} --web="${WEBROOT}" "${PORT}" "${MUMBLE_SERVER}"
