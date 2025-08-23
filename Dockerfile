# ---------------------------
# Stage 1: base (Ubuntu 24.04)
# ---------------------------
FROM ubuntu:24.04 AS base
ENV DEBIAN_FRONTEND=noninteractive

# Basis-Pakete inkl. Python/pip, tini und xz-utils (für .tar.xz)
RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates curl git tini bash \
    python3 python3-pip \
    xz-utils \
  && rm -rf /var/lib/apt/lists/*

# websockify exakt wie gepinnt (PEP 668 übersteuern – einfachste Variante)
RUN pip3 install --no-cache-dir --break-system-packages websockify==0.12.0

# ---- Node 16 via offizieller Binary-Tarball (inkl. npm) ----
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

# Unprivilegierter Nutzer 'node' (ohne feste UID/GID) + npm Globalpfad
RUN useradd -m -U -s /bin/bash node
ENV PATH=/home/node/.npm-global/bin:/home/node:$PATH \
    NPM_CONFIG_PREFIX=/home/node/.npm-global
RUN mkdir -p /home/node/.npm-global && chown -R node:node /home/node

WORKDIR /home/node

# ---------------------------
# Stage 2: dev
# ---------------------------
FROM base AS dev
USER node
EXPOSE 8081
# Container läuft idle für Entwicklung
CMD ["bash", "-lc", "while :; do sleep 3600; done"]

# ---------------------------
# Stage 3: prod
# ---------------------------
FROM base AS prod

# App-Quellcode kopieren und Rechte setzen
COPY ./ /home/node/
RUN chown -R node:node /home/node

USER node

# App builden
RUN npm run build

EXPOSE 8081

# Entrypoint ausführbar + mit tini starten
RUN chmod +x ./docker-entrypoint.sh
ENTRYPOINT ["/usr/bin/tini", "--", "docker-entrypoint.sh"]
