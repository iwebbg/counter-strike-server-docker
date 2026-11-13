# Project status и handoff

[Български](PROJECT-STATUS.md) | [English](en/PROJECT-STATUS.md)

Последна актуализация: 13 ноември 2026 г.

Този документ описва реализираното до момента и служи като отправна точка за
следваща работна сесия. Потребителският quick start остава в
[`README.md`](../README.md), а подробностите за dashboard-а са в
[`WEB-PANEL.md`](WEB-PANEL.md).

## Цел на проекта

Един възпроизводим Docker image за Counter-Strike 1.6, от който лесно се
стартират Classic и GunGame сървъри. Проектът трябва да работи както само с
Docker Compose, така и с опционален интерактивен CS Control Panel за управление
на множество изолирани инстанции и автоматично разпределяне на портове.

## Реализирано

### Game image и Compose

- Debian-based HLDS image, инсталиран чрез SteamCMD App 90 `steam_legacy`;
- Metamod `1.21.1-am` и AMX Mod X `1.9.0.5303`;
- непривилегирован `hlds` потребител, `tini`, healthcheck и graceful stop;
- един image с runtime избор `SERVER_MODE=classic|gungame`;
- настройки през `.env`: име, порт, слотове, начална карта, mapcycle, пароли,
  регион, LAN режим, welcome message и GunGame double jump;
- configurable AMXX scroll/HUD branding вместо стандартната AMX Mod X реклама;
- persistent volumes за AMXX data и logs;
- отделен Compose override за опционална MariaDB без публичен database port;
- структуриран Express/Knex backend с REST descriptors, AJV validation,
  Swagger, MariaDB migrations, OAuth-style operator login и Redis session cache;
- deployment и capacity planning guide с минимални изисквания, препоръчани VPS
  профили, базови idle измервания и bandwidth формула.

### Карти и режими

- интегрирани custom пакети от `classic_maps/` и `gungame_maps/`;
- installer, който нормализира вложени `cstrike/` структури, копира resources и
  пропуска `.ztmp` cache файлове;
- ZIP package lifecycle с in-memory parser, CRC/path/zip-bomb validation,
  persistent manifests, replace и safe delete извън active rotation/current map;
- отделни mapcycle списъци за Classic и GunGame;
- автоматична build-time проверка, че всяка конфигурирана карта има `.bsp`;
- активни стандартни AMXX admin/menu/map vote/statistics plugins и в двата режима.

### Custom AMXX plugins

- `docker_gungame.sma` — 21 weapon levels, kills per level, respawn и knife финал;
- `docker_double_jump.sma` — втори скок във въздуха с configurable velocity;
- `docker_welcome.sma` — welcome и кратка помощ за chat командите;
- `docker_sql_stats.sma` — threaded MariaDB fleet collector за players, names,
  sessions, combat/playtime/map statistics, GunGame progress, seasons,
  achievements и database ban enforcement;
- автоматично компилиране на всички `addons/scripting/docker_*.sma` при build;
- `/rank`, `/stats`, `/statsme`, `/top15` и `/level` според активните plugins.
- `docker_gameplay.sma` — warmup, spawn protection, semiclip и AFK manager;
- `docker_killstreak.sma` — First Blood, multi-kill и no-death streak HUD/sound
  announcements с отделни runtime switches;
- `docker_mapvote.sma` — RTV, nominations, map listing и recent-map protection;
- `docker_community.sma` — K:D-aware team balance, one-sided round scramble,
  gag/mute, radio flood protection, `/rules` и разширено `/help`;
- `docker_sql_stats.sma` — допълнително daily/weekly missions, map MVP и
  revenge/nemesis progression;
- deterministic StatsX defaults за `/stats`, `/statsme`, `/rankstats`, `/rank`
  и `/top15` в Classic и GunGame;

### AMXX администрация

