#!/usr/bin/env bash
set -euo pipefail

tls_mode="${PANEL_TLS_MODE:-selfsigned}"
domain="${PANEL_DOMAIN:-localhost}"
https_port="${PANEL_HTTPS_PORT:-8443}"
certificate_directory="/etc/letsencrypt/live/${domain}"
certificate_file="${certificate_directory}/fullchain.pem"
certificate_key="${certificate_directory}/privkey.pem"

case "$tls_mode" in
  selfsigned|letsencrypt) ;;
  *) printf 'PANEL_TLS_MODE must be selfsigned or letsencrypt.\n' >&2; exit 1 ;;
esac

[[ "$domain" =~ ^[a-zA-Z0-9.-]+$ ]] || { printf 'PANEL_DOMAIN contains unsupported characters.\n' >&2; exit 1; }
[[ "$https_port" =~ ^[0-9]+$ ]] && (( https_port >= 1 && https_port <= 65535 )) || {
  printf 'PANEL_HTTPS_PORT must be between 1 and 65535.\n' >&2
  exit 1
}

mkdir -p "$certificate_directory" /var/www/certbot

if [[ "$tls_mode" == letsencrypt ]]; then
  [[ "$domain" != localhost ]] || { printf 'PANEL_DOMAIN must be a public DNS name for letsencrypt mode.\n' >&2; exit 1; }
  ssl_email="${PANEL_SSL_EMAIL:-webmaster@${domain}}"
  if [[ ! -s "$certificate_file" || ! -s "$certificate_key" ]]; then
    certbot certonly \
      --standalone \
      --preferred-challenges http \
      --non-interactive \
      --agree-tos \
      --email "$ssl_email" \
      --domain "$domain"
  fi
else
  if [[ ! -s "$certificate_file" || ! -s "$certificate_key" ]]; then
    openssl req -x509 -newkey rsa:3072 -sha256 -nodes -days 825 \
      -keyout "$certificate_key" \
      -out "$certificate_file" \
      -subj "/CN=${domain}" \
      -addext "subjectAltName=DNS:${domain}"
  fi
fi

if [[ "$https_port" == 443 ]]; then
  export PANEL_HTTPS_SUFFIX=""
else
  export PANEL_HTTPS_SUFFIX=":${https_port}"
fi
export PANEL_DOMAIN="$domain"
export PANEL_CERTIFICATE="$certificate_file"
export PANEL_CERTIFICATE_KEY="$certificate_key"

envsubst '${PANEL_DOMAIN} ${PANEL_HTTPS_SUFFIX} ${PANEL_HTTPS_PORT} ${PANEL_CERTIFICATE} ${PANEL_CERTIFICATE_KEY}' \
  < /etc/nginx/templates/default.conf.template \
  > /etc/nginx/conf.d/default.conf

nginx -t

if [[ "$tls_mode" == letsencrypt ]]; then
  (
    while true; do
      sleep 12h
      certbot renew \
        --webroot \
        --webroot-path /var/www/certbot \
        --quiet \
        --deploy-hook "nginx -s reload"
    done
  ) &
fi

exec nginx -g 'daemon off;'
