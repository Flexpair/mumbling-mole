# Stage 1: base
FROM node:16-alpine AS base
# Install required packages and Python dependencies
RUN apk add --no-cache git tini bash python3 py3-pip && \
    pip install --no-cache-dir websockify==0.12.0
# Set up npm global install path and environment variables
ENV PATH=/home/node/.npm-global/bin:/home/node:$PATH \
    NPM_CONFIG_PREFIX=/home/node/.npm-global
# Create npm global directory and set permissions for node user
RUN mkdir -p /home/node/.npm-global && chown -R node:node /home/node/.npm-global
WORKDIR /home/node

# Stage 2: dev
FROM base AS dev
USER node
# Expose development port
EXPOSE 8081
# Keep container running for development/debugging
CMD ["sh", "-lc", "while :; do sleep 3600; done"]

# Stage 3: prod
FROM base AS prod
# Copy application source code into the container
COPY ./ .
# Set ownership of files to node user
RUN chown -R node:node .
USER node
# Build the application
RUN npm run build
# Expose production port
EXPOSE 8081
# Ensure entrypoint script is executable
RUN chmod +x ./docker-entrypoint.sh
# Use tini for proper signal handling and run entrypoint script
ENTRYPOINT ["/sbin/tini", "--", "docker-entrypoint.sh"]
