# CS Control Panel

[Български](../WEB-PANEL.md) | [English](WEB-PANEL.md)

CS Control is an optional web control panel for managing multiple
Counter-Strike 1.6 containers. It belongs to the `panel` Compose profile. The
project remains a regular single-server Compose setup when that profile is off.

The frontend is a Next.js App Router application with separate **Dashboard**,
**Servers**, **Operators**, and **Audit log** pages. The local overlay runs
`next dev` with bind mounts and hot reload. External and production modes use a
multi-stage standalone build without source mounts.

The interface supports English and Bulgarian from the top navigation dropdown
and stores the selection in the browser. The analytics dashboard uses a
responsive layout for desktop and mobile.

## Start and stop

Prepare the panel and start the stack:

```bash
./docker/compose setup panel
./docker/compose up -d --build
```

The default local URL is `http://127.0.0.1:8080` without SSL. Production NGINX
is enabled explicitly with `./docker/compose publish`; it obtains a Let's
Encrypt certificate, proxies the interface to `panel-web:3000`, and sends
`/api/*` requests to `panel:8080`. See [`HTTPS-PROXY.md`](HTTPS-PROXY.md).

In local deployment, `panel-web` runs `next dev`. The `app/`, `components/`,
`i18n/`, `lib/`, and `public/` paths are bind-mounted, so frontend edits appear
in the browser automatically through Fast Refresh:

```bash
./docker/compose up -d --build
./docker/compose logs -f panel-web
```

Rebuild after changing `package.json`, a Dockerfile, or the Next.js
configuration. Production and external deployments do not mount source code;
they run the minimal Next.js standalone runtime with prebuilt static assets.

To use an existing reverse proxy without host ports:

```bash
./docker/compose external server1_net cs16-panel
./docker/compose up -d --build
```

Stop only the UI/control plane with:

```bash
./docker/compose stop panel panel-web panel-proxy
```

Created game containers keep running and become manageable again when the
panel starts.

## Features

- live fleet overview with running, stopped, and health state;
- A2S current map, players, and slot count;
- Classic or GunGame instance creation;
- 2–32 max players;
- automatic free-port selection or validated manual port;
- start, stop, restart, live logs, and safe removal;
- Edit wizard for name, mode, slots, port, passwords, start map, and rotation;
- generated RCON password displayed only once after creation;
- optional full-admin Steam IDs during creation;
- live AMXX admin editor with roles, custom flags, and no-restart reload;
- mode-specific rotation checklist and live map manager;
- managed ZIP map package upload, replacement, and guarded deletion;
- Live Players with score, ping, connection time, kick, and Steam-ID ban;
- separate named data and log volumes;
- MariaDB analytics, leaderboards, profiles, maps, sessions, and achievements;
- active fleet/server bans, revoke, and moderation history;
- fleet-wide admin inheritance and season management;
- operator roles, API permissions, and immutable action audit;
- EN/BG responsive interface.

The primary Compose server appears in the panel but cannot be deleted there.
Only panel-created containers can be removed. Remove preserves their named
volumes so data remains recoverable.

## Edit a server

**Edit** is available only for panel-created instances. The wizard changes the
name, mode, max players, host port, start map, rotation, and passwords. An empty
password input preserves the current value; server password removal uses a
separate checkbox. Existing secrets are never returned to the browser.

**Save & recreate** prepares a validated replacement, stops the running server,
recreates it, and restores its previous running/stopped state. The same AMXX
data and log volumes are mounted again, preserving admins, bans, statistics,
mapcycle, and logs. A mode change writes a rotation containing only maps from
the new category. Failures before replacement restart the original; failures
after removal trigger automatic rollback from the saved configuration.

The Compose-managed primary server intentionally has no Edit action. Compose
and `.env` remain its source of truth.

## Update the server image

The panel compares each managed instance's immutable image ID with the current
`SERVER_IMAGE` ID. After build/pull, the card shows **Update available** and an
**Update** button. Update preserves environment, port, network, and named
volumes and restores the prior state. A failed update rolls back to the old
image. Cards show short current/target IDs and a permanent **Up to date** or
**Update available** badge. Confirmation includes the actual connected-player
count.

