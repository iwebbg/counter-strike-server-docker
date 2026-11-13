# Compose selector

[Български](../COMPOSE-LAUNCHER.md) | [English](COMPOSE-LAUNCHER.md)

[`docker/compose`](../../docker/compose) is the single deployment entry point.
It reads the selected stack and deployment mode from `.env`, then applies the
correct Compose files and profiles.

## Initial setup

```bash
./docker/compose setup
```

The interactive selector offers:

| Stack      | Services                                                 |
| ---------- | -------------------------------------------------------- |
| `full`     | Game server, CS Control Panel, NGINX, MariaDB, and Redis |
| `panel`    | Game server, CS Control Panel, NGINX, MariaDB, and Redis |
| `database` | Game server and MariaDB                                  |
| `server`   | Game server only                                         |

The choice is stored as `CS16_STACK`. Setup uses OpenSSL to replace missing or
example RCON, panel, database, and Redis secrets without printing them.

For non-interactive use:

```bash
./docker/compose setup full
```

CI may select another environment file:

```bash
CS16_ENV_FILE=/run/secrets/cs16.env ./docker/compose config
```

The local panel stays on `http://127.0.0.1:8080`. Production publishing is an
explicit operation, so local development never creates certificates:

The local overlay runs the Next.js development server and the backend API under
nodemon. Changes in `frontend/cs-control` and `backend/cs-control-service/src`
hot reload; dependency or Dockerfile changes still require a rebuild.

```bash
./docker/compose publish panel.example.com 8443 admin@example.com
./docker/compose up -d --build
./docker/compose unpublish
```

To attach the NGINX service to an existing reverse-proxy network:

```bash
./docker/compose external server1_net cs16-panel
./docker/compose up -d --build
```

See [NGINX and HTTPS](HTTPS-PROXY.md).

## Daily commands

Run the wrapper without arguments for its interactive menu:

```bash
./docker/compose
```

It provides start/update, status, logs, restart, complete shutdown, confirmed
volume deletion, stack selection, and diagnostics. Direct commands are also
available:

```bash
./docker/compose up -d --build
./docker/compose ps
./docker/compose logs -f server panel mariadb
./docker/compose restart server
./docker/compose down
./docker/compose show
./docker/compose doctor
```

`down` resolves the complete project definition, including services from the
previously selected stack. Named volumes are retained unless `-v` is explicitly
provided.

## Changing the stack

Run setup again, then reconcile the deployment:

```bash
./docker/compose setup panel
./docker/compose up -d --build
```

Existing `.env` settings are preserved.

## Selecting the game engine

Valve HLDS is the stable default. Enable or roll back the experimental
ReHLDS/ReGameDLL profile without manually editing Compose files:

```bash
./docker/compose engine rehlds
./docker/compose up -d

./docker/compose engine valve
./docker/compose up -d
```

The selection is stored as `SERVER_ENGINE` in `.env`. See the
[ReHLDS compatibility matrix](REHLDS.md) for details.

## Standard Compose fallback

Advanced users may invoke Compose directly:

```bash
docker compose --project-directory . -f docker/compose.yaml up -d --build
docker compose --project-directory . -f docker/compose.yaml -f docker/compose.local.yaml --profile panel up -d --build
docker compose --project-directory . -f docker/compose.yaml -f docker/compose.external.yaml --profile panel up -d --build
docker compose --project-directory . -f docker/compose.yaml -f docker/compose.database.yaml -f docker/compose.production.yaml --profile panel up -d --build
```

This is useful for CI, custom overrides, and low-level diagnostics.
