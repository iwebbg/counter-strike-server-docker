# Концепция: FragZone Server Link

[Български](FRAGZONE-INTEGRATION.md) | [English](en/FRAGZONE-INTEGRATION.md)

> Статус: бъдеща концепция. В текущата версия няма публичен Stats API, webhook
> integration или runtime зависимост между двата проекта.

`FragZone Server Link` е опционална връзка между този Docker fleet проект и
`counter-strike-web-laravel`. Целта е FragZone Web да може да открива сървъри,
създадени от CS Control, и да показва по-подробни статистики от стандартния
Valve A2S протокол.

Двата проекта трябва да останат напълно самостоятелни:

- CS Docker работи без FragZone Web и запазва собствен Control Panel;
- FragZone Web работи без CS Docker чрез текущите A2S заявки и snapshots;
- когато са свързани, сайтът получава leaderboard, player profiles, seasons,
  achievements и map activity;
- временна недостъпност на единия проект не трябва да спира другия.

## Защо A2S не е достатъчен

FragZone Web вече може да извлича online status, текуща карта, player count,
ping и ограничени данни за свързаните играчи. A2S не предоставя постоянна
идентичност чрез Steam ID и не съдържа историческите MariaDB данни от fleet-а.

Docker платформата може допълнително да предостави:

- kills, deaths, K/D, headshots, damage и playtime;
- name и session history;
- GunGame level и победи;
- all-time и seasonal ranking;
- achievements;
- популярни карти и активност;
- стабилен `server_id`, който не се променя при смяна на host port.

## Препоръчана архитектура

```text
CS 1.6 instances
        |
        v
Shared MariaDB
        |
        v
Read-only Stats API
        |
        | HTTPS + dedicated scoped token
        v
FragZone Web scheduler/cache
        |
        +-- public server pages
        +-- rankings and profiles
        `-- A2S fallback
```

Препоръчва се отделен `stats-api` container, а не публично отваряне на CS
Control Panel. Stats API услугата не трябва да има Docker socket, RCON или
control-plane права. Тя трябва да използва read-only MariaDB account и отделен
integration token.

Директна връзка от Laravel към fleet MariaDB е възможна при общ собственик и
private network, но не е препоръчаният публичен contract. Тя свързва сайта към
вътрешната схема и затруднява независимите upgrades.

## Предложен API contract

API-то трябва да е versioned и read-only:

```text
GET /api/v1/info
GET /api/v1/servers
GET /api/v1/servers/{serverId}
GET /api/v1/servers/{serverId}/summary
GET /api/v1/servers/{serverId}/leaderboard
GET /api/v1/servers/{serverId}/maps
GET /api/v1/servers/{serverId}/activity
GET /api/v1/players/{steamId}
GET /api/v1/seasons
```

Capability discovery пример:

```json
{
  "provider": "FragZone Docker Servers",
  "api_version": "1.0",
  "instance_id": "community-sofia-1",
  "capabilities": ["servers", "leaderboard", "player_profiles", "maps", "seasons", "achievements"]
}
```

Contract-ът може да се нарича generic `CS Fleet Telemetry API v1`, а
`FragZone Docker Servers` да бъде provider implementation. Това позволява и
други community сайтове да използват същия open protocol.

## FragZone Web UX

При добавяне на сървър администраторът избира telemetry source:

```text
Standard A2S
FragZone Docker Servers
```

При Docker integration:

1. избира се предварително конфигурирана integration;
2. сайтът зарежда `/api/v1/servers`;
3. администраторът избира сървър от списък;
4. име, адрес, port, mode и slots се попълват автоматично;
5. `external_server_id` пази стабилния Docker `SERVER_ID`;
6. сървърът може да получи badge `Powered by FragZone Docker Servers`;
7. подробните статистики могат да бъдат включвани отделно за всеки сървър.

Страницата на интегриран сървър може да има:

```text
Overview | Players | Ranking | Maps | Achievements | Seasons
```

## Предложени Web модели

### `server_integrations`

- provider и API version;
- base URL;
- encrypted integration token;
- capabilities;
- connection status;
- last successful sync и last error.

### Допълнения към `game_servers`

- `telemetry_driver`;
- `server_integration_id`;
- `external_server_id`;
- `detailed_stats_enabled`;
- `last_detailed_sync_at`.

IP и port не трябва да бъдат единствената идентичност, защото могат да се
сменят при Docker recreate или migration.

## Sync и cache стратегия

Публичните Laravel requests не трябва директно да чакат fleet API. Scheduler-ът
извлича и кешира данните, а сайтът продължава да показва последния успешен sync
при временен проблем.

Примерни интервали:

- A2S live status: всяка минута;
- fleet summary: на 1–5 минути;
- leaderboard: на 5 минути;
- player profile: при поискване с кратък cache;
- seasons и achievements: на 10–15 минути.

Docker MariaDB остава authoritative source за gameplay статистиката. FragZone
Web пази cache/read models за бързи публични страници и offline tolerance.

## Сигурност и privacy

- никога да не се използва OAuth session token като integration token;
- публичният API няма Docker socket, RCON или write операции;
- token-ите са scoped, криптирани at rest и могат да се rotate-ват;
- production transport е HTTPS, с rate limiting и response size limits;
- по възможност се използват IP allowlist или private network;
- URL validation в FragZone Web трябва да блокира SSRF, redirects, private и
  reserved адреси освен изрично trusted internal deployment;
- API-то не връща RCON/database credentials, admins, container IDs, вътрешни IP
  адреси, ban evidence или пълен moderation audit;
- name/session history и Steam ID profiles изискват privacy policy, retention
  правила и възможност да бъдат изключени от публичната визуализация.

## Бъдещи webhooks

След read-only MVP може да има подписани събития:

```text
server.created
server.started
server.stopped
server.map_changed
player.achievement_unlocked
season.started
```

Webhook доставката трябва да използва HMAC signature, timestamp, idempotency
event ID, retries и durable outbox. Moderation и remote server control не са
част от първата интеграция и изискват отделен permission model.

## Предложени фази

### Phase 1 — read-only MVP

- отделен Stats API container;
- capability discovery и dedicated token;
- Docker server import в FragZone Web;
- summary, leaderboard и server filters;
- Laravel scheduler/cache и A2S fallback.

### Phase 2 — community profiles

- player profiles, name/session history;
- seasons, achievements и map analytics;
- privacy и retention controls;
- integration health в admin панела.

### Phase 3 — events

- подписани webhooks и durable delivery;
- automatic server discovery/update;
- Discord/activity integrations;
- отделна оценка за scoped administrative actions.

## Отворени решения преди имплементация

- публичен HTTPS API или private Docker/VPN network;
- кои player полета са публични по подразбиране;
- cache в Laravel database, Redis или комбиниран read model;
- multi-tenant token и server scoping;
- retention период за sessions, aliases и raw activity;
- ownership verification при добавяне на чужд fleet;
- API versioning и backwards-compatibility policy.
