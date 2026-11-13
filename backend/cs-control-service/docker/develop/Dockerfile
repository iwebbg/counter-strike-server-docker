FROM node:24.22.1-bookworm-slim

WORKDIR /usr/app

RUN apt-get update \
  && apt-get install -y --no-install-recommends bash curl \
  && rm -rf /var/lib/apt/lists/*

COPY backend/cs-control-service/package*.json ./
RUN npm ci

COPY backend/cs-control-service/ ./
COPY --chmod=755 backend/cs-control-service/docker/develop/entrypoint.sh /usr/local/bin/cs-control-develop-entrypoint

ENTRYPOINT ["cs-control-develop-entrypoint"]
