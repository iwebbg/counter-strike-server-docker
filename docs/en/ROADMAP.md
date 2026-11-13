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

- [ ] smarter team balancing by size and score/K:D;
- [ ] configurable scramble after one-sided Classic rounds;
- [ ] chat, voice, and radio-spam gag/mute system;
- [x] ban history/unban UI with reason, duration, and administrator;
- [x] MariaDB-backed fleet moderation history;
- [x] controlled server edit/recreate preserving volumes;
- [x] version-aware image update, rollback, and fleet Update all;
- [x] extracted-folder map upload with validation;
- [x] ZIP upload, auto category, persistent manifests, replace, and safe delete;
- [x] versioned AMXX/log/MariaDB backup, download, and restore;
- [ ] scheduled retention and off-host backup destinations;
- [x] audit UI, API permission matrix, and Owner/Admin/Moderator/Viewer roles;
- [ ] optional external identity provider and finer custom permissions.

## Server configuration track

- [x] stable `SERVER_ID` in panel URLs and APIs with container-ID backward compatibility;
- [x] allowlisted per-server gameplay settings for welcome, warmup, spawn
      protection, semiclip, double jump, AFK, RTV, and killstreak announcements;
- [ ] reusable configuration templates, safe JSON import/export, and Clone server;
- [ ] versioned configuration history, visual diff, and operator-attributed rollback;
- [ ] health-aware recreate progress with player warning and visible rollback result;
- [ ] RCON rotation with one-time display of the new value;
- [ ] read-only Compose configuration assistant and `.env` change preview;
- [ ] allowlisted network, CPU, and memory limits for panel-managed instances;
- [ ] integration tests for stable ID, recreate, update, restore, and volume persistence.

## Community and progression

- [x] achievements and badges;
- [ ] daily/weekly missions;
- [x] seasonal ranking;
- [ ] map MVP;
- [x] player profiles and name/session history;
- [ ] revenge/nemesis system;
- [x] optional original kill-streak sound pack;
- [x] web ranking and per-server history;
- [ ] scheduled events such as Friday Night GunGame;
- [ ] Discord webhooks for state, bans, crashes, and events;
- [ ] `/rules`, expanded `/help`, and community links.

## Evidence and anti-abuse

- [ ] HLTV/server demo lifecycle;
- [ ] admin evidence markers for suspicious players;
- [ ] automatic demo and log retention;
- [ ] SafeNameAndChat or equivalent validation;
- [ ] rate limits for moderation endpoints and login attempts;
- [x] NGINX reverse proxy with automatic Let's Encrypt TLS and custom HTTPS port;
- [ ] VPN/SSO, identity provider, and trusted-proxy hardening.

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

- [ ] ReHLDS engine;
- [ ] ReGameDLL_CS;
- [ ] Metamod-R;
- [ ] ReAPI;
- [ ] ReSemiclip instead of the Pawn fallback;
- [ ] security/performance comparison and rollback test;
- [ ] compatibility matrix for every custom plugin;
- [ ] staged migration of Classic, followed by GunGame.

## Product principles

- compile plugins from source during build;
- give each feature an `.env` switch or safe default;
- keep separate Classic and GunGame map pools and defaults;
- allowlist and validate control-plane operations;
- keep the Docker-socket panel loopback/VPN-only;
- require a clear target and verification for destructive fleet operations.
