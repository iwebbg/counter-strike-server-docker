# CS Control Panel

[Български](WEB-PANEL.md) | [English](en/WEB-PANEL.md)

CS Control е опционален уеб контролен панел за управление на много Counter-Strike 1.6
containers. Той е в Compose profile `panel`; без този profile проектът продължава
да работи като обикновена едносървърна Compose конфигурация.

Frontend-ът е Next.js App Router приложение с отделни страници **Табло**,
**Сървъри**, **Оператори** и **Журнал**. Local overlay стартира `next dev` с
bind mounts и hot reload. External и production режимите използват multi-stage
standalone build без source mounts.

Интерфейсът поддържа English и Български от dropdown-а в горната навигация.
Изборът се пази локално в browser-а. Stats dashboard-ът използва responsive
подредба: full-width leaderboard, равен ред за карти/сесии/постижения и общ ред
за bans/moderation.

## Стартиране и спиране

Генерирайте силен token и го поставете в `.env`:

```bash
./docker/compose setup panel
./docker/compose up -d --build
```

Default локалният URL е `http://127.0.0.1:8080` и не използва SSL. При
production deployment NGINX се активира изрично с `./docker/compose publish`,
издава Let’s Encrypt сертификат за избрания domain и proxy-ва към вътрешния
Next.js service `panel-web:3000`, а `/api/*` заявките — към `panel:8080`. Вижте
[`HTTPS-PROXY.md`](HTTPS-PROXY.md).

При local deployment `panel-web` използва `next dev`. Директориите `app/`,
`components/`, `i18n/`, `lib/` и `public/` са bind-mounted, затова промяната на
frontend файл се появява автоматично в браузъра чрез Fast Refresh:

```bash
./docker/compose up -d --build
./docker/compose logs -f panel-web
```

При промяна на `package.json`, Dockerfile или Next.js конфигурацията направете
нов build. Production и external deployment не mount-ват source code: те
използват минималния Next.js standalone runtime и предварително изградените
static assets.

За existing reverse proxy може да се избере external overlay без host ports:

```bash
./docker/compose external server1_net cs16-panel
./docker/compose up -d --build
```

Спиране само на UI/control-plane слоя:

```bash
./docker/compose stop panel panel-web panel-proxy
```

Вече създадените game containers продължават да работят. Стартирайте панела
отново, за да ги управлявате.

## Функции

- live fleet overview с running/stopped/health състояние;
- A2S заявка за текуща карта и player count;
- създаване на `classic` или `gungame` сървър;
- max players между 2 и GoldSrc лимита 32;
- автоматично намиране на свободен порт в конфигуриран диапазон;
- ръчно зададен порт с проверка за Docker конфликт;
- start, stop, restart и live log viewer;
- Edit wizard за име, режим, max players, порт, пароли и map rotation;
- RCON password generation и еднократно показване след create;
- optional full-admin Steam IDs още при създаването;
- live AMXX admin editor с роли, custom flags и презареждане без рестарт;
- checklist за map rotation при създаване и live map manager за работещ сървър;
- Live Players с score/ping/time, kick и Steam-ID ban;
- отделни named volumes за logs и AMXX data;
- persistent desired-state декларации и автоматично възстановяване на липсващи
  panel-managed containers след host/stack restart;
- responsive интерфейс за desktop и телефон.
- MariaDB analytics dashboard с all-time/season/server filters;
- leaderboard, player profiles, name history, map activity и achievements;
- active fleet/server bans, revoke и moderation audit;
- fleet-wide admin list и създаване на нов active season.
- panel operator роли, API permissions и неизменяем audit log на действията.

Primary Compose сървърът се вижда в панела, но не може да бъде изтрит от него.
Само containers, създадени от панела, могат да бъдат премахнати. Remove запазва
named volumes, така че данните остават възстановими.

## Редакция на сървър