- Steam ID базирани администратори чрез `AMXX_ADMINS`;
- `amxmodmenu`, kick, ban, slap/slay, map menu и map vote;
- live editor в панела с Full admin, Moderator, Maps & votes и custom flags;
- строг backend validation, максимум 32 уникални Steam ID записа и забранен `z`;
- запис в persistent `panel_admins.txt` и генериране на `users.ini`;
- live `amx_reloadadmins` през GoldSource RCON без рестарт;
- `Reset to .env`, който премахва override-а и връща container конфигурацията;
- entrypoint-ът предпочита persistent panel override след бъдещ restart/recreate.

### CS Control Panel

- opt-in Compose profile `panel`, bind-нат по подразбиране само към `127.0.0.1`;
- MariaDB-backed администраторски login с access/refresh tokens, HttpOnly cookie и
  Redis session cache;
- Next.js 16 App Router frontend с TypeScript, sidebar routes и responsive mobile drawer;
- local development container с hot reload и production standalone build;
- A2S UDP status за карта, players и max players;
- create на Classic/GunGame инстанция, max players, start map и server password;
- автоматичен свободен host port или ръчно избран порт;
- автоматично генерирана и еднократно показана RCON парола;
- start, stop, restart, live logs и remove за спрени panel-managed containers;
- Edit wizard с controlled recreate за име, режим, max players, port, passwords,
  start map и rotation, който запазва същите logs/data volumes;
- постоянни `SERVER_ID` URL/API адреси, които оцеляват след recreate, image
  update и restore, с backward compatibility за стари container-ID връзки;
- per-server gameplay editor за welcome message, warmup, spawn protection,
  semiclip, GunGame double jump, AFK, RTV и killstreak HUD/звуци;
- current/target image ID, Up to date/Update available badges, player-aware
  confirmation и sequential Update all с per-server rollback;
- map rotation checklist при create и live map manager с search/select all;
- validated custom map folder upload с persistent resources и mode categories;
- versioned Backup/Restore center за AMXX data, custom maps, optional logs и
  MariaDB dump, със SHA-256 validation и automatic safety backup;
- reusable templates, safe JSON import/export, Clone server, configuration
  history/diff/rollback и health-aware recreate с RCON rotation;
- allowlisted network, CPU и memory limits и read-only Compose assistant;
- automatic backup policies с retention и optional off-host `PUT` destination;
- persistent mapcycle override и проверен `changelevel` чрез RCON;
- синхронизиран AMXX `maps.ini` и custom `mapsmenu.amxx`, който презарежда
  списъка при всяко отваряне на admin/vote менюто;
- отделни logs/data volumes и labels за всяка динамична инстанция;
- Compose-managed primary server се вижда и управлява, но не може да бъде изтрит;
- allowlisted Docker Engine API client без generic Docker proxy или arbitrary exec;
- fixed container commands единствено за синхронизиране на admin файловете.
- Live Players, validated kick/ban, persistent `banned.cfg` и moderation audit.
- MariaDB dashboard с leaderboard, player profiles, map/session activity,
  achievements, seasonal filters, active bans/revoke и moderation history;
- fleet-wide admin lists и автоматично inheritance за нови/стартирани servers;
- HLTV evidence sidecars с persistent demo history, download, suspicious-player
  markers и automatic retention, която защитава маркираните demos;
- Discord operational notifications, login/moderation rate limits, IP/VPN
  allowlist и optional trusted forward-auth SSO;
- backend-managed idempotent Knex migrations и legacy stats import.

## Архитектура накратко

```text
Browser -> NGINX -> Next.js panel-web :3000
              `-> CS API panel :8080 -> Docker socket -> labeled containers
                                      `-> A2S / GoldSource RCON

Internet -> host game port -> HLDS -> Metamod -> AMX Mod X -> active mode
                                                       |
                                              MariaDB (optional)
```

Панелът и game server-ите са независими. Спиране на панела не спира вече
създадените инстанции. Панелът има root-equivalent достъп чрез Docker socket и
затова не трябва да се публикува директно в интернет.

