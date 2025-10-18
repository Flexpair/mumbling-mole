#!/usr/bin/env bash
# Quick rebuild and restart dev server
set -e

echo "🔨 Building..."
./smart-build.sh --force

echo "🛑 Stopping dev server..."
./stop-dev-server.sh 2>/dev/null || true

echo "🚀 Starting dev server..."
./start-dev-server.sh

echo "✅ Done! Server restarted."