Бутонът **Edit** е наличен само за инстанции, създадени от панела. Wizard-ът
позволява промяна на име, Classic/GunGame режим, max players, host port, start
map, rotation и пароли. Празно password поле запазва текущата стойност; server
password може да бъде премахната с отделната отметка. Съществуващите пароли не
се връщат към браузъра.

При **Save & recreate** панелът създава проверен replacement container, спира
работещия сървър, пресъздава го и го стартира отново в предишното му състояние.
Същите named volumes за AMXX data и logs се монтират отново, затова админи,
банове, статистика, persistent mapcycle и логове се запазват. Смяната на режим
обновява и persistent mapcycle с карти само от новата категория. При грешка
преди замяната оригиналният container се стартира отново; след премахването му
панелът прави автоматичен rollback от запазената конфигурация.

Compose-managed primary server умишлено няма **Edit**: неговата конфигурация
остава собственост на Compose/`.env` и се променя чрез recreate на stack-а.

## Update на server image

Панелът сравнява immutable image ID на всяка panel-managed инстанция с текущия
ID на `SERVER_IMAGE`. След нов build/pull картата показва **Update available** и
бутон **Update**. Операцията създава replacement с новия image, запазва
environment, port, network и всички named volumes, след което възстановява
предишното running/stopped състояние. При неуспех се прави rollback към стария
image. Картата показва кратките current/target image IDs и постоянен **Up to
date** или **Update available** badge. Потвърждението предупреждава с реалния
брой свързани играчи.

Когато повече от една инстанция е остаряла, **Update all** ги обработва
последователно. Всяка има собствен rollback; проблем в една инстанция не спира
останалите и резултатът показва успешните и неуспешните имена. Compose-managed
primary server се обновява чрез Compose, не от панела.

## Backup и Restore

**Backups** е наличен за panel-managed инстанции. Всеки versioned
`.cs16-backup.tar.gz` съдържа manifest с image/configuration, AMXX data volume и
custom map resources. Logs и пълен MariaDB dump са опционални. Архивите се пазят
с mode `0600` в отделния persistent `panel_backups` volume и могат да бъдат
изтеглени или изтрити от history списъка. Те съдържат server/RCON пароли и трябва
да се съхраняват като секрети.

Restore приема само backup със същия `SERVER_ID`, проверява version, allowlisted
outer paths, nested Docker TAR paths и SHA-256 checksums. Преди промяна винаги
създава автоматичен safety backup, спира сървъра, заменя избраните volumes,
възстановява environment настройките върху текущия game image и връща предишното
running/stopped състояние. Database restore е отделно потвърждение: временно
спира всички контролирани game servers и може да възстанови по-стари operator
акаунти и пароли. При такъв restore може да е необходим нов login.

Backup на host ниво:

```bash
docker run --rm -v cs16_panel_backups:/source -v "$PWD":/backup \
  alpine tar -czf /backup/cs16-panel-backups.tar.gz -C /source .
```

За всяка инстанция може да се зададе автоматична policy с интервал, брой
локални scheduled архиви, logs и MariaDB. Scheduler-ът прилага retention само
върху scheduled архивите и не изтрива manual/safety backup-и. Опционалният
off-host destination приема проверен `PUT` upload и SHA-256 header чрез
`BACKUP_REMOTE_URL` и `BACKUP_REMOTE_TOKEN`.

## Operator роли и permissions

Панелът прилага permissions на API ниво и адаптира интерфейса към текущата
роля. Скриването на бутон в браузъра не е защитният механизъм — всяка защитена
заявка се проверява от backend-а.

| Роля        | Достъп                                                                   |
| ----------- | ------------------------------------------------------------------------ |
| `viewer`    | Сървъри, логове, играчи и статистика само за преглед                     |
| `moderator` | Viewer плюс kick/ban, revoke и управление/смяна на карти                 |
| `admin`     | Moderator плюс lifecycle, configuration, AMXX admins, backup и audit log |
| `owner`     | Admin плюс създаване, промяна, password reset и изтриване на оператори   |
| `custom`    | Само изрично избраните permissions и, по желание, избрани сървъри        |

