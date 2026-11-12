# CS 1.6 Docker Server

Готова Docker конфигурация за Counter-Strike 1.6 сървър с HLDS, Metamod,
AMX Mod X, два режима и опционална MariaDB статистика.

## Какво получавате

- `classic` — стандартен CS 1.6 с AMX Mod X администрация и статистики;
- `gungame` — прогресия през 21 оръжия, автоматичен respawn и knife финал;
- избор на режима само чрез `SERVER_MODE` в `.env`;
- опционална MariaDB fleet база с подробни статистики, seasons, achievements,
  shared admins, bans и moderation history;
- непривилегирован game container, healthcheck и постоянни AMXX данни/логове;
- порт, име, карта, mapcycle, слотове и пароли, управлявани от `.env`.

## Бърз старт

Минимално са нужни 64-bit Linux `x86_64/amd64`, Docker Engine с Compose plugin
и поне около 2 GB свободно място за готовия game image. За публичен сървър
предвидете допълнително място за build cache, logs, volumes и backups. Първият
build сваля официалния HLDS през SteamCMD и може да отнеме няколко минути.

Подробните VPS профили, реалните idle измервания и bandwidth калкулаторът са в
[`docs/REQUIREMENTS.md`](docs/REQUIREMENTS.md). Като практичен старт за две
инстанции по 24 слота препоръчваме 4 vCPU, 6–8 GB RAM, 80–120 GB SSD и 5–10+
TB месечен трафик. Бюджетен VPS с 2 бързи vCPU и 6 GB RAM също може да започне
с две инстанции, но трябва да бъде валидиран под реален player load.

Най-лесният старт е чрез Compose selector-а. Той избира server/panel/database
stack и генерира липсващите secrets:

```bash
./docker/compose setup
./docker/compose up -d --build
./docker/compose ps
```

За non-interactive full stack:

```bash
./docker/compose setup full
./docker/compose up -d --build
```

За production публикуване под domain активирайте отделно NGINX и Let’s Encrypt:

```bash
./docker/compose publish panel.example.com 443 admin@example.com
./docker/compose up -d --build
```

За existing reverse proxy в обща Docker network:

```bash
./docker/compose external server1_net cs16-panel
./docker/compose up -d --build
```

Стандартният Docker Compose workflow също остава поддържан:

```bash
cp .env.example .env
# задължително сменете RCON_PASSWORD в .env преди публичен сървър
docker compose up -d --build
docker compose logs -f server
```

Свързване от играта:

```text
connect SERVER_IP:27015
```

Спиране и стартиране:

```bash
docker compose stop
docker compose start
docker compose down
```

`docker compose down` не изтрива named volumes. Не използвайте `down -v`, ако
искате да запазите AMXX/MariaDB данните.

## Избор на режим

В `.env`:

```dotenv
SERVER_MODE=classic
```

или:

```dotenv
SERVER_MODE=gungame
```

После приложете промяната:

```bash
docker compose up -d
```

Когато `START_MAP` и `MAPCYCLE` са празни, `classic` започва с `de_dust2` и
използва класическия списък, а `gungame` започва с `gg_3way` и използва само
GunGame картите.

GunGame команди:

- `say /level` — текущо ниво и оръжие;
- `say /rank` — позиция в постоянната CS статистика;
- `say /stats` / `say /statsme` — подробна статистика;
- `say /top15` — класация на сървъра;
- `gg_kills_per_level 2` — нужни убийства на ниво (RCON/server console);
- `gg_respawn_delay 2.0` — забавяне преди respawn.

StatsX public командите `/stats`, `/statsme`, `/rankstats`, `/rank` и `/top15`
са включени по подразбиране чрез `configs/stats.ini` и работят и в двата режима.

GunGame има double jump: второ натискане на `Space` във въздуха дава още един,
по-висок скок. Настройва се от `.env`:

```dotenv
GG_DOUBLEJUMP_ENABLED=1
GG_DOUBLEJUMP_VELOCITY=350.0
```

Стойността за velocity се ограничава безопасно от plugin-а между `220` и `700`.
Welcome съобщението и списъкът с команди се показват няколко секунди след вход:

```dotenv
WELCOME_MESSAGE=Welcome to our CS 1.6 server!
```

## Recommended gameplay pack

И двата режима включват configurable warmup, teammate semiclip, AFK manager и
community map commands. GunGame включва и spawn protection, която се прекратява
веднага при стрелба. Основни команди:

```text
/rtv
/nominate gg_3way
/maps
```

