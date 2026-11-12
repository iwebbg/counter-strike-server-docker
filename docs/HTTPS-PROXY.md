# HTTPS reverse proxy за CS Control

Panel и `full` stack-овете включват NGINX reverse proxy с автоматично TLS
управление. NGINX проксира към вътрешния адрес `panel:8080`; Node panel-ът не
се променя и остава достъпен директно само през loopback bind-а
`127.0.0.1:${PANEL_PORT}` за диагностика.

```text
Browser -> host:PANEL_HTTPS_PORT -> NGINX:443 -> panel:8080
                 |
                 `-> TLS certificate and security headers
```

Външният HTTPS port не е задължително `443`. Например `8443:443` означава, че
потребителят отваря `https://panel.example.com:8443`, а NGINX продължава да
слуша на container port 443 и да proxy-ва към panel port 8080.

## Локален self-signed сертификат

Това е default режимът и не изисква публичен domain:

```bash
./docker/compose setup panel
./docker/compose tls selfsigned localhost 8443
./docker/compose up -d --build
```

Отворете:

```text
https://localhost:8443
```

Сертификатът се генерира автоматично с OpenSSL и се пази в persistent
`panel_letsencrypt` volume. Browser-ът ще покаже предупреждение, докато
сертификатът не бъде добавен към trusted certificates. Този режим е подходящ за
localhost, LAN, VPN и development.

## Let’s Encrypt

Нужни са public DNS запис към VPS-а и публичен TCP port 80 за HTTP-01 challenge:

```bash
./docker/compose setup full
./docker/compose tls letsencrypt panel.example.com 8443 admin@example.com
./docker/compose up -d --build
```

Панелът ще бъде достъпен на:

```text
https://panel.example.com:8443
```

Сертификатът е валиден за domain-а независимо дали HTTPS използва host port
443, 8443 или друг свободен port. За стандартен URL без `:port` използвайте:

```bash
./docker/compose tls letsencrypt panel.example.com 443 admin@example.com
```

ACME HTTP-01 винаги проверява публичен port 80. Затова `PANEL_HTTP_PORT=80`
трябва да бъде достижим отвън, дори когато HTTPS е на нестандартен port. Ако
доставчикът или друга услуга вече използва port 80, ще е нужен външен reverse
proxy, NAT правило или бъдещ DNS-01 provider.

NGINX проверява сертификата при старт и Certbot прави renewal проверка на всеки
12 часа. При успешно обновяване NGINX се reload-ва без спиране на panel-а.

## Настройки

```dotenv
PANEL_TLS_MODE=selfsigned
PANEL_DOMAIN=localhost
PANEL_SSL_EMAIL=
PANEL_PROXY_BIND_IP=0.0.0.0
PANEL_HTTP_PORT=80
PANEL_HTTPS_PORT=8443
```

| Променлива | Предназначение |
|---|---|
| `PANEL_TLS_MODE` | `selfsigned` или `letsencrypt` |
| `PANEL_DOMAIN` | DNS name, използван от сертификата и NGINX |
| `PANEL_SSL_EMAIL` | Let’s Encrypt account email |
| `PANEL_PROXY_BIND_IP` | Host interface за HTTP/HTTPS ports |
| `PANEL_HTTP_PORT` | Host port към NGINX container port 80 |
| `PANEL_HTTPS_PORT` | Host port към NGINX container port 443 |
| `PANEL_PORT` | Директен loopback diagnostic port към panel:8080 |

## Volumes

- `panel_letsencrypt` — certificates, renewal configuration и private keys;
- `panel_certbot_www` — ACME webroot challenge файлове.

`docker compose down` запазва сертификатите. `down -v` ги изтрива заедно с
останалите persistent volumes.

## Security

- HTTPS защитава transport-а, но не замества силния `PANEL_TOKEN`.
- Не публикувайте директния `PANEL_PORT=8080` на `0.0.0.0`; default bind-ът е
  `127.0.0.1`.
- Ограничете HTTPS port-а с firewall/VPN, когато панелът е само за оператори.
- `panel-proxy` няма Docker socket; единствено backend panel container-ът има
  allowlisted Docker Engine достъп.
- Архивирайте private keys внимателно и не ги commit-вайте в repository.

## Диагностика

```bash
./docker/compose ps
./docker/compose logs --tail=200 panel-proxy
curl --insecure https://127.0.0.1:${PANEL_HTTPS_PORT}/api/health
```

При Let’s Encrypt проблем проверете DNS, firewall и дали public port 80 достига
точно тази NGINX инстанция.