Първият bootstrap акаунт е `owner`. Migration-ът повишава старите `admin` и
`operator` акаунти до `owner`, за да не бъде загубен достъпът. Само Owner вижда
**Operators**. Не може да премахне или ограничи собствения си акаунт, нито да
изтрие/понижи последния активен Owner. Промяна на role/status или password
прекратява съществуващите сесии на засегнатия оператор.

При създаване или редакция Owner може да избере отделни API permissions и да
ограничи оператора до конкретни panel-managed сървъри. Server scope-ът се
проверява от backend-а и филтрира списъка със сървъри; опит за достъп до друга
инстанция връща `SERVER_SCOPE_DENIED`. Owner permissions не могат да бъдат
ограничавани по този начин.

## Resources и lifecycle recovery

Меню **Resources** е достъпно за Owner/Admin и събира на едно място Docker
containers, `panel_server_definitions`, `cs_servers` и точните
`cs16_<server-id>_data|logs` volumes. То различава:

- управляван сървър — container и definition са налични;
- възстановим сървър — definition съществува, но container липсва;
- legacy ресурс — има registry metadata и persistent volumes, но няма definition;
- orphaned volumes или остарял registry запис.

**Restore definition** изпълнява idempotent reconcile и връща предишния desired
state (`running`, `paused` или `stopped`). **Adopt volumes** създава нова
panel-managed definition със същия `SERVER_ID`, така че AMXX data и custom maps
остават на място. Cleanup никога не използва wildcard: backend-ът отказва
операцията при активен container/definition и трие само показаните точни volume
имена след изрично потвърждение.

## Audit log

**Audit log** е достъпен за Admin и Owner и има филтри по operator, server,
action, result и период. MariaDB пази login/logout, permission denial и всички
mutation действия върху сървъри, карти, играчи, AMXX admins, backup-и, сезони и
operator акаунти. Всеки запис съдържа actor snapshot, request ID, IP, target,
status и timestamp. При изтриване на оператор audit историята остава чрез
snapshot полетата.

При зададен `DISCORD_WEBHOOK_URL` важните lifecycle, moderation, backup и
evidence действия изпращат кратко non-blocking Discord известие. Неуспешен или
бавен webhook не прекъсва основната операция и payload-ът не допуска mentions.

## HLTV evidence

Табът **Evidence** позволява на Moderator, Admin и Owner да стартират и спрат
отделен HLTV sidecar, свързан към избрания game server. Demo файлът се премества
в persistent logs volume, показва се в history и може да бъде изтеглен през
permission-checked API. Start/stop действията влизат в audit log и по желание в
Discord.

**Add marker** свързва подозрителен Steam ID, player name и причина с текущия
запис или със съществуващ demo файл. При активен запис панелът пази и точната
секунда. Marker-ът съдържа operator snapshot, влиза в audit log и защитава demo
файла от автоматично изтриване.

Празен сървър може да не произведе `.dem`, докато няма реални gameplay frames.
Readiness timeout-ът се настройва с `EVIDENCE_READY_TIMEOUT_MS`, а максималният
размер за download — с `EVIDENCE_MAX_BYTES` (по подразбиране 512 MiB). Evidence
файловете оцеляват след recreate/update, защото използват същия logs volume.

## Управление на администратори

При работещ сървър натиснете **Admins** в неговата карта. Можете да добавяте и
премахвате Steam ID записи, да изберете Full admin, Moderator, Maps & votes или
собствени AMXX flags. **Save & reload** записва настройката в persistent AMXX
data volume и изпълнява `amx_reloadadmins` през RCON, така че промяната влиза в
сила веднага и оцелява след restart/recreate.

Формата съдържа линк към интерактивни инструкции за откриване на Steam ID чрез
`status`, както и двуезичен справочник за AMXX флаговете `a`–`u`. Стойности
като `STEAM_ID_LAN` не са постоянни и не се приемат за администраторски достъп.

