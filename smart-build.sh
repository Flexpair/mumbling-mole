#!/bin/bash

# Smart Build - baut nur wenn nötig

echo "🔍 Checking if build is needed..."

# Prüfe ob dist existiert
if [ ! -f "dist/index.js" ]; then
    echo "📦 No build found. Running npm run build..."
    npm run build
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
    npm run build
    # Marker-Datei erstellen um endless rebuild zu vermeiden
    touch dist/.build-marker
    exit $?
fi

echo "✅ Build is up to date. Skipping..."
