FROM nginx:1.29-alpine

RUN rm -f /etc/nginx/conf.d/default.conf

COPY docker/nginx/external/default.conf /etc/nginx/conf.d/default.conf
