# Project status и handoff

Последна актуализация: 12 ноември 2026 г.

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
- responsive fleet dashboard за desktop и mobile;
- A2S UDP status за карта, players и max players;
- create на Classic/GunGame инстанция, max players, start map и server password;
- автоматичен свободен host port или ръчно избран порт;
- автоматично генерирана и еднократно показана RCON парола;
- start, stop, restart, live logs и remove за спрени panel-managed containers;
- Edit wizard с controlled recreate за име, режим, max players, port, passwords,
  start map и rotation, който запазва същите logs/data volumes;
- image ID detection и Update action с controlled migration и rollback за
  panel-managed servers;
- map rotation checklist при create и live map manager с search/select all;
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
- backend-managed idempotent Knex migrations, 15-table schema и legacy stats import.

## Архитектура накратко

```text
Browser -> CS Control :8080 -> Docker Unix socket -> labeled CS containers
                 |                                  |
                 `------ A2S / GoldSource RCON -----'

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
- vanilla HTML/CSS/JavaScript responsive UI;
- AJV input validation, OAuth-style login, Redis cache и container hardening;
- Node test runner, shell syntax checks и реални Docker smoke tests.

## Проверено до момента

- `bash -n docker/entrypoint.sh`;
- `node --check` за backend framework модулите и `panel/public/app.js`;
- `npm --prefix backend/cs-control-service test` — route discovery, AJV, i18n,
  A2S, RCON, Docker stream и domain validation tests;
- успешен build на `cs16-server:local` и `cs16-control-panel:local`;
- Compose server и panel са наблюдавани в `healthy` състояние;
- реална A2S заявка връща карта и player slots;
- реален live admin save/reset връща `[AMXX] Loaded 1 admin from file`;
- реален map smoke test открива installed maps, запазва rotation и сменя карта
  чрез RCON върху изолирана временна инстанция;
- изолиран NGINX smoke test потвърждава proxy към `panel:8080`; local и
  production използват отделни Compose overlays и NGINX конфигурации;
- external overlay публикува NGINX само чрез alias в existing Docker network,
  без host port и без директно излагане на `panel:8080`;
- Control Panel има dependency-free EN/BG i18n dropdown с persistent browser
  избор и преработена responsive analytics grid подредба;
- panel auth е проверен с валиден и невалиден token;
- динамично създадена тестова инстанция е проверена и премахната след smoke test.

## Важни ограничения

- Docker socket е силно привилегирован; вграденият NGINX добавя TLS, но за
  публичен remote достъп все още се препоръчват силна администраторска парола,
  rate limiting и VPN/identity защита;
- admin editor работи само при стартиран server, защото трябва да изпълни live
  RCON reload;
- вече съществуващ container трябва еднократно да бъде recreate-нат с новия
  server image, за да използва persistent admin override още от entrypoint;
- Remove запазва volumes по дизайн; автоматичен lifecycle/cleanup UI още няма;
- MariaDB статистиката има dashboard в панела; остават допълнителни audit и
  operator-management екрани;
- няма backup/restore, map uploader или audit log;
- hardcoded default network `cs16_default` трябва да се конфигурира при различно
  Compose project name.

## Следващи логични задачи

1. Map uploader и безопасен workflow за добавяне/премахване на map packages.
2. Разширен operator/audit dashboard върху MariaDB.
3. Backup/restore/export на AMXX data, logs и database.
4. Audit log за panel действия и отделни panel operator роли.
5. Identity provider/VPN hardening пред вече наличния HTTPS reverse proxy.
6. Integration tests/CI за build, container boot, A2S, RCON и admin persistence.
7. UX помощ за откриване на Steam ID и показване на AMXX flag descriptions.

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
