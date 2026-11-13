# Compose selector

[Български](COMPOSE-LAUNCHER.md) | [English](en/COMPOSE-LAUNCHER.md)

[`docker/compose`](../docker/compose) е единната входна точка за deployment-а.
Подобно на wrapper-а в `counter-strike-web-laravel`, той прочита избора от
`.env` и сам добавя правилните Compose файлове и profiles.

## Първоначална настройка

```bash
./docker/compose setup
```

Интерактивният selector предлага:

| Stack      | Услуги                                                 |
| ---------- | ------------------------------------------------------ |
| `full`     | Game server, локален CS Control Panel, MariaDB и Redis |
| `panel`    | Game server, локален Control Panel, MariaDB и Redis    |
| `database` | Game server и MariaDB                                  |
| `server`   | Само game server                                       |

Изборът се записва като `CS16_STACK` в `.env`. Setup-ът генерира липсващи или
примерни RCON, panel и database secrets чрез OpenSSL, без да ги показва в
terminal output.

За автоматизиран/non-interactive setup подайте stack директно:

```bash
./docker/compose setup full
```

CI може да използва отделен environment файл, без да променя project `.env`:

```bash
CS16_ENV_FILE=/run/secrets/cs16.env ./docker/compose config
```

Локално panel-ът остава на `http://127.0.0.1:8080`. Production публикуването
под domain се включва отделно, за да не се генерира SSL при local development:

```bash
./docker/compose publish panel.example.com 8443 admin@example.com
./docker/compose up -d --build
./docker/compose unpublish
```

За преглед през вече съществуващ reverse proxy и Docker network:

```bash
./docker/compose external server1_net cs16-panel
./docker/compose up -d --build
```

Подробности: [`HTTPS-PROXY.md`](HTTPS-PROXY.md).

## Ежедневни команди

Стартирайте wrapper-а без аргументи за интерактивно управление:

```bash
./docker/compose
```

Менюто предлага start/update, status, logs, restart, пълно спиране, изтриване
на volumes с потвърждение, смяна на stack и diagnostics. Същите операции са
достъпни и като директни команди:

```bash
./docker/compose up -d --build
./docker/compose ps
./docker/compose logs -f server panel mariadb
./docker/compose restart server
./docker/compose down
```

Проверка на текущия избор:

```bash
./docker/compose show
```

Проверка на Docker Engine, secrets и Compose config:

```bash
./docker/compose doctor
```

## Смяна на stack

Изпълнете setup отново:

```bash
./docker/compose setup panel
./docker/compose up -d --build
```

Командата запазва останалите `.env` настройки. `./docker/compose down` винаги
открива и сваля целия `cs16` project, независимо кой stack е избран в момента.
Named volumes не се изтриват без изрично `-v`.

## Standard Compose fallback

Wrapper-ът не скрива Docker Compose. Напредналите потребители могат да използват
директно:

```bash
docker compose --project-directory . -f docker/compose.yaml up -d --build
docker compose --project-directory . -f docker/compose.yaml -f docker/compose.local.yaml --profile panel up -d --build
docker compose --project-directory . -f docker/compose.yaml -f docker/compose.external.yaml --profile panel up -d --build
docker compose --project-directory . -f docker/compose.yaml -f docker/compose.database.yaml -f docker/compose.production.yaml --profile panel up -d --build
```

Това е полезно за CI, custom overrides и диагностика.
