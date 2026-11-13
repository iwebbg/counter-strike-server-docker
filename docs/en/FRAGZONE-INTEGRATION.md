# Concept: FragZone Server Link

[Български](../FRAGZONE-INTEGRATION.md) | [English](FRAGZONE-INTEGRATION.md)

> Status: future concept. The current version has no public Stats API, webhook
> integration, or runtime dependency between the two projects.

`FragZone Server Link` is an optional connection between this Docker fleet and
`counter-strike-web-laravel`. Its purpose is to let FragZone Web discover
servers created by CS Control and display richer statistics than the standard
Valve A2S protocol provides.

Both projects must remain fully independent:

- CS Docker works without FragZone Web and retains its own Control Panel;
- FragZone Web works without CS Docker through its existing A2S requests and snapshots;
- when connected, the website can receive leaderboards, player profiles,
  seasons, achievements, and map activity;
- temporary downtime of either project must not stop the other one.

## Why A2S is not enough

FragZone Web can already retrieve online status, current map, player count,
ping, and limited information about connected players. A2S does not expose a
persistent Steam ID identity or the historical MariaDB data collected by the
fleet.

The Docker platform can additionally provide:

- kills, deaths, K/D, headshots, damage, and playtime;
- name and session history;
- GunGame level and wins;
- all-time and seasonal rankings;
- achievements;
- popular maps and activity;
- a stable `server_id` that does not change with the host port.

## Recommended architecture

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

Use a separate `stats-api` container instead of exposing the CS Control Panel.
The Stats API must not receive the Docker socket, RCON credentials, or
control-plane permissions. It should use a read-only MariaDB account and a
dedicated integration token.

A direct Laravel-to-fleet-MariaDB connection is possible when both systems
have the same owner and share a private network, but it is not the recommended
public contract. It couples the website to the internal schema and makes
independent upgrades harder.

## Proposed API contract

The API should be versioned and read-only:

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

Capability discovery example:

```json
{
  "provider": "FragZone Docker Servers",
  "api_version": "1.0",
  "instance_id": "community-sofia-1",
  "capabilities": ["servers", "leaderboard", "player_profiles", "maps", "seasons", "achievements"]
}
```

The generic contract can be named `CS Fleet Telemetry API v1`, with
`FragZone Docker Servers` as a provider implementation. This also allows other
community websites to use the same open protocol.

## FragZone Web experience

When adding a server, the administrator selects a telemetry source:

```text
Standard A2S
FragZone Docker Servers
```

For a Docker integration:

1. Select a previously configured integration.
2. Load `/api/v1/servers`.
3. Choose a server from the returned list.
4. Fill name, address, port, mode, and slots automatically.
5. Store the stable Docker `SERVER_ID` as `external_server_id`.
6. Optionally show a `Powered by FragZone Docker Servers` badge.
7. Enable detailed statistics separately for each server.

An integrated server page can expose:

```text
Overview | Players | Ranking | Maps | Achievements | Seasons
```

## Proposed web models

### `server_integrations`

- provider and API version;
- base URL;
- encrypted integration token;
- capabilities;
- connection status;
- last successful sync and last error.

### Additions to `game_servers`

- `telemetry_driver`;
- `server_integration_id`;
- `external_server_id`;
- `detailed_stats_enabled`;
- `last_detailed_sync_at`.

IP and port must not be the only identity because they can change during a
Docker recreate or migration.

## Sync and caching strategy

Public Laravel requests should not wait directly for the fleet API. A
scheduler fetches and caches the data, while the website keeps displaying the
last successful sync during a temporary outage.

Suggested intervals:

- A2S live status: every minute;
- fleet summary: every 1–5 minutes;
- leaderboard: every 5 minutes;
- player profile: on demand with a short cache;
- seasons and achievements: every 10–15 minutes.

Docker MariaDB remains the authoritative source for gameplay statistics.
FragZone Web stores cache/read models for fast public pages and offline
tolerance.

## Security and privacy

- never use an OAuth session token as an integration token;
- the public API receives no Docker socket, RCON, or write operations;
- tokens are scoped, encrypted at rest, and rotatable;
- production transport uses HTTPS, rate limits, and response-size limits;
- prefer an IP allowlist or private network where possible;
- URL validation in FragZone Web must prevent SSRF, redirects, and private or
  reserved addresses unless explicitly trusted for an internal deployment;
- the API never returns RCON/database credentials, admins, container IDs,
  internal IP addresses, ban evidence, or a complete moderation audit;
- name/session history and Steam ID profiles require a privacy policy,
  retention rules, and a way to exclude them from public display.

## Future webhooks

After the read-only MVP, signed events could include:

```text
server.created
server.started
server.stopped
server.map_changed
player.achievement_unlocked
season.started
```

Webhook delivery needs an HMAC signature, timestamp, idempotency event ID,
retries, and a durable outbox. Moderation and remote server control are not
part of the first integration and require a separate permission model.

## Proposed phases

### Phase 1 — read-only MVP

- separate Stats API container;
- capability discovery and dedicated token;
- Docker server import into FragZone Web;
- summary, leaderboard, and server filters;
- Laravel scheduler/cache and A2S fallback.

### Phase 2 — community profiles

- player profiles and name/session history;
- seasons, achievements, and map analytics;
- privacy and retention controls;
- integration health in the admin panel.

### Phase 3 — events

- signed webhooks and durable delivery;
- automatic server discovery/update;
- Discord/activity integrations;
- separate evaluation of scoped administrative actions.

## Open decisions before implementation

- public HTTPS API or private Docker/VPN network;
- player fields that are public by default;
- cache in the Laravel database, Redis, or a combined read model;
- multi-tenant token and server scoping;
- retention period for sessions, aliases, and raw activity;
- ownership verification when adding a third-party fleet;
- API versioning and backward-compatibility policy.
