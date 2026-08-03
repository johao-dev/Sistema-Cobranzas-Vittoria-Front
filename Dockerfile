FROM node:22-bookworm-slim

ENV CHOKIDAR_USEPOLLING=true \
    WATCHPACK_POLLING=true \
    NG_CLI_ANALYTICS=false \
    npm_config_cache=/tmp/npm

RUN apt-get update \
    && apt-get install -y --no-install-recommends bash git gosu procps \
    && npm install -g npm@11.6.2 \
    && mkdir -p /tmp/npm /workspace \
    && chmod -R 777 /tmp/npm /workspace \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /workspace/Sistema-Cobranzas-Vittoria-Front/cobranza-vittoria

EXPOSE 4200