**Reset to .env** премахва panel override-а и възстановява `AMXX_ADMINS` от
конфигурацията на container-а. Сървърът трябва да е стартиран, за да може AMXX
да презареди достъпа.

**Use as fleet admin list** записва списъка в MariaDB, прилага го live към
всички работещи инстанции и го наследява при създаване или стартиране на
сървър. Тази опция изисква database override-а.

## Управление на карти

При създаване на сървър секцията **Map rotation** определя кои карти могат да се
избират от mapcycle и map vote. Start map се избира само измежду маркираните
карти.

При работещ сървър бутонът **Maps** показва инсталираните `.bsp` карти за режима.
Checkbox-ите определят бъдещия rotation, а **Save rotation** записва избора в
persistent AMXX data volume, синхронизира `mapcycle.txt` и AMXX `maps.ini`, след
което custom build-ът на `mapsmenu.amxx` прочита файла при всяко отваряне на
`amx_mapmenu`/`amx_votemapmenu`. `mapchooser.amxx` го прочита при следващата
карта. Така admin менюто, map vote и автоматичният rotation използват един и същ
филтриран списък. Търсачката и Select all/Clear улесняват по-големи колекции.
**Play now** изпълнява проверен `changelevel` през RCON и сменя картата веднага
след потвърждение.

Списъкът е ограничен според `SERVER_MODE`: GunGame показва само картите от
`configs/maps/gungame.txt` (пакетите в `gungame_maps/`), а Classic показва само
официалния и custom Classic rotation от `configs/maps/classic.txt`. Backend-ът
налага същото правило и не позволява карта от друга категория чрез API.

### Управление на custom map packages

**Map packages** приема `.zip` архив с `maps/*.bsp|res|txt|nav`,
`models/*.mdl`, `sound/*.wav|mp3`, `sprites/*.spr|txt`, `gfx/*.tga|bmp` и root
`.wad` файлове. Поддържат се външна директория и вложена `cstrike/` структура.
Категорията се разпознава автоматично или се задава ръчно. Лимитът е 128 файла
и 32 MiB разархивирано съдържание.

ZIP parser-ът работи в паметта и проверява central directory, CRC, encryption,
compression method, path traversal, symbolic links, duplicate paths,
compression ratio и размери. След това пакетът се инсталира пробно в чист
временен container от текущия game image. Успешните ресурси, category list и
package manifest се пазят в AMXX data volume под `custom_maps/`, затова оцеляват
след Edit, Update, Backup/Restore и recreate.

Екранът показва всички управлявани пакети и предлага **Replace** и **Delete**.
Replace запазва package ID и почиства отпадналите ресурси. Delete е забранен,
ако карта от пакета е в активната rotation или се играе в момента. Legacy
ресурси без manifest се показват като unmanaged и не се изтриват автоматично.
Server image трябва първо да бъде обновен до текущата версия.

## Настройки

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

Setup командата генерира липсващите admin и Redis пароли. Login системата
използва MariaDB-backed access/refresh sessions, HttpOnly SameSite cookie и
Redis session cache; sign out revoke-ва активните token-и.

`PANEL_ALLOWED_IPS` е comma-separated allowlist от точни client IP адреси и е
подходящ за VPN/reverse-proxy boundary. При `SSO_ENABLED=1` trusted proxy може да
извика `POST /api/v1/users/sso`, като подаде email в конфигурирания header и
`X-CS-SSO-Secret`. Backend-ът допуска само вече съществуващ active operator и
издава стандартната HttpOnly session. Proxy-то задължително трябва да премахва
същите headers от външните client заявки и да ги добавя самостоятелно.

## Live Players и moderation

Бутонът **Players** показва nickname, Steam ID, score, ping и connect time чрез
валидирана GoldSource RCON `status` заявка. Kick използва numeric userid, а Ban
валидира Steam ID, продължителност, scope и безопасна причина. При включена
MariaDB ban-ът се записва като fleet-wide или server-scoped central ban и може
да се revoke-не от dashboard-а. Без MariaDB се използва `banned.cfg` fallback.
Всяко действие се добавя и като JSON line в `panel_moderation.log`.