По време на warmup играчите respawn-ват, а GunGame убийствата не дават нива.
AFK играчите получават предупреждение, преместват се в Spectator и накрая могат
да бъдат kick-нати. Администраторите с immunity не се засягат.

Всички времена и switches са в `.env.example`: `WARMUP_*`,
`SPAWN_PROTECTION_*`, `SEMICLIP_ENABLED`, `AFK_*`, `RTV_*` и `RECENT_MAPS`.
Пълният списък с бъдещи идеи е в [`docs/ROADMAP.md`](docs/ROADMAP.md).

### GunGame карти

Проектът включва 12 GunGame карти от `gungame_maps/`. Пакетите могат да бъдат
във формат `maps/`, `models/`, `sound/`, `sprites/`, `gfx/` и `.wad` файлове или
да съдържат допълнителна `cstrike/` директория. При build те се нормализират
автоматично. FastDL cache файлове с разширение `.ztmp` се пропускат.

Редът за map vote/mapcycle е в [`configs/maps/gungame.txt`](configs/maps/gungame.txt).
При добавяне на нова карта добавете нейното име без `.bsp` и rebuild-нете image-а.

### Classic карти

`classic_maps/` съдържа допълнителните класически карти и техните models,
skybox и `.res` файлове. Те се нормализират със същия проверен installer и се
добавят след стандартните карти в [`configs/maps/classic.txt`](configs/maps/classic.txt).

## MariaDB fleet data

MariaDB не е нужна за самата игра. За да записвате статистика, задайте силни
`DB_PASSWORD` и `DB_ROOT_PASSWORD` в `.env`, след което:

```bash
docker compose -f compose.yaml -f compose.database.yaml up -d --build
```

One-shot migration услугата създава централната схема, а AMXX collector-ът
записва players, name history, sessions, kills/deaths/headshots, damage,
playtime, map activity, GunGame progress, seasons и achievements. Control Panel
добавя fleet admins, shared bans, revoke и moderation audit. MariaDB не се
публикува като host port. Пълното описание, backup и restore процедурите са в
[`docs/DATABASE.md`](docs/DATABASE.md).

## Повече от един сървър

Всеки Compose project трябва да има собствен външен порт и `SERVER_ID`:

```bash
docker compose -p cs16-classic --env-file .env.classic up -d
docker compose -p cs16-gungame --env-file .env.gungame up -d
```

Примерни различия:

```dotenv
# .env.classic
SERVER_MODE=classic
SERVER_PORT=27015
SERVER_ID=classic-1
```

```dotenv
# .env.gungame
SERVER_MODE=gungame
SERVER_PORT=27016
SERVER_ID=gungame-1
```

Docker Compose не може надеждно сам да открива и резервира свободен host port.
За автоматично поредни портове използвайте опционалния
[CS Control Panel](docs/WEB-PANEL.md).

## CS Control Panel (опционално)

Интерактивният локален dashboard може да създава и управлява много CS 1.6
инстанции. Стандартният `docker compose up` не стартира панела. За включване:

```bash
./docker/compose setup panel
./docker/compose up -d --build
```

Отворете `http://127.0.0.1:8080` и въведете `PANEL_TOKEN`. Панелът предлага:

- Classic/GunGame и начална карта;
- max players от 2 до 32;
- автоматичен свободен порт или ръчен порт;
- избор с checkbox-и кои карти участват в rotation-а;
- start/stop/restart и live logs;
- health, текуща карта и A2S player count;
- EN/BG интерфейс с persistent language dropdown;
- автоматично генерирана RCON парола;
- live редактор за AMXX администратори без рестарт;
- live map manager с rotation и безопасен `Play now` през RCON;
- отделни persistent volumes за всяка динамична инстанция.

Изключване на панела, без спиране на game servers:

```bash
./docker/compose stop panel panel-proxy
```

Local NGINX слуша само на `127.0.0.1` по подразбиране. За production domain
използвайте `./docker/compose publish`; SSH tunnel остава удобен private вариант:

```bash
ssh -L 8080:127.0.0.1:8080 user@docker-host
```

## Администратори и RCON

Добавете администратори по Steam ID в `.env`. Всеки запис е
`STEAM_ID|access-flags`, а няколко записа се разделят с `;`:

```dotenv
AMXX_ADMINS=STEAM_0:1:123456|abcdefghijklmnopqrstu;STEAM_0:0:654321|bcdefiju
```

Първият пример има пълен достъп. Вторият има reserved slot, kick, ban,
slap/slay, map, chat, vote и menu права. Не използвайте `z` за администратор —
това е флагът за обикновен потребител. След промяна приложете конфигурацията:

```bash
docker compose up -d --force-recreate
```

