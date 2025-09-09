#!/bin/bash

# Setup-Skript für lokales Dev-Environment und GitHub Codespaces
# ==============================================================
# 
# Automatische Erkennung der Umgebung:
# - Lokal: https://local.flexpair.app mit SSL-Zertifikaten
# - Codespaces: https://${CODESPACE_NAME}-8081.${GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN}
#
# Zweck: CORS-Probleme beim lokalen Development vermeiden

# Umgebung erkennen
if [ -n "$CODESPACE_NAME" ]; then
    ENVIRONMENT="codespaces"
    DOMAIN="${CODESPACE_NAME}-8081.${GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN}"
    echo "🚀 Setup für GitHub Codespaces mit https://${DOMAIN}"
else
    ENVIRONMENT="local"
    DOMAIN="local.flexpair.app"
    echo "🚀 Setup für lokales Dev-Environment mit https://${DOMAIN}"
fi

echo "=================================================================="
echo ""
echo "ℹ️  Erkannte Umgebung: ${ENVIRONMENT}"
echo "   Domain: ${DOMAIN}"
echo ""

# 1. Hosts-Datei konfigurieren (nur lokal nötig)
echo ""
echo "1️⃣ Hosts-Datei konfigurieren..."

if [ "$ENVIRONMENT" = "local" ]; then
    if ! grep -q "local.flexpair.app" /etc/hosts 2>/dev/null; then
        echo "⚠️  local.flexpair.app ist noch nicht in /etc/hosts eingetragen."
        echo "   Bitte führe auf deinem HOST-System (nicht im Container) folgendes aus:"
        echo ""
        echo "   echo '127.0.0.1   local.flexpair.app' | sudo tee -a /etc/hosts"
        echo ""
        echo "   Oder editiere /etc/hosts manuell und füge diese Zeile hinzu:"
        echo "   127.0.0.1   local.flexpair.app"
        echo ""
    else
        echo "✅ local.flexpair.app ist bereits in /etc/hosts konfiguriert"
    fi
else
    echo "✅ Codespaces: Keine Hosts-Datei-Änderung nötig"
    echo "   Domain wird automatisch von GitHub bereitgestellt: ${DOMAIN}"
fi

# 2. SSL-Zertifikate (nur lokal nötig)
echo ""
echo "2️⃣ SSL-Zertifikate konfigurieren..."

if [ "$ENVIRONMENT" = "local" ]; then
    # mkcert Installation prüfen
    if ! command -v mkcert &> /dev/null; then
        echo "⚠️  mkcert ist nicht installiert. Bitte installiere es:"
        echo ""
        echo "   # macOS (mit Homebrew):"
        echo "   brew install mkcert"
        echo ""
        echo "   # Ubuntu/Debian:"
        echo "   sudo apt install libnss3-tools"
        echo "   curl -JLO \"https://dl.filippo.io/mkcert/latest?for=linux/amd64\""
        echo "   chmod +x mkcert-v*-linux-amd64"
        echo "   sudo cp mkcert-v*-linux-amd64 /usr/local/bin/mkcert"
        echo ""
    else
        echo "✅ mkcert ist installiert"
    fi

    # Zertifikate generieren
    CERT_DIR="$(pwd)/.devcontainer/letsencrypt"
    mkdir -p "$CERT_DIR"

    if [ ! -f "$CERT_DIR/local.flexpair.app.pem" ]; then
        echo "⚠️  SSL-Zertifikate noch nicht vorhanden."
        echo "   Bitte führe aus:"
        echo ""
        echo "   # mkcert CA installieren"
        echo "   mkcert -install"
        echo ""
        echo "   # Zertifikate für local.flexpair.app generieren"
        echo "   cd .devcontainer/letsencrypt"
        echo "   mkcert local.flexpair.app"
        echo ""
    else
        echo "✅ SSL-Zertifikate sind bereits vorhanden"
    fi
else
    echo "✅ Codespaces: Keine lokalen SSL-Zertifikate nötig"
    echo "   GitHub Codespaces stellt automatisch HTTPS bereit"
fi

# 3. Docker Compose konfigurieren
echo ""
echo "3️⃣ Docker Compose konfigurieren..."

# Environment-Datei erstellen
cat > .devcontainer/.env << EOF
# Auto-generated environment configuration
ENVIRONMENT=${ENVIRONMENT}
SSL_DOMAIN=${DOMAIN}
EOF

echo "✅ Environment-Datei erstellt (.devcontainer/.env)"
echo "   ENVIRONMENT=${ENVIRONMENT}"
echo "   SSL_DOMAIN=${DOMAIN}"

# 4. Container starten
echo ""
echo "4️⃣ Container starten..."

echo "   Container werden gestartet mit:"
echo ""
echo "   docker compose -f .devcontainer/docker-compose.yml down"
echo "   docker compose -f .devcontainer/docker-compose.yml up -d"
echo ""

# 5. Nutzungsanweisungen
echo ""
echo "5️⃣ Nutzung"
echo "=========="
echo ""
if [ "$ENVIRONMENT" = "local" ]; then
    echo "Lokal: Öffne https://local.flexpair.app im Browser"
    echo "(Nach Zertifikat-Setup und Container-Start)"
else
    echo "Codespaces: Port 8081 wird automatisch weitergeleitet"
    echo "GitHub zeigt dir die URL in der Ports-Registerkarte an"
    echo "Normalerweise: https://${DOMAIN}"
fi
echo ""
echo "✅ Setup-Anweisungen vollständig!"
