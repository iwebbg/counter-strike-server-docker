# MariaDB fleet data

[Български](DATABASE.md) | [English](en/DATABASE.md)

MariaDB е опционалният централен data layer на проекта. Без нея game server-ът,
локалните AMXX статистики и Control Panel продължават да работят. С нея всички
инстанции в един Compose project споделят ranking, seasons, achievements,
fleet admins, bans и moderation audit.

## Стартиране

Задайте уникални силни стойности в `.env`:

```dotenv
DB_PASSWORD=replace-with-a-long-random-password
DB_ROOT_PASSWORD=replace-with-another-long-random-password
```

Само game server и MariaDB:

```bash
docker compose --project-directory . -f docker/compose.yaml -f docker/compose.database.yaml up -d --build
```

С Control Panel:

```bash
./docker/compose setup full
./docker/compose up -d --build
```

Control backend-ът изчаква MariaDB и преди всеки API старт изпълнява
версионираните idempotent Knex migrations от
[`backend/cs-control-service/src/database/migrations`](../backend/cs-control-service/src/database/migrations).
Първата migration прилага замразения idempotent baseline безопасно и върху
съществуващ `mariadb_data` volume.
Старата таблица `cs_player_stats` автоматично се импортира, когато съществува;
тя не се изтрива.

При database-only инсталация без Control Panel същият baseline се зарежда от
официалния MariaDB entrypoint само при първоначалното създаване на volume-а.

MariaDB няма публикуван host port. Game containers и панелът се свързват през
вътрешната Docker network.

## Какво се записва

| Таблица                        | Данни                                                                   |
| ------------------------------ | ----------------------------------------------------------------------- |
| `cs_servers`                   | Persistent server registry, mode, port, state, map и heartbeat          |
| `cs_players`                   | Steam ID, текущо име, first/last seen и брой връзки                     |
| `cs_player_names`              | История на използваните имена                                           |
| `cs_player_server_stats`       | Kills, deaths, headshots, damage, hits, playtime, rounds и GunGame wins |
| `cs_player_sessions`           | Connect/disconnect история и продължителност                            |
| `cs_map_stats`                 | Played count, rounds, kills и player time по карта                      |
| `cs_gungame_progress`          | Current/highest level и победи                                          |
| `cs_achievements`              | Achievement каталог и thresholds                                        |
| `cs_player_achievements`       | Отключени achievements                                                  |
| `cs_seasons`                   | Сезони, период и active state                                           |
| `cs_season_stats`              | Отделен seasonal ranking                                                |
| `cs_admins`                    | Server-scoped и fleet-wide (`*`) администратори                         |
| `cs_bans`                      | Fleet/server scope, duration, revoke и причина                          |
| `cs_moderation_actions`        | Неизменяем audit на kick, ban и unban действия                          |
| `panel_audit_logs`             | Login, permissions и действия на операторите в контролния панел         |
| `users.custom_permissions`     | Optional JSON permission override за custom оператори                   |
| `panel_operator_server_scopes` | Ограничение на оператор до избрани server IDs                           |
| `panel_community_events`       | Седмичен график, runtime статус и последно изпълнение на събития        |
| `cs_schema_migrations`         | Версия на приложената схема                                             |

RCON, panel и database паролите не се записват в статистическите таблици.

## Collector поведение

`docker_sql_stats.amxx` се включва автоматично само при `DB_ENABLED=1`. Всички
gameplay записи използват threaded SQLX заявки, за да не блокират HLDS game
thread-а. Collector-ът:

- регистрира сървъра и изпраща heartbeat;
- записва Steam ID, имена, sessions и playtime;
- обновява kills, deaths, headshots, damage, hits и rounds;
- записва map activity;
- получава GunGame level/win събития от `docker_gungame.amxx`;
- обновява активния сезон и отключва achievements;
- проверява active fleet/server bans при Steam authorization.

Локалните `/rank`, `/top15`, `/stats` и `/statsme` остават налични чрез CSStats,
дори когато MariaDB временно не е достъпна.

## Control Panel

Dashboard-ът показва:

- database connection state;
- all-time или seasonal leaderboard;
- server filter;
- K/D, headshot rate, playtime и GunGame wins;
- popular maps, recent sessions и achievements;
- player profile и name history;
- active fleet/server bans и revoke;
- moderation audit;
- създаване на нов активен сезон;
- fleet admin list, приложен live към работещите сървъри и наследяван от новите.

При DB-enabled ban MariaDB е source of truth. Играчът се kick-ва веднага, а
collector-ът блокира следващите връзки до изтичане или revoke. Без MariaDB
панелът използва локалния `banned.cfg` fallback.

## Backup

SQL backup към текущата директория:

```bash
docker compose --project-directory . -f docker/compose.yaml -f docker/compose.database.yaml exec -T mariadb \
  sh -lc 'MYSQL_PWD="$MARIADB_PASSWORD" mariadb-dump --user="$MARIADB_USER" "$MARIADB_DATABASE"' \
  > cs16-database.sql
```

Пазете backup-а извън същия VPS. Backup-вайте отделно и AMXX named volumes,
защото те съдържат локалните CSStats данни и server-specific конфигурации.

## Restore

Първо спрете game инстанциите или направете maintenance window. После:

```bash
docker compose --project-directory . -f docker/compose.yaml -f docker/compose.database.yaml exec -T mariadb \
  sh -lc 'MYSQL_PWD="$MARIADB_PASSWORD" mariadb --user="$MARIADB_USER" "$MARIADB_DATABASE"' \
  < cs16-database.sql
```

Приложете отново текущата схема след restore:

```bash
./docker/compose run --rm --no-deps -e DB_MULTIPLE_STATEMENTS=1 panel npm run migrate
```

## Operational бележки

- Не използвайте `./docker/compose down -v`, ако искате да запазите базата.
- Наблюдавайте размера на `mariadb_data` и правете периодични restore тестове.
- Name и session history са лични community данни; публикувайте privacy policy и
  задайте retention правила според юрисдикцията си.
- Fleet ban не е заместител на Steam/VAC и не трябва да се използва за събиране
  на чувствителни данни.
