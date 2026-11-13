# CS 1.6 Docker Server

[Български](README.md) | [English](README.en.md)

A self-hosted Counter-Strike 1.6 server image with Classic and GunGame modes,
AMX Mod X, Metamod, optional MariaDB fleet data, and an optional web control
panel. The project is designed for public use: clone it, configure `.env`, and
start a complete stack without buying a specialized game-hosting plan.

## What you get

- ReHLDS/HLDS-compatible Counter-Strike 1.6 runtime;
- Metamod and AMX Mod X with persistent data and logs;
- Classic and GunGame modes selected through environment variables;
- mode-specific map catalogs and rotations;
- recommended gameplay plugins, statistics, moderation, and kill-streak sounds;
- optional MariaDB shared statistics, bans, seasons, achievements, and admins;
- optional CS Control Panel with NGINX, Redis sessions, roles, audit history,
  backups, image updates, and dynamic server creation;
- local, external-network, and automatic HTTPS production deployments.

## Quick start

Requirements: Linux, Docker Engine with the Compose plugin, Git, and enough
disk space for the image and map packages. See
[Requirements](docs/en/REQUIREMENTS.md) for capacity planning.

```bash
git clone <repository-url>
cd counter-strike-server-docker
./docker/compose setup full
./docker/compose up -d --build
./docker/compose ps
```

The setup command creates `.env` and generates missing RCON, panel, database,
and Redis secrets. Review the resulting file before publishing the server.

Common stacks:

```bash
./docker/compose setup server    # game server only
./docker/compose setup database  # game server + MariaDB
./docker/compose setup panel     # game server + panel + NGINX + DB + Redis
./docker/compose setup full      # complete recommended stack
```

Connect from the game console:

```text
connect YOUR_HOST:27015
```

Useful checks:

```bash
./docker/compose logs -f server
./docker/compose doctor
docker exec cs16-server-1 amxx plugins
```

## Selecting a game mode

Set the mode in `.env`:

```dotenv
SERVER_MODE=classic
SERVER_NAME=My CS 1.6 Server
MAX_PLAYERS=24
SERVER_PORT=27015
START_MAP=de_dust2
RCON_PASSWORD=replace-with-a-long-random-secret
SERVER_PASSWORD=
SV_LAN=0
REGION=3
```

For GunGame:

```dotenv
SERVER_MODE=gungame
START_MAP=gg_3way
GG_DOUBLEJUMP_ENABLED=1
GG_DOUBLEJUMP_VELOCITY=350.0
```

`MAPCYCLE` may contain a comma-separated override. Without it, the image uses
the catalog for the selected mode. The entrypoint validates the mode, map
names, passwords, and player limits before starting HLDS.

## Recommended gameplay pack

Both modes include:

- `/rank`, `/stats`, `/statsme`, and `/top15`;
- welcome/help messages and configurable project branding;
- warmup, spawn protection, semiclip, and AFK management;
- rock-the-vote, recent-map protection, admin map menus, and map voting;
- First Blood, multi-kill, and no-death streak HUD/sound announcements;
- persistent bans and AMXX administration;
- optional threaded MariaDB collection for detailed fleet statistics.

GunGame additionally provides progressive weapon levels, respawn, a knife
finale, `/level`, wins, and configurable double jump.

Gameplay settings are documented in `.env.example`; the kill-streak package is
described in [Kill-streak announcements](docs/en/KILLSTREAKS.md).

### Maps

Repository map packages live in `classic_maps/` and `gungame_maps/`. During the
image build, the installer normalizes nested `cstrike/` layouts, copies BSP,
WAD, models, sounds, sprites, and gfx resources, skips `.ztmp` files, and checks
that every configured map has a BSP file.

The panel also supports persistent ZIP map packages with path, CRC,
compression-ratio, size, and resource validation. Managed packages can be
listed, replaced, and deleted safely. A package cannot be deleted while one of
its maps is active or selected in the current rotation.

## MariaDB fleet data

MariaDB is optional for a standalone game server and required for panel login.
Enable it through the `database`, `panel`, or `full` stack. One database is
shared by all controlled game servers and stores:

- player identities and known names;
- sessions, playtime, combat, map, and GunGame statistics;
- seasons and achievements;
- fleet/server bans and moderation history;
- global AMXX admins and server registry;
- panel operators and panel audit history.

The database port is not published by default. See
[MariaDB fleet data](docs/en/DATABASE.md) for schema, backup, and restore.

## More than one server

You may run separate Compose projects with different environment files:

```bash
CS16_ENV_FILE=.env.classic ./docker/compose up -d
CS16_ENV_FILE=.env.gungame ./docker/compose up -d
```

