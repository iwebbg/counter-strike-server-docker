#!/bin/sh
set -eu

if [ "${DB_ENABLED:-0}" = "1" ]; then
  echo "Applying database migrations..."
  DB_MULTIPLE_STATEMENTS=1 npm run migrate

  if [ -n "${BOOTSTRAP_ADMIN_EMAIL:-}" ] && [ -n "${BOOTSTRAP_ADMIN_PASSWORD:-}" ]; then
    echo "Ensuring the bootstrap administrator exists..."
    npm run admin:create
  fi
fi

exec node src/index.mjs
