#!/usr/bin/env bash
# Dev server startup script für devcontainer
set -euo pipefail

echo "🔧 [$(date)] Starting dev server..." | tee -a /tmp/startup-debug.log
cd /home/node

# Prüfe ob bereits ein Server läuft
if [ -f /tmp/entrypoint.pid ]; then
    PID=$(cat /tmp/entrypoint.pid)
    if ps -p $PID > /dev/null 2>&1; then
        echo "✅ [$(date)] Dev server already running with PID $PID" | tee -a /tmp/startup-debug.log
        exit 0
    fi
fi

# Starte den websockify server im Hintergrund
echo "🚀 [$(date)] Starting websockify in background..." | tee -a /tmp/startup-debug.log
nohup ./docker-entrypoint.sh > /tmp/entrypoint.log 2>&1 &
echo $! > /tmp/entrypoint.pid

echo "📝 [$(date)] Dev server started with PID $(cat /tmp/entrypoint.pid)" | tee -a /tmp/startup-debug.log
echo "📋 [$(date)] Logs: tail -f /tmp/entrypoint.log" | tee -a /tmp/startup-debug.log

# Warte kurz um sicherzustellen, dass der Prozess gestartet ist
sleep 2

# Prüfe ob der Prozess noch läuft
if ps -p $(cat /tmp/entrypoint.pid) > /dev/null 2>&1; then
    echo "✅ [$(date)] Dev server successfully started" | tee -a /tmp/startup-debug.log
else
    echo "❌ [$(date)] Dev server failed to start" | tee -a /tmp/startup-debug.log
    cat /tmp/entrypoint.log | tee -a /tmp/startup-debug.log
    exit 1
fi
