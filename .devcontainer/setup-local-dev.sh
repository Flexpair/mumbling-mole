#!/usr/bin/env bash
set -euo pipefail

# Prepare local development TLS material before the Compose services start.
# The generated key and certificate stay ignored under .devcontainer/letsencrypt/.

SCRIPT_DIR=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)
CERT_DIR="${SCRIPT_DIR}/letsencrypt"
CERT_FILE="${CERT_DIR}/local.flexpair.app.pem"
KEY_FILE="${CERT_DIR}/local.flexpair.app-key.pem"

if [[ ! -d "${CERT_DIR}" || ! -w "${CERT_DIR}" ]]; then
    echo "TLS directory must exist and be writable before setup: ${CERT_DIR}" >&2
    exit 1
fi

command -v openssl >/dev/null 2>&1 || {
    echo "openssl is required to generate local TLS material" >&2
    exit 1
}

if [[ -f "${CERT_FILE}" && -f "${KEY_FILE}" ]]; then
    if openssl x509 -checkend 86400 -noout -in "${CERT_FILE}" >/dev/null 2>&1; then
        exit 0
    fi
    echo "Local TLS certificate is expired or expires within 24 hours; renewing it."
    rm -f "${CERT_FILE}" "${KEY_FILE}"
elif [[ -e "${CERT_FILE}" || -e "${KEY_FILE}" ]]; then
    echo "TLS certificate and key must either both exist or both be absent: ${CERT_DIR}" >&2
    exit 1
fi

umask 077

TEMP_DIR=$(mktemp -d "${CERT_DIR}/.tls.XXXXXX")
cleanup() {
    rm -rf "${TEMP_DIR}"
}
trap cleanup EXIT

printf '%s\n' \
    '[req]' \
    'distinguished_name = req_distinguished_name' \
    'x509_extensions = v3_req' \
    'prompt = no' \
    '' \
    '[req_distinguished_name]' \
    'CN = local.flexpair.app' \
    '' \
    '[v3_req]' \
    'basicConstraints = critical,CA:FALSE' \
    'keyUsage = critical,digitalSignature,keyEncipherment' \
    'extendedKeyUsage = serverAuth' \
    'subjectAltName = DNS:local.flexpair.app' \
    > "${TEMP_DIR}/openssl.cnf"

openssl req \
    -x509 \
    -newkey rsa:2048 \
    -nodes \
    -sha256 \
    -days 30 \
    -keyout "${TEMP_DIR}/local.flexpair.app-key.pem" \
    -out "${TEMP_DIR}/local.flexpair.app.pem" \
    -config "${TEMP_DIR}/openssl.cnf"

openssl x509 \
    -in "${TEMP_DIR}/local.flexpair.app.pem" \
    -noout \
    -checkend 86400 >/dev/null

mv "${TEMP_DIR}/local.flexpair.app-key.pem" "${KEY_FILE}"
mv "${TEMP_DIR}/local.flexpair.app.pem" "${CERT_FILE}"
chmod 600 "${KEY_FILE}"
chmod 644 "${CERT_FILE}"
