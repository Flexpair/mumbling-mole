# =====================================================================
# Stage 1: base-runtime (minimal runtime dependencies)
# =====================================================================
FROM ubuntu:24.04 AS base-runtime

ENV DEBIAN_FRONTEND=noninteractive

# Deadsnakes PPA für Python 3.11
RUN apt-get update && apt-get install -y --no-install-recommends software-properties-common && \
    add-apt-repository ppa:deadsnakes/ppa && \
    apt-get update && \
    apt-get remove -y software-properties-common && \
    apt-get autoremove -y

# Runtime-Pakete (nur was prod wirklich braucht)
RUN apt-get install -y --no-install-recommends \
    tini \
    bash \
    python3.11 \
    python3.11-venv && \
    rm -rf /var/lib/apt/lists/*

# Python 3.11 venv + websockify
RUN /usr/bin/python3.11 -m venv /opt/venv
ENV PATH="/opt/venv/bin:${PATH}"
RUN pip install --no-cache-dir websockify==0.12.0

# User node anlegen
RUN useradd -m -U -s /bin/bash node && \
    chown -R node:node /home/node

WORKDIR /home/node


# =====================================================================
# Stage 2: builder (build-time dependencies)
# =====================================================================
FROM base-runtime AS builder

USER root

# Build-Tools installieren
RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates \
    curl \
    git \
    xz-utils && \
    rm -rf /var/lib/apt/lists/*

# ---------------------------------------------------------------------
# Node.js 22 Installation (nur für Build)
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
    rm /tmp/node.tar.xz; \
    ln -sfn "/usr/local/lib/nodejs/node-v${NODE_VERSION}-linux-${node_arch}/bin/node" /usr/local/bin/node; \
    ln -sfn "/usr/local/lib/nodejs/node-v${NODE_VERSION}-linux-${node_arch}/bin/npm" /usr/local/bin/npm; \
    ln -sfn "/usr/local/lib/nodejs/node-v${NODE_VERSION}-linux-${node_arch}/bin/npx" /usr/local/bin/npx; \
    /usr/local/bin/node -v && /usr/local/bin/npm -v

ENV PATH="/usr/local/bin:/usr/local/sbin:/usr/sbin:/usr/bin:/sbin:/bin:${PATH}"

# Projekt-Files kopieren und builden
COPY --chown=node:node ./ /home/node/
USER node
WORKDIR /home/node

RUN bash -lc 'if [ -f package-lock.json ] || [ -f npm-shrinkwrap.json ]; then npm ci; else npm install; fi'
RUN npm run build:force


# =====================================================================
# Stage 3: dev (development environment)
# =====================================================================
FROM builder AS dev

USER root

RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    vim \
    nano \
    sudo \
    net-tools \
    openssh-client \
    && rm -rf /var/lib/apt/lists/*

RUN mkdir -p /home/node/.npm && chown -R node:node /home/node
USER node

EXPOSE 8081 8082
CMD ["bash", "-lc", "while :; do sleep 3600; done"]


# =====================================================================
# Stage 4: prod (production - minimal runtime only)
# =====================================================================
FROM base-runtime AS prod

# Nur die gebauten Artefakte kopieren, NICHT node_modules oder Build-Tools
COPY --from=builder --chown=node:node /home/node/dist /home/node/dist
COPY --chown=node:node ./docker-entrypoint.sh /home/node/docker-entrypoint.sh

USER node
WORKDIR /home/node

RUN chmod +x ./docker-entrypoint.sh

EXPOSE 8081 8082

ENTRYPOINT ["/usr/bin/tini", "--", "/home/node/docker-entrypoint.sh"]