Each instance needs a unique host port and Compose project/container namespace.
For automatic sequential ports and per-server persistent volumes, use the web
panel instead.

## CS Control Panel (optional)

Start it with:

```bash
./docker/compose setup panel
./docker/compose up -d --build
```

Open `http://127.0.0.1:8080` and sign in with the generated
`PANEL_ADMIN_EMAIL` and `PANEL_ADMIN_PASSWORD`. The panel provides:

- a Next.js interface with separate Dashboard, Servers, Operators, and Audit log pages;
- local hot reload and a production standalone build;
- dynamic Classic/GunGame server creation and automatic ports;
- start, stop, restart, logs, A2S status, players, and current map;
- live map rotation and safe `Play now` through RCON;
- validated ZIP map package upload, list, replace, and delete;
- AMXX admin editing and fleet-wide admin inheritance;
- image-version detection, per-server update, rollback, and Update all;
- versioned AMXX/log/MariaDB backup and restore;
- statistics, leaderboards, bans, seasons, and achievements;
- Owner/Admin/Moderator/Viewer roles and API-enforced permissions;
- searchable MariaDB audit history;
- Bulgarian and English UI.

See [CS Control Panel](docs/en/WEB-PANEL.md) for the complete guide.

Stop only the web layer without stopping game servers:

```bash
./docker/compose stop panel panel-web panel-proxy
```

## Administrators and RCON

Configure initial full administrators as comma-separated Steam IDs:

```dotenv
AMXX_ADMINS=STEAM_0:1:123456,STEAM_0:0:654321
```

Players can run `status` in the game console to find their Steam ID. Full AMXX
administrators open the menu with `amxmodmenu`. The panel can update per-server
or fleet-wide admin lists live without restarting the game.

Keep RCON private and random. Do not publish it in screenshots, logs, issue
reports, or committed `.env` files.

## Adding AMX Mod X plugins

Place source files under `addons/scripting/` using the `docker_*.sma` naming
convention. The image build compiles them and copies the resulting `.amxx`
files. Add mode-specific activation to the appropriate AMXX configuration and
rebuild:

```bash
./docker/compose build server
./docker/compose up -d server
```

Keep plugin settings configurable through cvars/environment values and persist
runtime state under the mounted AMXX data directory.

## Configuration files

- [`.env.example`](.env.example) — all deployment and gameplay settings;
- [`docker/compose`](docker/compose) — interactive/non-interactive selector;
- [`docker/compose.yaml`](docker/compose.yaml) — base services;
- [`docs/en/COMPOSE-LAUNCHER.md`](docs/en/COMPOSE-LAUNCHER.md) — launcher guide;
- [`docs/en/HTTPS-PROXY.md`](docs/en/HTTPS-PROXY.md) — NGINX and SSL;
- [`docs/en/ARCHITECTURE.md`](docs/en/ARCHITECTURE.md) — component boundaries;
- [`docs/en/ROADMAP.md`](docs/en/ROADMAP.md) — implemented and planned work;
- [`docs/en/PROJECT-STATUS.md`](docs/en/PROJECT-STATUS.md) — current handoff.

## Verification and diagnostics

```bash
./docker/compose config --quiet
./docker/compose doctor
./docker/compose ps
./docker/compose logs --tail=200 server panel mariadb redis panel-proxy
npm --prefix backend/cs-control-service test
npm run format:check
```

Game ports require both UDP and TCP firewall rules. Panel production publishing
also requires public TCP port 80 for the Let's Encrypt HTTP-01 challenge and
the configured HTTPS port.

## Security

- replace every example password before public deployment;
- keep `.env`, backup archives, Docker socket access, and RCON secret;
- expose MariaDB and Redis only on internal Docker networks;
- use the included NGINX/HTTPS deployment or an existing trusted reverse proxy;
- apply OS/firewall updates and restrict SSH access;
- treat panel backup files as secrets because they contain environment values;
- use Owner accounts sparingly and assign the least-privileged operator role;
- review the panel audit log after access or configuration changes.

The panel controls Docker through `/var/run/docker.sock`; access to the panel is
therefore equivalent to privileged host administration. Do not expose it
without authentication and transport security.

## Help and support

If you encounter a problem, open a [GitHub Issue](https://github.com/iwebbg/counter-strike-server-docker/issues/new)
or email [office@interweb.bg](mailto:office@interweb.bg). Remove passwords,
tokens, RCON, and personal data before publishing logs.

If this project is useful to you, you can voluntarily support its maintenance and development:

- [Buy Me a Coffee](https://buymeacoffee.com/interweb.bg)
- [Ko-fi](https://ko-fi.com/interwebltd)
- [PayPal](https://paypal.me/interwebltd)