## Използвани skills и техники

### Codex skill package

- `sites:sites` беше използван за принципите и структурата на интерактивния
  dashboard. Реализацията остана локална в repository-то, защото hosted Site не
  може безопасно да управлява локалния Docker Unix socket.
- Не са използвани image generation, Pages или външни app/plugin интеграции.

### Технически умения

- Dockerfile, Docker Compose profiles/overrides, volumes, healthchecks и labels;
- AMX Mod X/Pawn plugin разработка и build-time compilation;
- Express 5 HTTP service с автоматично route discovery и централизирани errors;
- Docker Engine API през Unix socket с ограничени операции;
- GoldSource A2S и challenge-based RCON върху UDP;
- Next.js App Router, React, strict TypeScript, Tailwind, Radix UI и Lucide;
- AJV input validation, OAuth-style login, Redis cache и container hardening;
- Node test runner, shell syntax checks и реални Docker smoke tests.

## Проверено до момента

- `bash -n docker/entrypoint.sh`;
- Next.js TypeScript typecheck и production standalone build;
- `npm --prefix backend/cs-control-service test` — route discovery, AJV, i18n,
  A2S, RCON, Docker stream и domain validation tests;
- успешен build на `cs16-server:local` и `cs16-control-panel:local`;
- Compose server и panel са наблюдавани в `healthy` състояние;
- реална A2S заявка връща карта и player slots;
- реален live admin save/reset връща `[AMXX] Loaded 1 admin from file`;
- реален map smoke test открива installed maps, запазва rotation и сменя карта
  чрез RCON върху изолирана временна инстанция;
- изолиран NGINX smoke test потвърждава разделянето към API и Next.js; local и
  production използват отделни Compose overlays и NGINX конфигурации;
- external overlay публикува NGINX само чрез alias в existing Docker network,
  без host port и без директно излагане на вътрешните services;
- Control Panel има EN/BG i18n provider с persistent browser
  избор и преработена responsive analytics grid подредба;
- Owner/Admin/Moderator/Viewer permission matrix се прилага на API и UI ниво;
- operator management и audit log екрани с филтри по actor, server, action,
  result и период; role/password промени прекратяват активните сесии;
- panel audit записва login/logout, denied requests и всички mutation actions с
  request ID, IP, target и snapshot на оператора;
- panel auth е проверен с валиден и невалиден token;
- динамично създадена тестова инстанция е проверена и премахната след smoke test.

## Важни ограничения

- Docker socket е силно привилегирован; вграденият NGINX добавя TLS, но за
  публичен remote достъп все още се препоръчват силна администраторска парола и
  включване на наличните rate limits, IP/VPN allowlist или trusted SSO;
- admin editor работи само при стартиран server, защото трябва да изпълни live
  RCON reload;
- вече съществуващ container трябва еднократно да бъде recreate-нат с новия
  server image, за да използва persistent admin override още от entrypoint;
- Remove запазва volumes по дизайн; автоматичен lifecycle/cleanup UI още няма;
- hardcoded default network `cs16_default` трябва да се конфигурира при различно
  Compose project name;
- HLTV не създава demo frames на празен server без реална gameplay активност;

## Следващи логични задачи

1. SafeNameAndChat validation и по-фини custom operator permissions.
2. Scheduled community events, например Friday Night GunGame.
3. ReHLDS/ReGameDLL experimental image и compatibility matrix.
4. FragZone telemetry integration като отделен бъдещ track.
5. UX помощ за откриване на Steam ID и показване на AMXX flag descriptions.

## Продължаване в следваща сесия

```bash
git status
./docker/compose ps
npm --prefix panel test
./docker/compose up -d --build
```

Преди тест на destructive операции трябва да се различават primary,
panel-managed и временни test containers. Не се изтриват volumes или реални
инстанции без изрично решение.
