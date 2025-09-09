#!/usr/bin/env bash
# Dev server stop script für devcontainer
set -euo pipefail

echo "Stopping dev server..."

if [ -f /tmp/entrypoint.pid ]; then
    PID=$(cat /tmp/entrypoint.pid)
    if ps -p $PID > /dev/null 2>&1; then
        echo "Killing process $PID..."
        kill $PID
        sleep 2
        if ps -p $PID > /dev/null 2>&1; then
            echo "Force killing process $PID..."
            kill -9 $PID
        fi
        echo "Dev server stopped."
    else
        echo "Process $PID not running."
    fi
    rm -f /tmp/entrypoint.pid
else
    echo "No PID file found. Trying to kill by process name..."
    pkill -f websockify || echo "No websockify processes found."
fi

rm -f /tmp/entrypoint.log
