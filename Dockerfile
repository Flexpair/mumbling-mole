# =====================================================================
# Stage 1: base
# - Ubuntu 24.04 als Basis (statt Alpine)
# - Node.js 16 manuell installiert, da nicht mehr in Ubuntu-Paketen
# - Python 3.11 statt 3.12, weil websockify==0.12.0 altes ssl.wrap_socket nutzt
#   (das ab Python 3.12 entfernt wurde).
# =====================================================================
FROM ubuntu:24.04 AS base

ENV DEBIAN_FRONTEND=noninteractive

# ---------------------------------------------------------------------
# Deadsnakes PPA einbinden, um Python 3.11 auch unter Ubuntu 24.04 zu bekommen
# ---------------------------------------------------------------------
RUN apt-get update && apt-get install -y --no-install-recommends \
  software-properties-common \
  && add-apt-repository ppa:deadsnakes/ppa \
  && apt-get update

# Grundpakete installieren:
# - ca-certificates, curl, git, tini, bash → für Basisfunktionalität
# - python3.11 + python3.11-venv → gezielt Python 3.11, NICHT systemweit 3.12
# - xz-utils → nötig für Node.js tarball
RUN apt-get install -y --no-install-recommends \
  ca-certificates \
  curl \
  git \
  tini \
  bash \
  python3.11 \
  python3.11-venv \
  xz-utils \
  && rm -rf /var/lib/apt/lists/*

# ---------------------------------------------------------------------
# Virtuelle Umgebung mit Python 3.11
# ---------------------------------------------------------------------
RUN /usr/bin/python3.11 -m venv /opt/venv
ENV PATH="/opt/venv/bin:${PATH}"

# Websockify installieren (Version 0.12.0 wie bisher, für Stabilität).
RUN pip install --no-cache-dir websockify==0.12.0

# ---------------------------------------------------------------------
# Node.js 16 manuell installieren
# ---------------------------------------------------------------------
ENV NODE_VERSION=16.20.2

RUN set -eux; \
  arch="$(dpkg --print-architecture)"; \
  case "$arch" in \
  amd64) node_arch="x64" ;; \
  arm64) node_arch="arm64" ;; \
  *) echo "Unsupported arch: $arch" >&2; exit 1 ;; \
  esac; \
  curl -fsSL "https://nodejs.org/dist/v${NODE_VERSION}/node-v${NODE_VERSION}-linux-${node_arch}.tar.xz" -o /tmp/node.tar.xz; \
  mkdir -p /usr/local/lib/nodejs; \
  tar -xJf /tmp/node.tar.xz -C /usr/local/lib/nodejs; \
  ln -s /usr/local/lib/nodejs/node-v${NODE_VERSION}-linux-${node_arch}/bin/* /usr/local/bin/; \
  node -v && npm -v

# ---------------------------------------------------------------------
# Node-User einrichten (wie im Alpine-Setup)
# ---------------------------------------------------------------------
RUN useradd -m -U -s /bin/bash node \
  && mkdir -p /home/node/.npm-global \
  && chown -R node:node /home/node

# Arbeitsverzeichnis
WORKDIR /home/node


# =====================================================================
# Stage 2: dev
# - Entwicklungscontainer für VS Code DevContainer
# =====================================================================
FROM base AS dev

USER node
EXPOSE 8081
CMD ["bash", "-lc", "while :; do sleep 3600; done"]


# =====================================================================
# Stage 3: prod
# - Produktionscontainer
# =====================================================================
FROM base AS prod

COPY ./ /home/node/
RUN chown -R node:node /home/node

USER node

RUN npm run build

EXPOSE 8081
RUN chmod +x ./docker-entrypoint.sh

ENTRYPOINT ["/usr/bin/tini", "--", "/home/node/docker-entrypoint.sh"]