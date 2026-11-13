FROM node:24.22.1-bookworm-slim AS build

WORKDIR /usr/app
ENV NEXT_TELEMETRY_DISABLED=1
COPY frontend/cs-control/package*.json ./
RUN npm ci
COPY frontend/cs-control/ ./

ARG NEXT_PUBLIC_APP_NAME="CS 1.6 Server CP"
ENV NEXT_PUBLIC_APP_NAME=$NEXT_PUBLIC_APP_NAME
RUN npm run build

FROM node:24.22.1-bookworm-slim AS runtime

WORKDIR /usr/app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

COPY --from=build --chown=node:node /usr/app/public ./public
COPY --from=build --chown=node:node /usr/app/.next/standalone ./
COPY --from=build --chown=node:node /usr/app/.next/static ./.next/static

USER node
EXPOSE 3000
CMD ["node", "server.js"]
