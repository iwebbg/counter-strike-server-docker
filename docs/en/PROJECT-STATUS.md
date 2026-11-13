# Project status and handoff

[Български](../PROJECT-STATUS.md) | [English](PROJECT-STATUS.md)

Last updated: November 13, 2026.

This document records the current implementation and provides a starting point
for the next work session. The user quick start is in
[`README.en.md`](../../README.en.md), and dashboard details are in
[`WEB-PANEL.md`](WEB-PANEL.md).

## Project goal

One reproducible Docker image for easily launching Counter-Strike 1.6 Classic
and GunGame servers. The project works as a regular Docker Compose stack or
with the optional interactive CS Control Panel for multiple isolated instances
and automatic port allocation.

## Implemented

### Game image and Compose

- Debian-based HLDS image installed with SteamCMD App 90 `steam_legacy`;
- Metamod `1.21.1-am` and AMX Mod X `1.9.0.5303`;
- unprivileged `hlds` user, `tini`, health check, and graceful stop;
- one image with runtime `SERVER_MODE=classic|gungame` selection;
- `.env` configuration for name, port, slots, start map, mapcycle, passwords,
  region, LAN mode, welcome message, and GunGame double jump;
- configurable AMXX scroll/HUD branding;
- persistent AMXX data and log volumes;
- optional MariaDB Compose overlay without a public database port;
- structured Express/Knex backend with REST descriptors, AJV validation,
  Swagger, MariaDB migrations, OAuth-style login, and Redis session cache;
- deployment and capacity planning guide with VPS profiles, idle measurements,
  and a bandwidth formula.

### Maps and modes

- custom packages from `classic_maps/` and `gungame_maps/`;
- installer that normalizes nested `cstrike/` structures, copies resources,
  and skips `.ztmp` cache files;
- ZIP lifecycle with in-memory parsing, CRC/path/zip-bomb validation,
  persistent manifests, replacement, and safe deletion outside the current
  map and active rotation;
- separate Classic and GunGame mapcycles;
- build-time verification that every configured map has a `.bsp`;
- standard AMXX admin, menu, map vote, and statistics plugins in both modes.

### Custom AMXX plugins

- `docker_gungame.sma`: 21 weapon levels, per-level kills, respawn, knife final;
- `docker_double_jump.sma`: configurable second jump in the air;
- `docker_welcome.sma`: welcome message and chat-command help;
- `docker_sql_stats.sma`: threaded MariaDB fleet collector for players, names,
  sessions, combat/playtime/map stats, GunGame progression, seasons,
  achievements, and database ban enforcement;
- `docker_gameplay.sma`: warmup, spawn protection, semiclip, and AFK manager;
- `docker_killstreak.sma`: First Blood, multi-kill, and streak HUD/sounds;
- `docker_mapvote.sma`: RTV, nominations, map list, and recent-map protection;
- `docker_community.sma`: K:D-aware team balance, one-sided round scramble,
  gag/mute, radio/chat flood protection, SafeName validation, `/rules`, and
  expanded `/help`;
- `docker_sql_stats.sma`: additionally tracks daily/weekly missions, map MVP,
  and revenge/nemesis progression;
- automatic build compilation for `addons/scripting/docker_*.sma`;
- deterministic `/rank`, `/stats`, `/statsme`, `/rankstats`, `/top15`, and
  `/level` command defaults.

### AMXX administration

- Steam ID administrators through `AMXX_ADMINS`;
- `amxmodmenu`, kick, ban, slap/slay, map menu, and map vote;
- live panel editor with Full admin, Moderator, Maps & votes, and custom flags;
- strict validation, at most 32 unique Steam IDs, and forbidden `z` flag;
- persistent `panel_admins.txt` plus generated `users.ini`;
- live `amx_reloadadmins` through GoldSource RCON;
- `Reset to .env` and persistent overrides across restart/recreate.

### CS Control Panel

- opt-in `panel` Compose profile, loopback-bound by default;
- MariaDB operator login, access/refresh tokens, HttpOnly cookie, Redis cache;
- Next.js 16 App Router frontend with TypeScript, sidebar routes, and a responsive mobile drawer;
- local development container with hot reload and a production standalone build;
- A2S map, player, and slot status;
- create, start, stop, restart, logs, and safe removal;
- automatic or manual host port and one-time generated RCON password display;
- controlled Edit/recreate while preserving data and log volumes;
- stable `SERVER_ID` URLs and APIs that survive recreate, image update, and
  restore, while retaining backward compatibility with container-ID links;
