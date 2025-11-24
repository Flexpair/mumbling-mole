#!/usr/bin/env bash
set -euo pipefail

echo "🔧 Starting dev server..."
cd /home/node

echo "🛠️ Building development bundle..."
if BUILD_MODE=development node build-esbuild.mjs 2>&1 | tail -10; then
    echo "✅ Development bundle ready."
else
    echo "❌ Failed to build development bundle"
    exit 1
fi

if [[ -f /tmp/entrypoint.pid ]]; then
    PID=$(cat /tmp/entrypoint.pid)
    if ps -p $PID > /dev/null 2>&1; then
        echo "✅ Dev server already running with PID $PID"
        
        echo "⏳ Checking if server is ready..."
        for i in {1..10}; do
            if curl -s http://localhost:8081 > /dev/null 2>&1; then
                echo "🎯 Server is ready!"
                break
            fi
            sleep 1
        done
        
        echo "🌐 Opening browser..."
        "${BROWSER:-open}" "http://local.flexpair.app" > /dev/null 2>&1 &
        exit 0
    fi
fi

echo "🚀 Starting websockify..."
nohup ./docker-entrypoint.sh > /tmp/entrypoint.log 2>&1 &
echo $! > /tmp/entrypoint.pid

echo "📝 Dev server PID: $(cat /tmp/entrypoint.pid)"
echo "📋 Logs: tail -f /tmp/entrypoint.log"

sleep 2

if ps -p $(cat /tmp/entrypoint.pid) > /dev/null 2>&1; then
    echo "✅ Dev server started"
    
    echo "⏳ Waiting for server..."
    for i in {1..30}; do
        if curl -s http://localhost:8081 > /dev/null 2>&1; then
            echo "🎯 Server ready!"
            break
        fi
        sleep 1
    done
    
    echo "🌐 Opening browser..."
    "${BROWSER:-open}" "http://local.flexpair.app" > /dev/null 2>&1 &
else
    echo "❌ Dev server failed to start"
    tail -20 /tmp/entrypoint.log
    exit 1
fi
