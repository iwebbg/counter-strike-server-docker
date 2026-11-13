# Product roadmap

[Български](../ROADMAP.md) | [English](ROADMAP.md)

This file collects the agreed development ideas for the CS 1.6 platform.
Statuses guide future sessions and are not delivery-date promises.

## Implemented recommended gameplay pack

- [x] Warmup countdown, respawn, and blocked GunGame progression;
- [x] GunGame spawn protection that ends when the player shoots;
- [x] teammate semiclip/anti-block;
- [x] AFK warning, Spectator move, and kick;
- [x] `/rtv`, `/nominate map`, `/maps`, and recent-map protection;
- [x] mode-specific map pools and persistent rotations;
- [x] Live Players, kick, Steam-ID ban, and moderation audit;
- [x] deterministic StatsX public commands;
- [x] live AMXX admins and categorized map manager;
- [x] optional First Blood, multi-kill, and streak HUD/sounds;
- [x] MariaDB fleet schema, automatic migrations, and legacy stats import;
- [x] detailed player, map, session, GunGame, name, and season statistics;
- [x] web leaderboard, profiles, achievements, and seasonal rankings;
- [x] fleet/server bans, revoke, and database moderation audit;
- [x] fleet-wide admins with inheritance;
- [x] persistent server registry and database connection monitoring.

## Next package

- [x] smarter team balancing by size and score/K:D;
- [x] configurable scramble after one-sided Classic rounds;
- [x] chat, voice, and radio-spam gag/mute system;
- [x] ban history/unban UI with reason, duration, and administrator;
- [x] MariaDB-backed fleet moderation history;
- [x] controlled server edit/recreate preserving volumes;
- [x] version-aware image update, rollback, and fleet Update all;
- [x] extracted-folder map upload with validation;
- [x] ZIP upload, auto category, persistent manifests, replace, and safe delete;
- [x] versioned AMXX/log/MariaDB backup, download, and restore;
- [x] scheduled retention and off-host backup destinations;
- [x] audit UI, API permission matrix, and Owner/Admin/Moderator/Viewer roles;
- [x] optional trusted forward-auth SSO for existing operator accounts;
- [x] custom permissions and optional per-server access scopes beyond the built-in roles.

## Server configuration track

- [x] stable `SERVER_ID` in panel URLs and APIs with container-ID backward compatibility;
- [x] allowlisted per-server gameplay settings for welcome, warmup, spawn
      protection, semiclip, double jump, AFK, RTV, and killstreak announcements;
- [x] reusable configuration templates, safe JSON import/export, and Clone server;
- [x] versioned configuration history, visual diff, and operator-attributed rollback;
- [x] health-aware recreate progress with player warning and visible rollback result;
- [x] RCON rotation with one-time display of the new value;
- [x] read-only Compose configuration assistant and `.env` change preview;
- [x] allowlisted network, CPU, and memory limits for panel-managed instances;
- [x] integration tests for stable ID, recreate, update, restore, and volume persistence.
- [x] persistent desired state and automatic restoration after a panel/VPS restart;
- [x] lifecycle/resource manager for definitions, retained volumes, legacy adoption,
      and explicit cleanup confirmation.

## Community and progression

- [x] achievements and badges;
- [x] daily/weekly missions;
- [x] seasonal ranking;
- [x] map MVP;
- [x] player profiles and name/session history;
- [x] revenge/nemesis system;
- [x] optional original kill-streak sound pack;
- [x] web ranking and per-server history;
- [x] scheduled weekly events with timezone, duration, optional start map, and manual run;
- [x] non-blocking Discord webhooks for important lifecycle, moderation, backup,
      and evidence events;
- [x] `/rules`, expanded `/help`, and community links.

## Evidence and anti-abuse

- [x] HLTV demo lifecycle with persistent evidence storage, download, and audit;
- [x] admin evidence markers for suspicious players;
- [x] automatic demo and log retention;
- [x] SafeNameAndChat validation for nicknames, reserved names, chat flood,
      repeats, and configurable blocked phrases;
- [x] rate limits for moderation endpoints and login attempts;
- [x] NGINX reverse proxy with automatic Let's Encrypt TLS and custom HTTPS port;
- [x] optional IP/VPN allowlist and trusted forward-auth SSO.

## FragZone Server Link

The concept is documented in
[`FRAGZONE-INTEGRATION.md`](FRAGZONE-INTEGRATION.md) and is not part of the
current runtime scope.

- [ ] separate read-only Stats API without Docker socket or RCON;
- [ ] `CS Fleet Telemetry API v1` and capability discovery;
- [ ] dedicated scoped integration tokens;
- [ ] FragZone Web provider and server import;
- [ ] scheduler/cache sync with A2S fallback;
- [ ] public leaderboards, profiles, seasons, and achievements;
- [ ] privacy/retention controls and SSRF protection;
- [ ] signed webhooks as a later phase.

## ReHLDS migration track

This is a separate experimental image, not an immediate stable-image replacement:

- [x] opt-in ReHLDS engine with one-command rollback to Valve HLDS;
- [x] ReGameDLL_CS;
- [x] Metamod-R;
- [x] ReAPI;
- [x] pinned compatibility matrix, build smoke test, and runtime module test;
- [x] native ReSemiclip for ReHLDS with a pinned checksum and Valve-only Pawn fallback;
- [x] repeatable benchmark/compatibility evidence tooling and staged migration runbook;
- [ ] security/performance benchmark under real player load;
- [ ] compatibility matrix for external signature/Orpheu plugins;
- [ ] staged production migration of Classic, followed by GunGame.

Instructions: [`REHLDS.md`](REHLDS.md).

## Operator UX

- [x] interactive Steam ID discovery through the `status` command;
- [x] an AMXX access flag `a`–`u` reference in the administrator editor;
- [x] a warning for non-persistent `STEAM_ID_LAN`/`VALVE_ID_LAN` values;
- [x] complete Bulgarian and English copy.

## Product principles

- compile plugins from source during build;
- give each feature an `.env` switch or safe default;
- keep separate Classic and GunGame map pools and defaults;
- allowlist and validate control-plane operations;
- keep the Docker-socket panel loopback/VPN-only;
- require a clear target and verification for destructive fleet operations.
