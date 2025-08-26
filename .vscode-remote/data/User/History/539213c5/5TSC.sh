#!/usr/bin/env bash
set -euo pipefail

PORT="${PORT:-${SMOKE_HTTP_PORT:-8081}}"
HOST="${HOST:-0.0.0.0}"
WEBROOT="/home/node/dist"

# Sonderfall: alter HTTP-Smoke-Test → nur statische Dateien auf :8081 ausliefern
if [[ "${SKIP_TUNNEL:-}" = "1" ]]; then
  echo "[entrypoint] SKIP_TUNNEL=1 → serve static files on ${HOST}:${PORT} from ${WEBROOT}"
  exec python3 -m http.server "${PORT}" --bind "${HOST}" --directory "${WEBROOT}"
fi

# Normalfall: WebSocket-Tunnel + Static Web via websockify
: "${MUMBLE_SERVER:?Must set MUMBLE_SERVER (e.g. host:port)}"

# Für E2E-Tests ggf. TLS am Ziel deaktivieren (Echo-Server ist Plain-TCP)
SSL_TARGET_FLAG="--ssl-target"
if [[ "${PLAIN_TARGET:-}" = "1" ]]; then
  SSL_TARGET_FLAG=""
fi

echo "[entrypoint] Start websockify ${SSL_TARGET_FLAG:+(ssl-target)} on ${HOST}:${PORT} → ${MUMBLE_SERVER} (web=${WEBROOT})"
exec websockify ${SSL_TARGET_FLAG} --web="${WEBROOT}" "${HOST}:${PORT}" "${MUMBLE_SERVER}"
