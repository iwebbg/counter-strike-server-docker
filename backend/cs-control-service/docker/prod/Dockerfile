FROM node:24.22.1-bookworm-slim AS dependencies

WORKDIR /usr/app
COPY backend/cs-control-service/package*.json ./
RUN npm ci --omit=dev

FROM node:24.22.1-bookworm-slim AS runtime

WORKDIR /usr/app
ENV NODE_ENV=production

RUN apt-get update \
  && apt-get install -y --no-install-recommends curl \
  && rm -rf /var/lib/apt/lists/*

COPY --from=dependencies /usr/app/node_modules ./node_modules
COPY backend/cs-control-service/package*.json ./
COPY backend/cs-control-service/src ./src
COPY panel/public ./public
COPY --chmod=755 backend/cs-control-service/docker/prod/entrypoint.sh /usr/local/bin/cs-control-entrypoint

USER node
ENTRYPOINT ["cs-control-entrypoint"]
