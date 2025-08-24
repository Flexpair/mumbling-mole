#!/usr/bin/env bash
set -euo pipefail
: "${WS_SOURCE_PORT:?Must set WS_SOURCE_PORT}"
: "${WS_TARGET_ADDR:?Must set WS_TARGET_ADDR}"
: "${WS_TARGET_PORT:?Must set WS_TARGET_PORT}"
echo "+ websockify ${WS_SOURCE_PORT} ${WS_TARGET_ADDR}:${WS_TARGET_PORT}"
exec websockify "${WS_SOURCE_PORT}" "${WS_TARGET_ADDR}:${WS_TARGET_PORT}"
