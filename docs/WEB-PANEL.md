# CS Control Panel

CS Control е opt-in локален dashboard за управление на много Counter-Strike 1.6
containers. Той е в Compose profile `panel`; без този profile проектът продължава
да работи като обикновена едносървърна Compose конфигурация.

## Стартиране и спиране

Генерирайте силен token и го поставете в `.env`:

```bash
openssl rand -hex 24
docker compose --profile panel up -d --build
```

При panel/full stack NGINX предоставя HTTPS на конфигурируемия
`PANEL_HTTPS_PORT` и proxy-ва към вътрешния `panel:8080`. Default локалният URL
е `https://localhost:8443`; директният `http://127.0.0.1:8080` остава само като
diagnostic fallback. Вижте [`HTTPS-PROXY.md`](HTTPS-PROXY.md).

Спиране само на UI/control-plane слоя:

```bash
docker compose --profile panel stop panel
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
- RCON password generation и еднократно показване след create;
- optional full-admin Steam IDs още при създаването;
- live AMXX admin editor с роли, custom flags и презареждане без рестарт;
- checklist за map rotation при създаване и live map manager за работещ сървър;
- Live Players с score/ping/time, kick и Steam-ID ban;
- отделни named volumes за logs и AMXX data;
- responsive интерфейс за desktop и телефон.
- MariaDB analytics dashboard с all-time/season/server filters;
- leaderboard, player profiles, name history, map activity и achievements;
- active fleet/server bans, revoke и moderation audit;
- fleet-wide admin list и създаване на нов active season.

Primary Compose сървърът се вижда в панела, но не може да бъде изтрит от него.
Само containers, създадени от панела, могат да бъдат премахнати. Remove запазва
named volumes, така че данните остават възстановими.

## Управление на администратори

При работещ сървър натиснете **Admins** в неговата карта. Можете да добавяте и
премахвате Steam ID записи, да изберете Full admin, Moderator, Maps & votes или
собствени AMXX flags. **Save & reload** записва настройката в persistent AMXX
data volume и изпълнява `amx_reloadadmins` през RCON, така че промяната влиза в
сила веднага и оцелява след restart/recreate.

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

## Настройки

```dotenv
PANEL_TOKEN=
PANEL_BIND_IP=127.0.0.1
PANEL_PORT=8080
PORT_RANGE_START=27015
PORT_RANGE_END=27115
PANEL_TLS_MODE=selfsigned
PANEL_DOMAIN=localhost
PANEL_HTTP_PORT=80
PANEL_HTTPS_PORT=8443
```

`PANEL_TOKEN` под 16 символа прекратява старта на панела. API заявките използват
Bearer token, пазен от browser-а само в `sessionStorage`.

## Live Players и moderation

Бутонът **Players** показва nickname, Steam ID, score, ping и connect time чрез
валидирана GoldSource RCON `status` заявка. Kick използва numeric userid, а Ban
валидира Steam ID, продължителност, scope и безопасна причина. При включена
MariaDB ban-ът се записва като fleet-wide или server-scoped central ban и може
да се revoke-не от dashboard-а. Без MariaDB се използва `banned.cfg` fallback.
Всяко действие се добавя и като JSON line в `panel_moderation.log`.

Duration `0` означава permanent ban. Database collector-ът проверява активните
банове при Steam authorization и отчита expiry/revoke без рестарт.

## Statistics dashboard

С `compose.database.yaml` панелът показва database status, all-time или seasonal
ranking и филтър по server. Таблиците включват K/D, headshots, playtime,
GunGame wins, popular maps, sessions, achievements и moderation audit. Click
върху ranking ред отваря player profile. **+ Season** приключва текущия активен
сезон и стартира нов, без да изтрива all-time statistics.

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
  система.

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
- `GET /api/database/status`;
- `GET /api/stats/overview` и `GET /api/stats/players/:steamId`;
- `GET /api/bans` и `POST /api/bans/:id/revoke`;
- `GET /api/moderation/history`;
- `POST /api/seasons`;
- `DELETE /api/servers/:id` само за panel-managed stopped containers.

Health endpoint-ът `GET /api/health` е единственият route без token.
