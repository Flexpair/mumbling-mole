#!/usr/bin/env bash
set -euo pipefail

PORT="${PORT:-${SMOKE_HTTP_PORT:-8081}}"
AUTH_SERVER_PORT="${AUTH_SERVER_PORT:-8082}"
# Dynamically get container IP, fallback to 0.0.0.0 if not found
CONTAINER_IP=$(hostname -I 2>/dev/null | awk '{print $1}' || echo "0.0.0.0")
HOST="${HOST:-${CONTAINER_IP:-0.0.0.0}}"
AUTH_SERVER_HOST="${AUTH_SERVER_HOST:-0.0.0.0}"
SCRIPT_DIR=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)
WEBROOT="${SCRIPT_DIR}/dist"
AUTH_SERVER_DIR="${SCRIPT_DIR}/auth-server"

# Track background process PIDs for cleanup
AUTH_SERVER_PID=""

# Signal handler for graceful shutdown
cleanup() {
  echo "[entrypoint] Shutting down..."
  if [[ -n "${AUTH_SERVER_PID}" ]] && kill -0 "${AUTH_SERVER_PID}" 2>/dev/null; then
    echo "[entrypoint] Stopping auth server (PID: ${AUTH_SERVER_PID})"
    kill "${AUTH_SERVER_PID}" 2>/dev/null || true
    wait "${AUTH_SERVER_PID}" 2>/dev/null || true
  fi
  exit 0
}

trap cleanup SIGTERM SIGINT SIGQUIT

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

# Start Auth Server in background (if available and not skipped)
if [[ -f "${AUTH_SERVER_DIR}/server.py" ]] && [[ "${SKIP_AUTH_SERVER:-}" != "1" ]]; then
  echo "[entrypoint] Starting auth server on ${AUTH_SERVER_HOST}:${AUTH_SERVER_PORT}"
  
  nohup env \
    AUTH_SERVER_HOST="${AUTH_SERVER_HOST}" \
    AUTH_SERVER_PORT="${AUTH_SERVER_PORT}" \
    MUMBLE_PASSWORD="${MUMBLE_PASSWORD:-}" \
    GUAC_ADMIN_PASSWORD="${GUAC_ADMIN_PASSWORD:-}" \
    GUAC_EDITOR_PASSWORD="${GUAC_EDITOR_PASSWORD:-}" \
    GUAC_WATCHER_PASSWORD="${GUAC_WATCHER_PASSWORD:-}" \
    AUTH_PROVIDER="${AUTH_PROVIDER:-netlify}" \
    NETLIFY_IDENTITY_URL="${NETLIFY_IDENTITY_URL:-https://welcome.flexpair.com/identity-proxy}" \
    SUPABASE_URL="${SUPABASE_URL:-}" \
    AUTH0_DOMAIN="${AUTH0_DOMAIN:-}" \
    AUTH_ALLOWED_ORIGINS="${AUTH_ALLOWED_ORIGINS:-}" \
    python3 "${AUTH_SERVER_DIR}/server.py" > /tmp/auth-server.log 2>&1 &
  
  AUTH_SERVER_PID=$!
  disown "${AUTH_SERVER_PID}" 2>/dev/null || true
  sleep 1
  
  if kill -0 "${AUTH_SERVER_PID}" 2>/dev/null; then
    echo "[entrypoint] Auth server started (PID: ${AUTH_SERVER_PID})"
  else
    echo "[entrypoint] WARNING: Auth server failed to start, check /tmp/auth-server.log"
    cat /tmp/auth-server.log 2>/dev/null || true
  fi
fi

echo "[entrypoint] Start websockify ${SSL_TARGET_FLAG:+(ssl-target)} on ${HOST}:${PORT} → ${MUMBLE_SERVER} (web=${WEBROOT})"
# Using array to safely handle optional SSL flag
SSL_ARGS=()
if [[ -n "${SSL_TARGET_FLAG}" ]]; then
  SSL_ARGS=("${SSL_TARGET_FLAG}")
fi
exec websockify "${SSL_ARGS[@]}" --web="${WEBROOT}" "${HOST}:${PORT}" "${MUMBLE_SERVER}"
