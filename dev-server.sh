#!/usr/bin/env bash
# Simplified dev server management script
set -euo pipefail

COMMAND="${1:-start}"
PID_FILE="/tmp/entrypoint.pid"
LOG_FILE="/tmp/entrypoint.log"

case "$COMMAND" in
  "start")
    echo "🔧 Starting dev server..."
    
    # Check if already running
    if [ -f "$PID_FILE" ]; then
        PID=$(cat "$PID_FILE")
        if ps -p "$PID" > /dev/null 2>&1; then
            echo "✅ Dev server already running with PID $PID"
            exit 0
        fi
    fi
    
    # Start the websockify server in background
    echo "🚀 Starting websockify..."
    nohup ./docker-entrypoint.sh > "$LOG_FILE" 2>&1 &
    echo $! > "$PID_FILE"
    
    # Wait and verify startup
    sleep 2
    if ps -p $(cat "$PID_FILE") > /dev/null 2>&1; then
        echo "✅ Dev server started with PID $(cat $PID_FILE)"
        echo "📋 Logs: tail -f $LOG_FILE"
    else
        echo "❌ Dev server failed to start"
        cat "$LOG_FILE"
        exit 1
    fi
    ;;
    
  "stop")
    echo "🛑 Stopping dev server..."
    
    if [ -f "$PID_FILE" ]; then
        PID=$(cat "$PID_FILE")
        if ps -p "$PID" > /dev/null 2>&1; then
            echo "Killing process $PID..."
            kill "$PID" || true
            sleep 2
            if ps -p "$PID" > /dev/null 2>&1; then
                echo "Force killing process $PID..."
                kill -9 "$PID" || true
            fi
            echo "✅ Dev server stopped."
        else
            echo "Process $PID not running."
        fi
        rm -f "$PID_FILE"
    else
        echo "No PID file found. Trying to kill by process name..."
        pkill -f websockify || echo "No websockify processes found."
    fi
    
    rm -f "$LOG_FILE"
    ;;
    
  "restart")
    $0 stop
    sleep 1
    $0 start
    ;;
    
  "status")
    if [ -f "$PID_FILE" ]; then
        PID=$(cat "$PID_FILE")
        if ps -p "$PID" > /dev/null 2>&1; then
            echo "✅ Dev server running with PID $PID"
        else
            echo "❌ Dev server not running (stale PID file)"
        fi
    else
        echo "❌ Dev server not running"
    fi
    ;;
    
  *)
    echo "Usage: $0 {start|stop|restart|status}"
    echo "  start   - Start the dev server"
    echo "  stop    - Stop the dev server"
    echo "  restart - Restart the dev server"
    echo "  status  - Check server status"
    exit 1
    ;;
esac