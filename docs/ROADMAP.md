# Product roadmap

[Български](ROADMAP.md) | [English](en/ROADMAP.md)

Този файл събира договорените идеи за развитие на CS 1.6 платформата. Статусите
са ориентир за следващите сесии, а не обещание за конкретна дата.

## Реализиран recommended gameplay pack

- [x] Warmup с countdown, respawn и блокирана GunGame progression;
- [x] GunGame spawn protection, която приключва при стрелба;
- [x] teammate semiclip/anti-block;
- [x] AFK warning, преместване в Spectator и kick;
- [x] `/rtv`, `/nominate map`, `/maps` и recent-map protection;
- [x] mode-specific map pools и persistent rotation;
- [x] Live Players в Control Panel;
- [x] kick и Steam-ID ban от панела;
- [x] persistent `banned.cfg` и moderation audit log;
- [x] deterministic StatsX public commands;
- [x] live AMXX admins и категоризиран map manager.
- [x] optional First Blood, multi-kill и kill-streak HUD/sound announcements;
- [x] MariaDB fleet schema, automatic migrations и legacy stats import;
- [x] detailed player/map/session/GunGame statistics и name history;
- [x] web leaderboard, player profiles, achievements и seasonal ranking;
- [x] fleet/server bans, revoke и database moderation audit;
- [x] fleet-wide admins с inheritance за нови/стартирани сървъри;
- [x] persistent server registry и database connection monitoring.

## Следващ пакет

- [x] по-интелигентен team balancer по размер и score/K:D;
- [x] configurable scramble след поредица едностранни Classic рундове;
- [x] gag/mute система за chat, voice и radio spam;
- [x] ban history/unban UI с причина, срок и администратор;
- [x] MariaDB-backed moderation history за fleet-wide bans;
- [x] server edit workflow с controlled recreate и запазване на volumes;
- [x] image update/migrate workflow със version detection, rollback и запазване на volumes;
- [x] image build IDs, Up to date status, player-aware warning и fleet Update all;
- [x] extracted map package uploader с validation и persistent per-server resources;
- [x] ZIP upload, auto category, persistent manifests, replace и safe package delete;
- [x] versioned backup/download/restore на AMXX data, logs и MariaDB със safety backup;
- [x] scheduled retention и off-host backup destinations;
- [x] audit log екран, API permission matrix и Owner/Admin/Moderator/Viewer роли;
- [x] optional trusted forward-auth SSO за съществуващи operator акаунти;
- [ ] по-фини custom permissions извън вградените роли.

## Server configuration track

- [x] постоянен `SERVER_ID` в panel URL и API с backward compatibility за container ID;
- [x] allowlisted per-server gameplay настройки за welcome, warmup, spawn
      protection, semiclip, double jump, AFK, RTV и killstreak известия;
- [x] reusable configuration templates, безопасен JSON import/export и Clone server;
- [x] versioned configuration history, visual diff и operator-attributed rollback;
- [x] health-aware recreate progress с player warning и видим rollback result;
- [x] RCON rotation с еднократно показване на новата стойност;
- [x] read-only Compose configuration assistant и `.env` change preview;
- [x] allowlisted network, CPU и memory limits за panel-managed instances;
- [x] integration tests за stable ID, recreate, update, restore и volume persistence.

## Community и progression

- [x] achievements и badges;
- [x] daily/weekly missions;
- [x] seasonal ranking;
- [x] MVP на карта;
- [x] player profile и name/session history;
- [x] revenge/nemesis система;
- [x] optional kill-streak announcements с малък оригинален sound pack;
- [x] web ranking и per-server history;
- [ ] scheduled events, например Friday Night GunGame;
- [x] non-blocking Discord webhook за важни lifecycle, moderation, backup и
      evidence събития;
- [x] `/rules`, разширено `/help` и community links.

## Evidence и anti-abuse

- [x] HLTV demo lifecycle с persistent evidence volume, download и audit;
- [x] admin evidence markers за подозрителен играч;
- [x] автоматична retention политика за demos и logs;
- [x] SafeNameAndChat validation за nicknames, reserved names, chat flood,
      повторения и configurable забранени фрази;
- [x] rate limits за moderation endpoints и login attempts;
- [x] NGINX reverse proxy с автоматичен self-signed/Let's Encrypt TLS и
      конфигурируем външен HTTPS порт;
- [x] optional IP/VPN allowlist и trusted forward-auth SSO за remote администратори.

## FragZone Server Link

Концепцията е описана в [`FRAGZONE-INTEGRATION.md`](FRAGZONE-INTEGRATION.md) и
не е част от текущия runtime scope.

- [ ] отделен read-only Stats API container без Docker socket и RCON;
- [ ] `CS Fleet Telemetry API v1` contract и capability discovery;
- [ ] dedicated scoped integration tokens;
- [ ] FragZone Web Docker provider и server import;
- [ ] scheduler/cache синхронизация с A2S fallback;
- [ ] публични leaderboard, profiles, seasons и achievements;
- [ ] privacy/retention controls и SSRF защита;
- [ ] подписани webhooks като отделен бъдещ етап.

## ReHLDS migration track

Това е отделен experimental image, не директна подмяна на стабилния HLDS image:

- [ ] ReHLDS engine;
- [ ] ReGameDLL_CS;
- [ ] Metamod-R;
- [ ] ReAPI;
- [ ] ReSemiclip вместо Pawn fallback-а;
- [ ] security/performance comparison и rollback тест;
- [ ] compatibility matrix за всички custom plugins;
- [ ] staged migration на Classic, след това GunGame.

## Product принципи

- plugins се компилират от source при build;
- всяка функция има `.env` switch или безопасен default;
- Classic и GunGame имат отделни map pools и gameplay defaults;
- control-plane операциите са allowlisted и валидирани;
- Docker socket панелът остава loopback/VPN-only;
- destructive fleet операции не се изпълняват без ясна цел и проверка.
