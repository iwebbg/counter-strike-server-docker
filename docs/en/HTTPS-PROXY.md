# NGINX: local, external, and production

[Български](../HTTPS-PROXY.md) | [English](HTTPS-PROXY.md)

The Control Panel always passes through NGINX and always uses the same backend:
`panel:8080`. Like `counter-strike-web-laravel`, each environment selects a
separate Compose overlay and NGINX configuration without changing the app.

| Environment | Compose overlay                  | NGINX                       | Browser URL                    |
| ----------- | -------------------------------- | --------------------------- | ------------------------------ |
| Local       | `docker/compose.local.yaml`      | HTTP, no certificate        | `http://127.0.0.1:8080`        |
| External    | `docker/compose.external.yaml`   | HTTP in an existing network | URL of the upstream proxy      |
| Production  | `docker/compose.production.yaml` | HTTPS + automatic Certbot   | domain on `443` or custom port |

```text
Local:      Browser -> 127.0.0.1:PANEL_PORT -> NGINX:80 -> panel:8080
External:   Upstream proxy -> external network alias:80 -> NGINX -> panel:8080
Production: Browser -> domain:PANEL_HTTPS_PORT -> NGINX:443 -> panel:8080
```

## Local

`setup panel` and `setup full` use the local overlay by default:

```bash
./docker/compose setup panel
./docker/compose up -d --build
```

Open `http://127.0.0.1:8080`. Local mode has no SSL, self-signed certificate,
or Certbot. `PANEL_PORT` controls the host port, and the default bind address is
loopback-only. The local NGINX configuration is `docker/nginx/local.conf`.

## Existing Docker network / external proxy

Use this mode behind an existing Traefik, NGINX Proxy Manager, Caddy, or other
reverse proxy. External NGINX publishes no host port and joins an existing
Docker network:

```bash
docker network ls
./docker/compose external server1_net cs16-panel
./docker/compose up -d --build
```

Configure the upstream target as `http://cs16-panel:80`. The alias is visible
only to containers in `server1_net`. `panel:8080` remains accessible only in
the internal Compose network.

The overlay follows the `docker-compose.external.yaml` model from the Laravel
project: a separate minimal NGINX image, no published ports, and membership in
both the application and external networks.

## Production with automatic SSL

You need a public DNS record pointing to the VPS and public TCP port 80 for the
initial Let's Encrypt HTTP-01 challenge:

```bash
./docker/compose setup full
./docker/compose publish panel.example.com 443 admin@example.com
./docker/compose up -d --build
```

`publish` switches `CS16_DEPLOYMENT=production`, causing the wrapper to select
`docker/compose.production.yaml`. The production image and Certbot lifecycle
follow the working `counter-strike-web-laravel` pattern:

- Certbot standalone issues a missing certificate on first start;
- certificates and ACME files live in persistent named volumes;
- renewal is checked every 12 hours;
- NGINX reloads without stopping the panel after renewal.

Return to local NGINX with:

```bash
./docker/compose down
./docker/compose unpublish
./docker/compose up -d --build
```

## Non-standard HTTPS port

The external HTTPS port does not have to be `443`:

```bash
./docker/compose publish panel.example.com 8443 admin@example.com
```

The URL becomes `https://panel.example.com:8443`, the host mapping is
`8443:443`, and NGINX still proxies to `panel:8080`. ACME HTTP-01 still needs
public port 80.

## Settings

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

## Volumes and security

- `panel_letsencrypt` stores certificates, renewal configuration, and private keys;
- `panel_certbot_www` stores ACME webroot challenge files;
- `./docker/compose down` preserves them, while `down -v` deletes them;
- HTTPS does not replace a strong admin password and login endpoint protection;
- NGINX has no Docker socket; only the backend panel gets controlled access;
- in external mode, only trusted upstream proxy containers should join the network;
- MariaDB and `panel:8080` are not published directly on the production host.

## Diagnostics

```bash
./docker/compose show
./docker/compose ps
./docker/compose logs --tail=200 panel-proxy
```

For Let's Encrypt failures, verify DNS, the firewall, and that public port 80
reaches the production NGINX container.
