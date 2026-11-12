#!/usr/bin/env bash
set -euo pipefail
: "${PANEL_DOMAIN:?Set PANEL_DOMAIN}"
: "${PANEL_SSL_EMAIL:?Set PANEL_SSL_EMAIL}"
: "${PANEL_HTTPS_PORT:?Set PANEL_HTTPS_PORT}"

if [ ! -f "/etc/letsencrypt/live/${PANEL_DOMAIN}/fullchain.pem" ]; then certbot certonly --standalone --non-interactive --agree-tos --email "$PANEL_SSL_EMAIL" --domain "$PANEL_DOMAIN"; fi
if [ "${PANEL_HTTPS_PORT}" = 443 ]; then
  export PANEL_HTTPS_SUFFIX=""
else
  export PANEL_HTTPS_SUFFIX=":${PANEL_HTTPS_PORT}"
fi
envsubst '${PANEL_DOMAIN} ${PANEL_HTTPS_SUFFIX} ${PANEL_HTTPS_PORT}' < /etc/nginx/templates/default.conf.template > /etc/nginx/conf.d/default.conf
(while true; do sleep 12h; certbot renew --webroot --webroot-path /var/www/certbot --quiet --deploy-hook "nginx -s reload"; done) &
exec nginx -g 'daemon off;'
