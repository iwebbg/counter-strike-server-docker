FROM nginx:1.29-bookworm

RUN apt-get update \
 && apt-get install -y --no-install-recommends ca-certificates certbot curl gettext-base openssl \
 && rm -rf /var/lib/apt/lists/* /etc/nginx/conf.d/default.conf

COPY docker/nginx/default.conf.template /etc/nginx/templates/default.conf.template
COPY docker/nginx/startup.sh /usr/local/bin/cs16-nginx-startup

RUN chmod 0755 /usr/local/bin/cs16-nginx-startup

EXPOSE 80 443
HEALTHCHECK --interval=20s --timeout=5s --retries=5 --start-period=10s \
  CMD curl --fail --silent --show-error --insecure https://127.0.0.1/healthz >/dev/null || exit 1

CMD ["/usr/local/bin/cs16-nginx-startup"]
