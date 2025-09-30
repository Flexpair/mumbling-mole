#!/usr/bin/env bash
# Dev server startup script für devcontainer
set -euo pipefail

echo "🔧 [$(date)] Starting dev server..." | tee -a /tmp/startup-debug.log
cd /home/node

echo "🛠️ [$(date)] Ensuring development bundle is up to date..." | tee -a /tmp/startup-debug.log
if WEBPACK_MODE=development ./smart-build.sh >> /tmp/startup-debug.log 2>&1; then
    echo "✅ [$(date)] Development bundle ready." | tee -a /tmp/startup-debug.log
else
    echo "❌ [$(date)] Failed to build development bundle" | tee -a /tmp/startup-debug.log
    exit 1
fi

# Prüfe ob bereits ein Server läuft
if [ -f /tmp/entrypoint.pid ]; then
    PID=$(cat /tmp/entrypoint.pid)
    if ps -p $PID > /dev/null 2>&1; then
        echo "✅ [$(date)] Dev server already running with PID $PID" | tee -a /tmp/startup-debug.log
        
        # Prüfe ob Server bereit ist (verwende localhost im Container)
        echo "⏳ [$(date)] Checking if server is ready..." | tee -a /tmp/startup-debug.log
        for i in {1..10}; do
            if curl -s http://localhost:8081 > /dev/null 2>&1; then
                echo "🎯 [$(date)] Server is ready!" | tee -a /tmp/startup-debug.log
                break
            fi
            echo "⏳ [$(date)] Still waiting... ($i/10)" | tee -a /tmp/startup-debug.log
            sleep 1
        done
        
        # Browser öffnen mit local.flexpair.app (funktioniert auf Host)
        echo "🌐 [$(date)] Opening browser..." | tee -a /tmp/startup-debug.log
        "${BROWSER:-open}" "http://local.flexpair.app" >> /tmp/startup-debug.log 2>&1 &
        echo "✅ [$(date)] Browser opened - you should see the app now!" | tee -a /tmp/startup-debug.log
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
    
    # Warte bis der Server bereit ist (verwende localhost im Container)
    echo "⏳ [$(date)] Waiting for server to be ready..." | tee -a /tmp/startup-debug.log
    for i in {1..30}; do
        if curl -s http://localhost:8081 > /dev/null 2>&1; then
            echo "🎯 [$(date)] Server is ready!" | tee -a /tmp/startup-debug.log
            break
        fi
        echo "⏳ [$(date)] Still waiting... ($i/30)" | tee -a /tmp/startup-debug.log
        sleep 1
    done
    
    # Browser öffnen mit local.flexpair.app (funktioniert auf Host)
    echo "🌐 [$(date)] Opening browser..." | tee -a /tmp/startup-debug.log
    "${BROWSER:-open}" "http://local.flexpair.app" >> /tmp/startup-debug.log 2>&1 &
    
    echo "✅ [$(date)] Browser opened - you should see the app now!" | tee -a /tmp/startup-debug.log
else
    echo "❌ [$(date)] Dev server failed to start" | tee -a /tmp/startup-debug.log
    cat /tmp/entrypoint.log | tee -a /tmp/startup-debug.log
    exit 1
fi
