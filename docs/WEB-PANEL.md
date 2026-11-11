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

Отворете `http://127.0.0.1:8080`. Спиране само на UI/control-plane слоя:

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
- отделни named volumes за logs и AMXX data;
- responsive интерфейс за desktop и телефон.

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

## Настройки

```dotenv
PANEL_TOKEN=
PANEL_BIND_IP=127.0.0.1
PANEL_PORT=8080
PORT_RANGE_START=27015
PORT_RANGE_END=27115
```

`PANEL_TOKEN` под 16 символа прекратява старта на панела. API заявките използват
Bearer token, пазен от browser-а само в `sessionStorage`.

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
- `DELETE /api/servers/:id` само за panel-managed stopped containers.

Health endpoint-ът `GET /api/health` е единственият route без token.