Duration `0` означава permanent ban. Database collector-ът проверява активните
банове при Steam authorization и отчита expiry/revoke без рестарт.

Game image-ът включва SafeNameAndChat защита. Тя нормализира control/color
символи в nickname, пази reserved имена като `console`, `server` и `admin` за
реални администратори и блокира chat flood, еднакви повторения и configurable
фрази. Настройките са `SAFE_NAME_ENABLED`, `SAFE_CHAT_ENABLED`,
`CHAT_SPAM_LIMIT`, `CHAT_SPAM_WINDOW`, `CHAT_BLOCK_SECONDS`, `FORBIDDEN_NAMES` и
`FORBIDDEN_CHAT`.

## Statistics dashboard

С `docker/compose.database.yaml` панелът показва database status, all-time или seasonal
ranking и филтър по server. Таблиците включват K/D, headshots, playtime,
GunGame wins, popular maps, sessions, achievements и moderation audit. Click
върху ranking ред отваря player profile. **+ Season** приключва текущия активен
сезон и стартира нов, без да изтрива all-time statistics.

## Community събития

Страницата **Събития** позволява на Admin/Owner да създава седмичен график за
game nights. Всяко събитие избира server, локален ден и час, IANA timezone,
продължителност и optional начална карта. Scheduler-ът стартира инстанцията,
сменя картата след готовност и я спира в края на прозореца. **Стартирай сега**
използва същия workflow, а create/edit/delete/run действията се записват в audit
log. Автоматизацията може да бъде спряна чрез
`COMMUNITY_EVENT_SCHEDULER_ENABLED=0`.

## Security boundary

Control panel container-ът има write достъп до Docker socket, което по същество
е root-equivalent право върху Docker host-а. Затова:

- bind адресът по подразбиране е само loopback;
- няма default token и слаб token се отказва;
- API управлява само containers с `com.cs16.controlled=true`;
- Compose-managed сървър не може да се изтрие през UI;
- UI няма функция за произволни images, mounts или shell commands;
- препоръчва се SSH/VPN, а не `PANEL_BIND_IP=0.0.0.0`;
- публично публикуване изисква отделен reverse proxy с TLS и допълнителна identity
  система;
- login и moderation заявките имат отделни configurable rate limits;
- remote deployment може допълнително да изисква IP/VPN allowlist или trusted
  forward-auth SSO.

## API

Панелът използва малък allowlisted Docker Engine API client през Unix socket.
Няма generic Docker proxy endpoint. Основните routes са:

- `GET /api/servers`;
- `POST /api/servers`;
- `POST /api/servers/:id/start|stop|restart`;
- `GET /api/servers/:id/logs`;
- `GET|PUT|DELETE /api/servers/:id/admins`;
- `GET|PUT /api/servers/:id/maps`;
- `POST /api/servers/:id/maps/change`;
- `GET /api/servers/:id/players`;
- `POST /api/servers/:id/players/:userid/kick|ban`;
- `GET /api/servers/:id/evidence`;
- `POST /api/servers/:id/evidence/start|stop`;
- `GET /api/servers/:id/evidence/:filename`;
- `GET|POST /api/servers/:id/evidence/markers`;
- `DELETE /api/servers/:id/evidence/markers/:markerId`;
- `GET /api/database/status`;
- `GET /api/stats/overview` и `GET /api/stats/players/:steamId`;
- `GET /api/bans` и `POST /api/bans/:id/revoke`;
- `GET /api/moderation/history`;
- `POST /api/seasons`;
- `GET|POST /api/community-events`;
- `PUT|DELETE /api/community-events/:id` и `POST /api/community-events/:id/run`;
- `DELETE /api/servers/:id` само за panel-managed stopped containers.

Health endpoint-ът `GET /api/health` е единственият route без token.