- a per-server gameplay editor for the welcome message, warmup, spawn
  protection, semiclip, GunGame double jump, AFK, RTV, and killstreak HUD/sounds;
- immutable image detection, update badges, single/Fleet Update all, and rollback;
- mode-specific map rotation and live RCON map changes;
- ZIP map package upload, listing, replacement, and guarded deletion;
- versioned backup/restore for AMXX data, custom maps, optional logs, and MariaDB;
- reusable templates, safe JSON import/export, Clone server, configuration
  history/diff/rollback, and health-aware recreate with RCON rotation;
- allowlisted network, CPU, and memory limits plus a read-only Compose assistant;
- automatic backup policies with retention and an optional off-host `PUT`
  destination;
- Live Players, validated kick/ban, persistent bans, and moderation audit;
- MariaDB dashboard with rankings, profiles, activity, achievements, seasons,
  bans, and history;
- fleet-wide admin inheritance;
- HLTV evidence sidecars with persistent demo history, download,
  suspicious-player markers, and automatic retention that protects marked demos;
- Discord operational notifications, login/moderation rate limits, an IP/VPN
  allowlist, and optional trusted forward-auth SSO;
- Owner/Admin/Moderator/Viewer roles and operator management;
- allowlisted Docker Engine API client without arbitrary exec or generic proxy.

## Architecture summary

```text
Browser -> NGINX -> Next.js panel-web :3000
              `-> CS API panel :8080 -> Docker socket -> labeled containers
                                      `-> A2S / GoldSource RCON

Internet -> host game port -> HLDS -> Metamod -> AMX Mod X -> active mode
                                                       |
                                              MariaDB (optional)
```

The panel and game servers are independent. Stopping the panel does not stop
created instances. Docker socket access is root-equivalent, so the panel must
not be exposed directly to the Internet.

## Skills and techniques used

### Codex skill package

- `sites:sites` informed the structure of the interactive dashboard. The
  implementation remained inside the repository because a hosted Site cannot
  safely manage the local Docker Unix socket.
- No image-generation, Pages, or external app/plugin integration was used.

### Technical work

- Dockerfile, Compose profiles/overlays, volumes, health checks, and labels;
- AMX Mod X/Pawn plugin development and build-time compilation;
- Express 5 service with route discovery and centralized errors;
- allowlisted Docker Engine API over Unix socket;
- GoldSource A2S and challenge-based UDP RCON;
- Next.js App Router, React, strict TypeScript, Tailwind, Radix UI, and Lucide;
- AJV validation, OAuth-style login, Redis cache, and container hardening;
- Node test runner, shell syntax checks, and real Docker smoke tests.

## Verified

- `bash -n docker/entrypoint.sh`;
- Next.js TypeScript typecheck and production standalone build;
- backend tests for routes, AJV, i18n, A2S, RCON, Docker streams, and domains;
- successful `cs16-server:local` and `cs16-control-panel:local` builds;
- healthy Compose server, panel, MariaDB, Redis, and NGINX;
- live A2S, admin save/reset, RCON map rotation/change, and moderation flows;
- local, external-network, and production NGINX overlay behavior;
- isolated ZIP upload, manifest listing, replacement, and deletion lifecycle;
- Owner/Admin/Moderator/Viewer API/UI permission matrix and audit logging;
- temporary dynamic instance creation and cleanup after smoke tests.

## Important limitations

- the Docker socket is highly privileged; use a strong password and enable the
  available rate limits, IP/VPN allowlist, or trusted SSO for remote access;
- the admin editor needs a running server for live RCON reload;
- an existing container needs one recreate with the current image to adopt
  newer entrypoint behavior;
- Remove preserves volumes by design; there is no automatic volume cleanup UI;
- the default `cs16_default` network must be configured for another Compose
  project name;
- HLTV cannot create demo frames on an empty server without real gameplay;

## Next logical tasks

1. FragZone telemetry integration as a separate future track.
2. ReHLDS performance benchmarks and an external-plugin compatibility lab.
3. ReSemiclip evaluation for the experimental ReHLDS profile.

## Continue in another session

```bash
git status
./docker/compose ps
npm --prefix panel test
./docker/compose up -d --build
```

Distinguish primary, panel-managed, and temporary test containers before any
destructive test. Never delete volumes or real instances without an explicit
decision.