When multiple instances are outdated, **Update all** processes them
sequentially. Each server has an independent rollback and failures do not stop
the remaining updates. The primary server is updated through Compose instead.

## Backup and Restore

**Backups** is available for managed instances. Each versioned
`.cs16-backup.tar.gz` contains a manifest, image/configuration, AMXX data, and
custom map resources. Logs and a full MariaDB dump are optional. Archives use
mode `0600` in the persistent `panel_backups` volume and can be downloaded or
deleted from history. They contain server/RCON secrets and must be treated as
credentials.

Restore accepts a backup for the same `SERVER_ID`, validates the version,
allowlisted paths, nested Docker TAR paths, and SHA-256 checksums. It creates a
safety backup first, stops the server, restores selected volumes, applies the
saved environment to the current game image, and returns the previous state.
Database restore is separately confirmed, temporarily stops controlled game
servers, and can restore older operator accounts and passwords. A new login may
be required afterward.

Host-level backup example:

```bash
docker run --rm -v cs16_panel_backups:/source -v "$PWD":/backup \
  alpine tar -czf /backup/cs16-panel-backups.tar.gz -C /source .
```

Each instance can define an automatic policy with an interval, retained local
scheduled archives, logs, and MariaDB options. Retention affects scheduled
archives only and never deletes manual or safety backups. The optional off-host
destination accepts a validated `PUT` upload with an SHA-256 header through
`BACKUP_REMOTE_URL` and `BACKUP_REMOTE_TOKEN`.

## Operator roles and permissions

Permissions are enforced by the API; hidden browser buttons are not the
security boundary.

| Role        | Access                                                                  |
| ----------- | ----------------------------------------------------------------------- |
| `viewer`    | Read-only servers, logs, players, and statistics                        |
| `moderator` | Viewer plus kick/ban, revoke, and map management/change                 |
| `admin`     | Moderator plus lifecycle, configuration, AMXX admins, backup, and audit |
| `owner`     | Admin plus create/edit/reset/delete operators                           |

The first bootstrap account is an Owner. Only Owners see **Operators**. An
Owner cannot restrict or remove their own account or demote/delete the final
active Owner. Role, status, and password changes revoke the affected user's
active sessions.

## Audit log

**Audit log** is available to Admin and Owner, with operator, server, action,
result, and time filters. MariaDB stores login/logout, permission denial, and
mutations involving servers, maps, players, AMXX admins, backups, seasons, and
operators. Entries include actor snapshot, request ID, IP, target, status, and
timestamp. Deleting an operator does not erase their historical actor snapshot.

When `DISCORD_WEBHOOK_URL` is configured, important lifecycle, moderation,
backup, and evidence actions send a short non-blocking Discord notification. A
slow or failed webhook never interrupts the primary operation, and payloads do
not allow mentions.

## HLTV evidence

The **Evidence** tab lets Moderators, Admins, and Owners start and stop a
dedicated HLTV sidecar connected to the selected game server. The demo is moved
to the persistent logs volume, appears in history, and can be downloaded through
a permission-checked API. Start/stop actions enter the audit log and optionally
Discord.

**Add marker** associates a suspicious Steam ID, player name, and reason with
the active recording or an existing demo. For an active recording, the panel
also stores the exact offset. A marker includes an operator snapshot, enters the
audit log, and protects its demo from automatic deletion.

An empty server may produce no `.dem` until real gameplay frames exist. Configure
the readiness timeout with `EVIDENCE_READY_TIMEOUT_MS` and the maximum download
size with `EVIDENCE_MAX_BYTES` (512 MiB by default). Evidence survives
recreate/update because it uses the same logs volume.

## AMXX administrators

On a running server, select **Admins**. Add or remove Steam IDs and choose Full
admin, Moderator, Maps & votes, or custom AMXX flags. **Save & reload** writes
to the persistent data volume and invokes `amx_reloadadmins` over RCON, so the
change is immediate and survives restart/recreate.

