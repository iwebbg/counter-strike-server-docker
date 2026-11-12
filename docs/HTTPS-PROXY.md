# NGINX: local, external и production

Control Panel винаги минава през NGINX и винаги използва един backend:
`panel:8080`. Подобно на `counter-strike-web-laravel`, средата избира отделен
Compose overlay и отделна NGINX конфигурация, без да променя приложението.

| Среда | Compose overlay | NGINX | Browser URL |
|---|---|---|---|
| Local | `compose.local.yaml` | HTTP, без сертификат | `http://127.0.0.1:8080` |
| External | `compose.external.yaml` | HTTP в existing Docker network | URL-ът на upstream proxy-то |
| Production | `compose.production.yaml` | HTTPS + автоматичен Certbot | domain на `443` или избран port |

```text
Local:      Browser -> 127.0.0.1:PANEL_PORT -> NGINX:80 -> panel:8080
External:   Upstream proxy -> external network alias:80 -> NGINX -> panel:8080
Production: Browser -> domain:PANEL_HTTPS_PORT -> NGINX:443 -> panel:8080
```

## Local

`setup panel` и `setup full` използват local overlay по подразбиране:

```bash
./docker/compose setup panel
./docker/compose up -d --build
```

Отворете `http://127.0.0.1:8080`. Няма SSL, self-signed сертификати или
Certbot. Host port-ът се контролира от `PANEL_PORT`, а bind адресът по
подразбиране е само `127.0.0.1`.

Local NGINX конфигурацията е в `docker/nginx/local.conf`.

## Existing Docker network / external proxy

Този режим е за преглед през вече работещ Traefik, NGINX Proxy Manager,
Caddy или друг reverse proxy. External NGINX няма host port и се включва към
зададена existing Docker network:

```bash
docker network ls
./docker/compose external server1_net cs16-panel
./docker/compose up -d --build
```

В upstream proxy-то използвайте target `http://cs16-panel:80`. Alias-ът се
вижда само от containers в `server1_net`. `panel:8080` остава достъпен само във
вътрешната Compose network.

Overlay-ът следва `docker-compose.external.yaml` модела от Laravel проекта:
отделен minimal NGINX image, без публикувани ports, с application и external
network едновременно.

## Production с автоматичен SSL

Нужни са public DNS запис към VPS-а и публичен TCP port 80 за първоначалния
Let's Encrypt HTTP-01 challenge:

```bash
./docker/compose setup full
./docker/compose publish panel.example.com 443 admin@example.com
./docker/compose up -d --build
```

`publish` превключва `CS16_DEPLOYMENT=production`, след което wrapper-ът избира
`compose.production.yaml`. Production image-ът и Certbot lifecycle-ът следват
работещия шаблон от `counter-strike-web-laravel`:

- Certbot standalone издава липсващия сертификат при първи старт;
- certificates и ACME файловете са в persistent named volumes;
- renewal се проверява на всеки 12 часа;
- при renewal NGINX се reload-ва без спиране на panel-а.

Връщане към local NGINX:

```bash
./docker/compose down
./docker/compose unpublish
./docker/compose up -d --build
```

## Нестандартен HTTPS port

Външният HTTPS port не е задължително `443`:

```bash
./docker/compose publish panel.example.com 8443 admin@example.com
```

Тогава URL-ът е `https://panel.example.com:8443`, host mapping-ът е
`8443:443`, а NGINX продължава да proxy-ва към `panel:8080`. ACME HTTP-01 все
още изисква публичен port 80.

## Настройки

```dotenv
CS16_DEPLOYMENT=local
PANEL_ADMIN_EMAIL=admin@example.com
PANEL_ADMIN_PASSWORD=change-admin-password
REDIS_PASSWORD=change-redis-password
PANEL_BIND_IP=127.0.0.1
PANEL_PORT=8080
PANEL_DOMAIN=panel.example.com
PANEL_SSL_EMAIL=admin@example.com
PANEL_PROXY_BIND_IP=0.0.0.0
PANEL_HTTP_PORT=80
PANEL_HTTPS_PORT=443
PANEL_EXTERNAL_NETWORK=server1_net
PANEL_EXTERNAL_ALIAS=cs16-panel
```

## Volumes и сигурност

- `panel_letsencrypt` пази certificates, renewal config и private keys;
- `panel_certbot_www` пази ACME webroot challenge файловете;
- `docker compose down` ги запазва, а `down -v` ги изтрива;
- HTTPS не замества силната операторска парола и защитата на login endpoint-а;
- NGINX няма Docker socket; само backend panel-ът има контролирания достъп;
- при external mode само trusted upstream proxy containers трябва да участват
  в зададената network;
- MariaDB и `panel:8080` не се публикуват директно на production host-а.

## Диагностика

```bash
./docker/compose show
./docker/compose ps
./docker/compose logs --tail=200 panel-proxy
```

При Let's Encrypt проблем проверете DNS, firewall и дали public port 80 достига
точно production NGINX контейнера.
