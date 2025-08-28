#!/usr/bin/env bash

# Unified install + build steps for local dev containers and production images
# - Installs dependencies (prefers npm ci when lockfile exists)
# - Updates browserslist DB (non-fatal if it fails)
# - Builds the project

set -euo pipefail

# Resolve repo root from this script location
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

echo "[setup] Working directory: $(pwd)"
echo "[setup] Node: $(node -v || echo 'node not found') | npm: $(npm -v || echo 'npm not found')"

# Install dependencies (no scripts, no audit, no fund)
if [ -f package-lock.json ] || [ -f npm-shrinkwrap.json ]; then
  echo "[setup] Installing dependencies with npm ci..."
  npm ci --ignore-scripts --no-audit --no-fund
else
  echo "[setup] Installing dependencies with npm install..."
  npm install --ignore-scripts --no-audit --no-fund
fi

# Optional: keep browserslist DB up-to-date; do not fail whole setup if it errors
echo "[setup] Updating browserslist DB (non-fatal)..."
npx update-browserslist-db@latest || true

# Build the project
echo "[setup] Building project..."
npm run build

echo "[setup] Done."
