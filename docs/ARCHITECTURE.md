# Архитектура

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
```

Опционалният CS Control Panel се включва чрез Compose profile. Той използва
allowlisted Docker Engine API client през локалния Unix socket, открива само
containers с project label и прави A2S UDP заявки за live game status. Динамично
създадените game containers се включват в `cs16_default` network и получават
отделни volumes за logs и AMXX data.

Game image-ът съдържа еднаква основа за всички сървъри. Entry point-ът валидира
environment променливите, генерира `server.cfg`, избира plugin list и стартира
HLDS. Така режимът не изисква различен image.

MariaDB е Compose override и не е задължителна за game-server-only stack-а. CS
Control я използва за администраторските акаунти и OAuth sessions. Game server-ът
може да работи напълно самостоятелно, а SQL plugin-ът се добавя в `plugins.ini`
само при `DB_ENABLED=1`.

Named volumes пазят само mutable данни. Game binaries и plugins остават в image,
което прави новите инстанции възпроизводими и предотвратява стар volume да скрие
обновени файлове.

## Версии и обновяване

Версиите са build args в `Dockerfile`. След промяна изпълнете build и smoke test:

```bash
./docker/compose build --no-cache server
./docker/compose up -d
./docker/compose logs -f server
```

Steam App 90 понякога изисква повторен update; Dockerfile прави до три опита и
прекъсва build-а, ако `cstrike/liblist.gam` липсва.
