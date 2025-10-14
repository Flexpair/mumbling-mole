#!/bin/bash
# Test script for new AppState architecture
# This script runs the dev server with the new state architecture enabled

set -e

echo "🧪 Testing new AppState architecture..."
echo ""
echo "This will start the dev server with USE_NEW_STATE_ARCHITECTURE=true"
echo "The new modular state architecture will be used instead of GlobalBindings"
echo ""

# Set environment variable for new architecture
export USE_NEW_STATE_ARCHITECTURE=true
export WEBPACK_MODE=development

# Start dev server
./start-dev-server.sh "$@"