Влезте със същия Steam акаунт и напишете в game console:

```text
amxmodmenu
```

Менюто съдържа kick, ban, slap/slay, team, смяна на карта, map vote, server
commands и управление на plugins според дадените права. Удобен bind:

```text
bind "F3" "amxmodmenu"
```

Ако CS Control Panel е включен, администраторите могат да се редактират и от
бутона **Admins** на всеки работещ сървър. **Save & reload** прилага промените
веднага без restart и ги пази в persistent AMXX data volume. **Reset to .env**
връща първоначалния `AMXX_ADMINS` на container-а.

Полезни преки менюта са `amx_kickmenu`, `amx_banmenu`, `amx_mapmenu` и
`amx_votemapmenu`. `mapchooser.amxx` автоматично предлага вот за следваща карта
към края на текущата карта. `mapcycle.txt` и AMXX `configs/maps.ini` се
генерират от един и същ списък за активния режим, така че admin менюто и map
vote не показват карти от другата категория.

Основни access flags:

- `a` — immunity;
- `c` — kick;
- `d` — ban/unban;
- `e` — slap/slay;
- `f` — смяна на карта;
- `i` — admin chat;
- `j` — vote;
- `u` — достъп до менюто;
- `l` — RCON, давайте го само на доверени собственици.

RCON пример от game console:

```text
rcon_password YOUR_PASSWORD
rcon status
rcon changelevel de_inferno
rcon amxx plugins
rcon meta list
```

## Добавяне на AMX Mod X plugins

Сложете Pawn source с име `docker_*.sma` в `addons/scripting/`. Docker build-ът
автоматично компилира всички такива файлове до `.amxx`. После добавете името на
plugin-а в `configs/plugins/classic.ini`, `configs/plugins/gungame.ini` или и в
двата списъка и изпълнете:

```bash
docker compose up -d --build
```

Не добавяйте непроверени готови `.amxx` binaries. Source build-ът прави версиите
и зависимостите видими и позволява build-time проверка.

## Конфигурационни файлове

- [`compose.yaml`](compose.yaml) — game server;
- [`compose.database.yaml`](compose.database.yaml) — MariaDB override;
- [`.env.example`](.env.example) — всички основни настройки;
- [`configs/plugins`](configs/plugins) — plugin list за двата режима;
- [`configs/maps`](configs/maps) — отделни mapcycle списъци за режимите;
- [`gungame_maps`](gungame_maps) — оригиналните пакети на GunGame картите;
- [`classic_maps`](classic_maps) — допълнителните пакети за Classic режима;
- [`addons/scripting`](addons/scripting) — Pawn source на custom plugins;
- [`docker/entrypoint.sh`](docker/entrypoint.sh) — проверка на env и runtime cfg.
- [`docs/PROJECT-STATUS.md`](docs/PROJECT-STATUS.md) — handoff, проверки и следващи задачи.
- [`docs/ROADMAP.md`](docs/ROADMAP.md) — реализиран пакет и бъдещи product идеи.
- [`docs/REQUIREMENTS.md`](docs/REQUIREMENTS.md) — hardware, VPS sizing и bandwidth оценки.
- [`docs/DATABASE.md`](docs/DATABASE.md) — MariaDB схема, dashboard, backup и restore.
- [`docs/COMPOSE-LAUNCHER.md`](docs/COMPOSE-LAUNCHER.md) — интерактивен stack selector и единни команди.
- [`docs/FRAGZONE-INTEGRATION.md`](docs/FRAGZONE-INTEGRATION.md) — бъдеща read-only интеграция с FragZone Web.
- [`docs/HTTPS-PROXY.md`](docs/HTTPS-PROXY.md) — NGINX, автоматичен TLS и нестандартни HTTPS ports.

## Проверка и диагностика

```bash
docker compose config
docker compose ps
docker compose logs --tail=200 server
docker compose exec server sh -lc 'grep -E "gamedll_linux" cstrike/liblist.gam'
```

При успешен старт `meta list` трябва да показва AMX Mod X, а `amxx plugins`
трябва да показва всички plugins като `running`.

## Сигурност

- Сменете примерните RCON и database пароли.
- Публикувайте само нужния game port; MariaDB няма host port по подразбиране.
- Не слагайте Docker socket в публично достъпен container.
- Ограничете RCON с firewall/VPN, когато сървърът е публичен.
- Следете и обновявайте pin-натите версии в `Dockerfile`/Compose след тест.

Проектът използва Valve SteamCMD/HLDS съдържание, което се сваля при build;
това хранилище не разпространява игровите файлове.
