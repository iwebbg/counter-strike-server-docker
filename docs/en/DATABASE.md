# MariaDB fleet data

[Български](../DATABASE.md) | [English](DATABASE.md)

MariaDB is the optional central data layer. A standalone game server and local
AMXX statistics work without it. With it, controlled instances share rankings,
seasons, achievements, admins, bans, moderation history, and server registry
data. Panel authentication also requires MariaDB.

## Starting the database

Set unique strong values in `.env`:

```dotenv
DB_PASSWORD=replace-with-a-long-random-password
DB_ROOT_PASSWORD=replace-with-another-long-random-password
```

Game server and MariaDB only:

```bash
docker compose --project-directory . -f docker/compose.yaml -f docker/compose.database.yaml up -d --build
```

Complete stack:

```bash
./docker/compose setup full
./docker/compose up -d --build
```

Before every API start, the control backend waits for MariaDB and runs the
versioned idempotent Knex migrations from
[`backend/cs-control-service/src/database/migrations`](../../backend/cs-control-service/src/database/migrations).
The baseline can safely initialize an existing volume. Legacy
`cs_player_stats` data is imported when present and is not deleted.

MariaDB has no public host port. Game containers and the panel connect through
the internal Docker network.

## Stored data

| Table                    | Purpose                                                            |
| ------------------------ | ------------------------------------------------------------------ |
| `cs_servers`             | Persistent server registry, mode, port, state, map, heartbeat      |
| `cs_players`             | Steam ID, current name, first/last seen, connection count          |
| `cs_player_names`        | Name history                                                       |
| `cs_player_server_stats` | Kills, deaths, headshots, damage, hits, time, rounds, GunGame wins |
| `cs_player_sessions`     | Connection/disconnection history and duration                      |
| `cs_map_stats`           | Plays, rounds, kills, and player time by map                       |
| `cs_gungame_progress`    | Current/highest level and wins                                     |
| `cs_achievements`        | Achievement catalog and thresholds                                 |
| `cs_player_achievements` | Unlocked achievements                                              |
| `cs_seasons`             | Season periods and active state                                    |
| `cs_season_stats`        | Seasonal rankings                                                  |
| `cs_admins`              | Server-scoped and fleet-wide (`*`) administrators                  |
| `cs_bans`                | Fleet/server scope, duration, revoke state, and reason             |
| `cs_moderation_actions`  | Append-only kick, ban, and unban history                           |
| `panel_audit_logs`       | Panel login, permission, operator, and fleet actions               |
| `users` / `oauth_*`      | Panel identities and access/refresh sessions                       |

RCON, panel, and database passwords are not stored in player-statistics tables.

## Collector behavior

`docker_sql_stats.amxx` is enabled only when `DB_ENABLED=1`. Gameplay writes
use threaded SQLX queries and do not block the HLDS game thread. The collector:

- registers the server and sends heartbeats;
- records Steam IDs, names, sessions, and playtime;
- updates combat and round statistics;
- records map activity and GunGame progress/wins;
- applies active seasons and unlocks achievements;
- checks fleet/server bans during Steam authorization.

Local `/rank`, `/top15`, `/stats`, and `/statsme` remain available through
CSStats during temporary database outages.

## Control Panel

The dashboard provides database state, all-time/seasonal rankings, server
filters, player profiles, name history, map activity, achievements, bans,
moderation history, seasons, and fleet-wide admins. The separate control-plane
audit records login/logout, denied permissions, and every mutation route.

For a DB-backed ban, MariaDB is the source of truth. The player is removed
immediately and the collector blocks later connections until expiry or revoke.
Without MariaDB, moderation falls back to the local `banned.cfg`.

## Backup

The panel's Backup Center can include a full MariaDB dump. For a manual dump:

```bash
docker compose --project-directory . -f docker/compose.yaml -f docker/compose.database.yaml exec -T mariadb \
  sh -lc 'MYSQL_PWD="$MARIADB_PASSWORD" mariadb-dump --user="$MARIADB_USER" "$MARIADB_DATABASE"' \
  > cs16-database.sql
```

Store the dump outside the same VPS and back up AMXX volumes separately.

## Restore

Use a maintenance window and stop game writes first:

```bash
docker compose --project-directory . -f docker/compose.yaml -f docker/compose.database.yaml exec -T mariadb \
  sh -lc 'MYSQL_PWD="$MARIADB_PASSWORD" mariadb --user="$MARIADB_USER" "$MARIADB_DATABASE"' \
  < cs16-database.sql
```

Then reapply the current schema:

```bash
./docker/compose run --rm --no-deps -e DB_MULTIPLE_STATEMENTS=1 panel npm run migrate
```

## Operational notes

- Do not run `./docker/compose down -v` when you need to preserve the database.
- Monitor `mariadb_data`, schedule backups, and test restores.
- Names and session history are community personal data; publish a privacy
  policy and define retention rules for your jurisdiction.
- Fleet bans do not replace Steam/VAC and must not collect sensitive data.