**Reset to .env** removes the panel override and restores `AMXX_ADMINS` from
the container configuration. The server must be running for live reload.

**Use as fleet admin list** saves the list in MariaDB, applies it to all running
instances, and inherits it when servers are created or started. It requires the
database overlay.

## Map management

During server creation, **Map rotation** selects maps available to mapcycle and
map vote. The start map must be among the selected maps.

On a running server, **Maps** shows installed `.bsp` files for its mode.
Checkboxes define the future rotation. **Save rotation** persists the selection
and synchronizes `mapcycle.txt` and AMXX `maps.ini`; the custom `mapsmenu.amxx`
reloads it whenever `amx_mapmenu` or `amx_votemapmenu` opens. `mapchooser.amxx`
uses it on the next map. **Play now** sends a validated RCON `changelevel` after
confirmation.

The pool is constrained by `SERVER_MODE`: GunGame uses only
`configs/maps/gungame.txt`, while Classic uses `configs/maps/classic.txt`.
Backend validation enforces the same boundary.

### Custom map packages

**Map packages** accepts a `.zip` containing:

- `maps/*.bsp|res|txt|nav`;
- `models/*.mdl`;
- `sound/*.wav|mp3`;
- `sprites/*.spr|txt`;
- `gfx/*.tga|bmp`;
- root `.wad` files.

Both an outer folder and nested `cstrike/` layout are supported. Mode is
detected automatically or selected manually. A package is limited to 128 files
and 32 MiB of uncompressed data.

The in-memory parser validates the central directory, CRC, encryption,
compression method, traversal paths, symbolic links, duplicate paths,
compression ratio, and sizes. It then trial-installs resources in a clean
temporary container based on the current game image. Successful resources,
category file, and package manifest are stored under `custom_maps/` in the
AMXX data volume and therefore survive Edit, Update, Backup/Restore, and
recreate.

The package list offers **Replace** and **Delete**. Replace keeps the package ID
and removes stale resources. Delete is blocked when a package map is currently
playing or belongs to the active rotation. Legacy resources without a manifest
are listed as unmanaged and are never deleted automatically. Update the server
to the current game image before using this workflow.

## Settings

```dotenv
PANEL_ADMIN_NAME=Administrator
PANEL_ADMIN_EMAIL=admin@example.com
PANEL_ADMIN_PASSWORD=change-admin-password
REDIS_PASSWORD=change-redis-password
PANEL_BIND_IP=127.0.0.1
PANEL_PORT=8080
PORT_RANGE_START=27015
PORT_RANGE_END=27115
CS16_DEPLOYMENT=local
PANEL_DOMAIN=panel.example.com
PANEL_SSL_EMAIL=
PANEL_HTTP_PORT=80
PANEL_HTTPS_PORT=443
PANEL_EXTERNAL_NETWORK=server1_net
PANEL_EXTERNAL_ALIAS=cs16-panel
BACKUP_SCHEDULER_ENABLED=1
BACKUP_SCHEDULER_INTERVAL_MS=60000
BACKUP_REMOTE_URL=
BACKUP_REMOTE_TOKEN=
DISCORD_WEBHOOK_URL=
DISCORD_WEBHOOK_TIMEOUT_MS=3000
LOGIN_RATE_LIMIT_WINDOW_MS=900000
LOGIN_RATE_LIMIT_MAX=10
MODERATION_RATE_LIMIT_WINDOW_MS=60000
MODERATION_RATE_LIMIT_MAX=30
PANEL_ALLOWED_IPS=
SSO_ENABLED=0
SSO_SHARED_SECRET=
SSO_EMAIL_HEADER=x-auth-request-email
EVIDENCE_READY_TIMEOUT_MS=20000
EVIDENCE_MAX_BYTES=536870912
EVIDENCE_RETENTION_ENABLED=1
EVIDENCE_RETENTION_INTERVAL_MS=21600000
EVIDENCE_RETENTION_DAYS=30
EVIDENCE_RETENTION_COUNT=50
SERVER_LOG_RETENTION_DAYS=30
```

