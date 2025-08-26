#!/bin/bash
set -euo pipefail

PORT=8081
WEBROOT="/home/node/dist"

# Default: SSL erzwingen
SSL_TARGET_FLAG="--ssl-target"
if [[ "${PLAIN_TARGET:-}" = "1" ]]; then
  SSL_TARGET_FLAG=""
  echo "[entrypoint] Starte websockify (Plain TCP) auf :${PORT} → ${MUMBLE_SERVER} (mit --web=${WEBROOT})"
else
  echo "[entrypoint] Starte websockify (TLS zum Ziel) auf :${PORT} → ${MUMBLE_SERVER} (mit --web=${WEBROOT})"
fi

exec websockify ${SSL_TARGET_FLAG} --web="${WEBROOT}" "${PORT}" "${MUMBLE_SERVER}"
