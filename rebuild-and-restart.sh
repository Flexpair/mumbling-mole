#!/usr/bin/env bash
# Quick rebuild and restart dev server
set -e

echo "🔨 Building..."
node build-esbuild.mjs

echo "🛑 Stopping dev server..."
./stop-dev-server.sh 2>/dev/null || true

echo "🚀 Starting dev server..."
./start-dev-server.sh

# Make port 8081 public in GitHub Codespaces (for Playwright tests)
if [ -n "$CODESPACE_NAME" ]; then
  echo "🌐 Making port 8081 public in Codespaces..."
  gh codespace ports visibility 8081:public -c "$CODESPACE_NAME" 2>/dev/null || true
fi

echo "✅ Done! Server restarted."
