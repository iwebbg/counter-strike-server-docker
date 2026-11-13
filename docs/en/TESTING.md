# Testing

The project has two backend test layers:

- fast unit/contract tests for route discovery, validation, permissions, sessions, RCON, A2S, and archive formats;
- an isolated Docker E2E test using real MariaDB, Redis, the control API, and a temporary CS 1.6 server.

## Fast tests

```bash
npm --prefix backend/cs-control-service test
npm run format:check
```

## Docker E2E

The local game image must exist first:

```bash
./docker/compose build server
```

Then run:

```bash
npm --prefix backend/cs-control-service run test:e2e
```

The test uses the `cs16-e2e` Compose project, web port `18080`, and game ports
`29015–29025`. It verifies login and permissions for the `owner`, `admin`,
`moderator`, and `viewer` roles, plus real server lifecycle, player, log, map,
admin, template/import/export/clone, configuration history and rollback,
resource/network limit, image update/rollback, map-package, backup/restore and
policy, season, moderation, audit-log, HLTV-evidence, and suspicious-player
marker lifecycle operations. The lifecycle matrix physically removes the
temporary game container and restarts the control API to verify exact recovery
of persistent `running`, `stopped`, and `paused` desired states.

On completion, it automatically removes the temporary containers, network, database/backup volumes, and test CS server volumes. The main `cs16` Compose project and its data remain unchanged.

On failure, the runner prints service status and recent logs before cleanup.
