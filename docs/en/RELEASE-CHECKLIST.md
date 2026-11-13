# Release checklist

[Български](../RELEASE-CHECKLIST.md) | [English](RELEASE-CHECKLIST.md)

This checklist is the release gate for a public tag. Mark items only against the
exact commit that will be published.

## 1. Clean repository

- [ ] `git status --short` is empty;
- [ ] `.env` secrets, backup archives, demos, and runtime logs are not staged;
- [ ] BG/EN documentation and example environment values are synchronized;
- [ ] release notes document migrations, incompatibilities, and rollback.

## 2. Static checks

- [ ] `npm run format:check`;
- [ ] `npm test` in `backend/cs-control-service`;
- [ ] `npm run build` in `frontend/cs-control`;
- [ ] `bash -n docker/compose docker/*.sh docker/entrypoint.sh` for applicable scripts;
- [ ] `./docker/compose config` validates the selected configuration.

## 3. Isolated integration gate

- [ ] `npm run test:e2e` in the backend passes in the separate `cs16-e2e` project;
- [ ] the lifecycle matrix covers running/stopped/paused desired state and a
      physically removed container;
- [ ] create/edit/update/rollback preserve `SERVER_ID`, ports, network, and volumes;
- [ ] admins/maps/players/backups/evidence endpoints work with all four roles;
- [ ] temporary E2E containers, networks, and volumes are removed.

## 4. Runtime smoke

- [ ] Classic and GunGame reach `healthy` and answer A2S;
- [ ] AMXX/Metamod modules, SQL stats, and map rotation load without errors;
- [ ] MariaDB migrations are idempotent; Redis session refresh and sign-out work;
- [ ] panel and Docker/VPS restarts restore only desired `running` and `paused`
      servers; stopped servers remain stopped;
- [ ] the Resources screen lists retained volumes and cleanup rejects active resources.

## 5. Proxy and production

- [ ] local and production NGINX routing to Next.js/API is verified;
- [ ] production domain, HTTPS port, certificate path, and renewal are verified;
- [ ] panel/API/MariaDB/Redis are not exposed directly;
- [ ] login/moderation rate limits and allowlist/VPN/SSO settings are verified;
- [ ] a backup and restore rehearsal is complete before migration.

## 6. Release

- [ ] image tags are immutable and current image IDs are recorded;
- [ ] database and volume backups exist outside the Docker host;
- [ ] rollback commands are verified;
- [ ] the tag/release is created only after the gates above pass;
- [ ] post-deploy checks cover health, logs, A2S, login, and one test server.

Do not record “real-player benchmark passed” unless the test was performed with
real player load. ReHLDS performance results are tracked separately as described
in [`REHLDS.md`](REHLDS.md).
