# Product roadmap

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
- [x] MariaDB fleet schema, automatic migrations и legacy stats import;
- [x] detailed player/map/session/GunGame statistics и name history;
- [x] web leaderboard, player profiles, achievements и seasonal ranking;
- [x] fleet/server bans, revoke и database moderation audit;
- [x] fleet-wide admins с inheritance за нови/стартирани сървъри;
- [x] persistent server registry и database connection monitoring.

## Следващ пакет

- [ ] по-интелигентен team balancer по размер и score/K:D;
- [ ] configurable scramble след поредица едностранни Classic рундове;
- [ ] gag/mute система за chat, voice и radio spam;
- [x] ban history/unban UI с причина, срок и администратор;
- [x] MariaDB-backed moderation history за fleet-wide bans;
- [ ] server edit/migrate workflow със запазване на volumes;
- [ ] map package uploader с validation и rebuild workflow;
- [ ] backup/restore/export на AMXX data, logs и database;
- [ ] audit log екран и отделни panel operator роли.

## Community и progression

- [x] achievements и badges;
- [ ] daily/weekly missions;
- [x] seasonal ranking;
- [ ] MVP на карта;
- [x] player profile и name/session history;
- [ ] revenge/nemesis система;
- [ ] optional kill-streak announcements без прекомерни sounds;
- [x] web ranking и per-server history;
- [ ] scheduled events, например Friday Night GunGame;
- [ ] Discord webhook за server state, bans, crashes и events;
- [ ] `/rules`, разширено `/help` и community links.

## Evidence и anti-abuse

- [ ] HLTV/server demo lifecycle;
- [ ] admin evidence markers за подозрителен играч;
- [ ] автоматична retention политика за demos и logs;
- [ ] SafeNameAndChat или еквивалентна validation защита;
- [ ] rate limits за moderation endpoints и login attempts;
- [ ] reverse proxy пример с HTTPS, VPN/SSO и trusted proxy настройки.

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