The setup command generates missing admin and Redis passwords. Login uses
MariaDB-backed access/refresh sessions, an HttpOnly SameSite cookie, and Redis
session cache. Sign out revokes active tokens.

`PANEL_ALLOWED_IPS` is a comma-separated allowlist of exact client IP addresses
and is suitable for a VPN/reverse-proxy boundary. With `SSO_ENABLED=1`, a trusted
proxy can call `POST /api/v1/users/sso`, supplying the email in the configured
header and `X-CS-SSO-Secret`. The backend accepts existing active operators only
and issues the normal HttpOnly session. The proxy must strip these headers from
external client requests and inject them itself.

## Live Players and moderation

**Players** obtains nickname, Steam ID, score, ping, and connection time from a
validated GoldSource RCON `status` call. Kick uses numeric userid. Ban validates
Steam ID, duration, scope, and a safe reason. With MariaDB, it creates a central
fleet-wide or server-scoped ban that can be revoked from the dashboard. Without
MariaDB it falls back to `banned.cfg`. Actions are also appended to
`panel_moderation.log` as JSON lines.

Duration `0` means permanent. The collector checks active bans during Steam
authorization and applies expiration/revocation without restart.

The game image includes SafeNameAndChat protection. It normalizes control/color
characters in nicknames, reserves names such as `console`, `server`, and `admin`
for actual administrators, and blocks chat floods, identical repeats, and
configurable phrases. Settings are `SAFE_NAME_ENABLED`, `SAFE_CHAT_ENABLED`,
`CHAT_SPAM_LIMIT`, `CHAT_SPAM_WINDOW`, `CHAT_BLOCK_SECONDS`, `FORBIDDEN_NAMES`,
and `FORBIDDEN_CHAT`.

## Statistics dashboard

With `docker/compose.database.yaml`, the panel displays database state,
all-time or seasonal ranking, and a server filter. Views include K/D,
headshots, playtime, GunGame wins, popular maps, sessions, achievements, and
moderation audit. Selecting a ranking row opens the player profile. **+ Season**
closes the current season and starts another without deleting all-time data.

## Security boundary

The panel container has write access to the Docker socket, which is effectively
root access to the Docker host. Therefore:

- default binding is loopback-only;
- weak/default credentials are rejected;
- the API manages only containers labeled `com.cs16.controlled=true`;
- the Compose primary server cannot be removed from the UI;
- the UI cannot specify arbitrary images, mounts, or shell commands;
- prefer SSH/VPN over `PANEL_BIND_IP=0.0.0.0`;
- public access requires TLS and an additional identity/security layer;
- login and moderation requests have separate configurable rate limits;
- remote deployments may additionally require an IP/VPN allowlist or trusted
  forward-auth SSO.

## API

The backend uses a small allowlisted Docker Engine API client over the Unix
socket, not a generic Docker proxy. Important routes include:

- `GET|POST /api/servers`;
- `POST /api/servers/:id/start|stop|restart|update`;
- `GET /api/servers/:id/logs|players`;
- `GET|PUT|DELETE /api/servers/:id/admins`;
- `GET|PUT /api/servers/:id/maps`;
- `POST /api/servers/:id/maps/change`;
- `GET /api/servers/:id/map-packages`;
- `POST /api/servers/:id/map-packages/zip`;
- `DELETE /api/servers/:id/map-packages/:packageId`;
- `POST /api/servers/:id/players/:userid/kick|ban`;
- `GET /api/servers/:id/evidence`;
- `POST /api/servers/:id/evidence/start|stop`;
- `GET /api/servers/:id/evidence/:filename`;
- `GET|POST /api/servers/:id/evidence/markers`;
- `DELETE /api/servers/:id/evidence/markers/:markerId`;
- `GET /api/database/status`;
- `GET /api/stats/overview` and `GET /api/stats/players/:steamId`;
- `GET /api/bans` and `POST /api/bans/:id/revoke`;
- `GET /api/moderation/history`;
- `POST /api/seasons`;
- `DELETE /api/servers/:id` for stopped panel-managed containers only.

`GET /api/health` is the only route that requires no authenticated session.
