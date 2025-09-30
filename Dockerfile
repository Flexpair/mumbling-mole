# =====================================================================
# Stage 1: base
# =====================================================================
FROM ubuntu:24.04 AS base

ENV DEBIAN_FRONTEND=noninteractive

# Deadsnakes PPA für Python 3.11
RUN apt-get update && apt-get install -y --no-install-recommends software-properties-common && \
    add-apt-repository ppa:deadsnakes/ppa && \
    apt-get update

# Grundpakete
RUN apt-get install -y --no-install-recommends \
    ca-certificates \
    curl \
    git \
    tini \
    bash \
    jq \
    python3.11 \
    python3.11-venv \
    xz-utils && \
    rm -rf /var/lib/apt/lists/*

# Python 3.11 venv + websockify
RUN /usr/bin/python3.11 -m venv /opt/venv
ENV PATH="/opt/venv/bin:${PATH}"
RUN pip install --no-cache-dir websockify==0.12.0

# ---------------------------------------------------------------------
# Node.js 22 Installation (robust, feste Symlinks)
# ---------------------------------------------------------------------
ENV NODE_VERSION=22.20.0

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
    ln -sfn "/usr/local/lib/nodejs/node-v${NODE_VERSION}-linux-${node_arch}/bin/node" /usr/local/bin/node; \
    ln -sfn "/usr/local/lib/nodejs/node-v${NODE_VERSION}-linux-${node_arch}/bin/npm" /usr/local/bin/npm; \
    ln -sfn "/usr/local/lib/nodejs/node-v${NODE_VERSION}-linux-${node_arch}/bin/npx" /usr/local/bin/npx; \
    /usr/local/bin/node -v && /usr/local/bin/npm -v

# PATH explizit setzen
ENV PATH="/usr/local/bin:/usr/local/sbin:/usr/sbin:/usr/bin:/sbin:/bin:${PATH}"

# User node anlegen
RUN useradd -m -U -s /bin/bash node && \
    mkdir -p /home/node/.npm-global && \
    chown -R node:node /home/node

WORKDIR /home/node


# =====================================================================
# Stage 2: dev
# =====================================================================
FROM base AS dev

USER root
RUN mkdir -p /home/node/.npm && chown -R node:node /home/node
USER node

EXPOSE 8081 8082
CMD ["bash", "-lc", "while :; do sleep 3600; done"]


# =====================================================================
# Stage 3: prod
# =====================================================================
FROM base AS prod

COPY ./ /home/node/
RUN chown -R node:node /home/node

USER node
WORKDIR /home/node

RUN bash -lc 'if [ -f package-lock.json ] || [ -f npm-shrinkwrap.json ]; then npm ci; else npm install; fi'
RUN npm run build:force # smart-build.sh ensures vendor build & artifact validation

EXPOSE 8081 8082
RUN chmod +x ./docker-entrypoint.sh

ENTRYPOINT ["/usr/bin/tini", "--", "/home/node/docker-entrypoint.sh"]
