# =====================================================================
# Stage 1: base-runtime (minimal runtime dependencies)
# =====================================================================
FROM ubuntu:24.04 AS base-runtime

ENV DEBIAN_FRONTEND=noninteractive

# Deadsnakes PPA für Python 3.11 + Runtime-Pakete + Python venv + websockify in one layer
RUN apt-get update && apt-get install -y --no-install-recommends software-properties-common && \
    add-apt-repository ppa:deadsnakes/ppa && \
    apt-get update && \
    apt-get install -y --no-install-recommends \
        bash \
        python3.11 \
        python3.11-venv \
        tini && \
    apt-get remove -y software-properties-common && \
    apt-get autoremove -y && \
    rm -rf /var/lib/apt/lists/* && \
    /usr/bin/python3.11 -m venv /opt/venv && \
    /opt/venv/bin/pip install --no-cache-dir websockify==0.12.0

ENV PATH="/opt/venv/bin:${PATH}"

# User node anlegen
RUN useradd -m -U -s /bin/bash node && \
    chown -R node:node /home/node

WORKDIR /home/node


# =====================================================================
# Stage 2: builder (build-time dependencies)
# =====================================================================
FROM base-runtime AS builder

# Build argument for git commit hash (passed from CI/CD or docker build command)
ARG GIT_COMMIT=unknown

USER root

# Build-Tools + Node.js Installation in einem Layer
RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates \
    curl \
    git \
    xz-utils && \
    rm -rf /var/lib/apt/lists/* && \
    set -eux; \
    arch="$(dpkg --print-architecture)"; \
    case "$arch" in \
      amd64) node_arch="x64" ;; \
      arm64) node_arch="arm64" ;; \
      *) echo "Unsupported arch: $arch" >&2; exit 1 ;; \
    esac; \
    NODE_VERSION=22.20.0; \
    curl --proto "=https" -fsSL "https://nodejs.org/dist/v${NODE_VERSION}/node-v${NODE_VERSION}-linux-${node_arch}.tar.xz" -o /tmp/node.tar.xz; \
    mkdir -p /usr/local/lib/nodejs; \
    tar -xJf /tmp/node.tar.xz -C /usr/local/lib/nodejs; \
    rm /tmp/node.tar.xz; \
    ln -sfn "/usr/local/lib/nodejs/node-v${NODE_VERSION}-linux-${node_arch}/bin/node" /usr/local/bin/node; \
    ln -sfn "/usr/local/lib/nodejs/node-v${NODE_VERSION}-linux-${node_arch}/bin/npm" /usr/local/bin/npm; \
    ln -sfn "/usr/local/lib/nodejs/node-v${NODE_VERSION}-linux-${node_arch}/bin/npx" /usr/local/bin/npx; \
    /usr/local/bin/node -v && /usr/local/bin/npm -v

ENV PATH="/usr/local/bin:/usr/local/sbin:/usr/sbin:/usr/bin:/sbin:/bin:${PATH}"

# Projekt-Files kopieren und builden
COPY --chown=node:node --chmod=755 ./ /home/node/
USER node
WORKDIR /home/node

RUN bash -lc 'if [ -f package-lock.json ] || [ -f npm-shrinkwrap.json ]; then npm ci --ignore-scripts; else npm install --ignore-scripts; fi'

# Pass GIT_COMMIT to build process
ENV GIT_COMMIT=${GIT_COMMIT}
RUN npm run build


# =====================================================================
# Stage 3: dev (development environment)
# =====================================================================
FROM builder AS dev

USER root

# Install development tools and GitHub CLI
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    ca-certificates \
    curl \
    gh \
    gnupg \
    nano \
    net-tools \
    openssh-client \
    sudo \
    vim \
    && mkdir -p /etc/apt/keyrings \
    && curl --proto "=https" -fsSL https://cli.github.com/packages/githubcli-archive-keyring.gpg \
        | tee /etc/apt/keyrings/githubcli-archive-keyring.gpg > /dev/null \
    && chmod go+r /etc/apt/keyrings/githubcli-archive-keyring.gpg \
    && echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/githubcli-archive-keyring.gpg] https://cli.github.com/packages stable main" \
        | tee /etc/apt/sources.list.d/github-cli.list > /dev/null \
    && apt-get update \
    && apt-get install -y --no-install-recommends gh \
    && rm -rf /var/lib/apt/lists/*

# Install Playwright system dependencies for Chromium
# Required for automated loopback frequency tests
RUN ./node_modules/.bin/playwright install-deps chromium

# GitHub Codespaces' SSH broker targets its built-in `codespace` user and home.
RUN usermod --login codespace --home /home/codespace --move-home node \
    && groupmod --new-name codespace node \
    && echo "codespace ALL=(ALL) NOPASSWD:ALL" > /etc/sudoers.d/codespace \
    && chmod 0440 /etc/sudoers.d/codespace \
    && mkdir -p /home/codespace/.npm \
    && chown -R codespace:codespace /home/codespace
WORKDIR /home/codespace
USER codespace

CMD ["bash", "-lc", "while :; do sleep 3600; done"]


# =====================================================================
# Stage 4: prod (production - minimal runtime only)
# =====================================================================
FROM base-runtime AS prod

# Copy built artifacts (no Node.js needed!)
COPY --from=builder --chown=node:node --chmod=555 /home/node/dist /home/node/dist

# Create auth-server directory (needs 755 for directory traversal)
RUN mkdir -p /home/node/auth-server && chown node:node /home/node/auth-server
COPY --chown=node:node --chmod=644 ./auth-server/server.py /home/node/auth-server/server.py

COPY --chown=node:node --chmod=555 ./docker-entrypoint.sh /home/node/docker-entrypoint.sh

USER node
WORKDIR /home/node

ENTRYPOINT ["/usr/bin/tini", "--", "/home/node/docker-entrypoint.sh"]
