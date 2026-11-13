# Architecture

[Български](../ARCHITECTURE.md) | [English](ARCHITECTURE.md)

```text
Internet -> host UDP/TCP port -> CS 1.6 container (HLDS)
                                  |-- Metamod
                                  |-- AMX Mod X
                                  |-- classic OR docker_gungame.amxx
                                  `-- docker_sql_stats.amxx (optional)
                                             |
                                      internal Docker network
                                             |
                                         MariaDB

Browser -> NGINX -> CS Control API/UI -> Docker Engine Unix socket
                         |                 |-- controlled game containers
                         |                 `-- per-server named volumes
                         |-- Redis sessions
                         `-- MariaDB identity, fleet data, and audit
```

The optional CS Control Panel is enabled through the Compose profile. It uses
an allowlisted Docker Engine API client through the local Unix socket, discovers
only project-controlled containers, and performs A2S UDP queries for live game
status. Dynamically created servers join the configured project network and get
separate log and AMXX data volumes.

One game image is shared by every server. Its entrypoint validates environment
values, generates `server.cfg`, selects the AMXX plugin list, installs persistent
custom resources, synchronizes the mapcycle, and starts HLDS. Classic and
GunGame therefore do not require separate images.

MariaDB is a Compose override and is not required by a game-server-only stack.
It is required by panel identity/session data and enables shared game data. The
SQL collector is added to `plugins.ini` only when `DB_ENABLED=1`, so a game
server can remain completely standalone.

Redis stores short-lived panel session cache data. MariaDB remains the source of
truth for users, OAuth-style tokens, roles, and audit events.

Named volumes contain mutable data only:

- AMXX data, local CSStats, managed admins, mapcycle, and custom map packages;
- game logs;
- MariaDB and Redis state;
- panel backup archives and production certificates.

Game binaries and plugins remain inside immutable images. This keeps new
instances reproducible and prevents an old volume from hiding upgraded code.

## Map package boundary

ZIP packages are parsed in memory. The parser checks the central directory,
CRC, encryption, compression methods, symlinks, paths, duplicate names,
compression ratio, and extracted size. Normalized resources are validated in a
temporary container created from the active game image before they are written
to the target AMXX data volume. Persistent manifests provide ownership for
replace and delete operations.

## Versions and updates

Dependency versions are build arguments in `Dockerfile`. After changing them,
build and smoke-test the image:

```bash
./docker/compose build --no-cache server
./docker/compose up -d
./docker/compose logs -f server
```

Steam App 90 sometimes needs a repeated update. The Dockerfile makes up to
three attempts and fails the build when `cstrike/liblist.gam` is missing.

Panel-managed game containers track immutable image IDs. The panel can replace
an outdated container while preserving its environment, network, ports, and
volumes, and can roll back to the previous image when recreation fails.
