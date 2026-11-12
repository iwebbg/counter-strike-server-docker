FROM nginx:1.29-bookworm

RUN apt-get update && apt-get install -y --no-install-recommends certbot cron gettext-base && rm -rf /var/lib/apt/lists/* /etc/nginx/conf.d/default.conf

COPY docker/nginx/prod/default.conf.template /etc/nginx/templates/default.conf.template
COPY docker/nginx/prod/startup.sh /usr/local/bin/cs16-nginx-startup

RUN chmod 0755 /usr/local/bin/cs16-nginx-startup

CMD ["/usr/local/bin/cs16-nginx-startup"]
