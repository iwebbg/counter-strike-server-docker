FROM node:24.22.1-bookworm-slim

WORKDIR /usr/app
ENV NEXT_TELEMETRY_DISABLED=1
COPY frontend/cs-control/package*.json ./
RUN npm ci
COPY frontend/cs-control/ ./

EXPOSE 3000
CMD ["npm", "run", "dev", "--", "-H", "0.0.0.0"]
