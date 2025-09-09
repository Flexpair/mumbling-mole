#!/bin/bash

# Smart Build - baut nur wenn nötig

# Check für --force Parameter
FORCE_BUILD=false
if [ "$1" = "--force" ]; then
    FORCE_BUILD=true
    echo "🔥 Force build requested - rebuilding everything..."
fi

echo "🔍 Checking if build is needed..."

# Bei Force Build: dist löschen und neu bauen
if [ "$FORCE_BUILD" = true ]; then
    echo "🗑️ Removing dist directory..."
    rm -rf dist
    mkdir -p dist
    echo "🚀 Starting force build... (this takes ~90 seconds)"
    npm install node-polyfill-webpack-plugin && npx webpack --progress && ([ -f dist/config.local.js ] || cp app/config.local.js dist/) && cp app/recorder-worker.js dist/
    # Marker-Datei erstellen
    touch dist/.build-marker
    exit $?
fi

# Prüfe ob dist existiert
if [ ! -f "dist/index.js" ]; then
    echo "📦 No build found. Running build..."
    npm install node-polyfill-webpack-plugin && npx webpack --progress && ([ -f dist/config.local.js ] || cp app/config.local.js dist/) && cp app/recorder-worker.js dist/
    # Marker-Datei erstellen
    touch dist/.build-marker
    exit $?
fi

# Prüfe ob wichtige Source-Dateien neuer sind als der Build
SOURCE_CHANGED=false

echo "📅 Checking timestamps..."

# Check ob überhaupt ein Build existiert
if [ ! -f "dist/.build-marker" ]; then
    echo "📦 No build marker found. Initial build needed..."
    SOURCE_CHANGED=true
else
    # Nur Source-Dateien checken (nicht Config-Dateien)
    SOURCE_FILES="app/*.js app/*.html"
    for file in $SOURCE_FILES; do
        if [ -f "$file" ] && [ "$file" -nt "dist/.build-marker" ]; then
            echo "🔄 Source file $file changed. Rebuilding..."
            SOURCE_CHANGED=true
            break
        fi
    done
fi

if [ "$SOURCE_CHANGED" = true ]; then
    echo "🚀 Starting build... (this takes ~90 seconds)"
    npm install node-polyfill-webpack-plugin && npx webpack --progress && ([ -f dist/config.local.js ] || cp app/config.local.js dist/) && cp app/recorder-worker.js dist/
    # Marker-Datei erstellen um endless rebuild zu vermeiden
    touch dist/.build-marker
    exit $?
fi

echo "✅ Build is up to date. Skipping..."
