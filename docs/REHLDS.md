# Експериментален ReHLDS профил

[Български](REHLDS.md) | [English](en/REHLDS.md)

Проектът предлага ReHLDS/ReGameDLL като отделен opt-in image. Стабилният и
подразбиращ се профил остава Valve HLDS от Steam `steam_legacy`. Така може да
тествате алтернативния engine без да променяте данните или конфигурацията на
сървъра и да се върнете с една команда.

## Включване и rollback

```bash
./docker/compose engine rehlds
./docker/compose up -d
```

Връщане към стабилния image:

```bash
./docker/compose engine valve
./docker/compose up -d
```

Compose пресъздава container-а, но запазва environment настройките, портовете,
мрежите и persistent AMXX/log volumes. Направете backup преди engine migration
на production сървър и първо проверете Classic, а след това GunGame.

## Pin-ната compatibility matrix

| Компонент       | Версия               | Статус в този проект                                          |
| --------------- | -------------------- | ------------------------------------------------------------- |
| ReHLDS          | `3.15.0.896`         | Runtime smoke test                                            |
| ReGameDLL_CS    | `5.30.0.814`         | Зарежда се като `cstrike/dlls/cs.so`                          |
| Metamod-R       | `1.3.0.149`          | Зарежда AMX Mod X                                             |
| ReAPI           | release `5.29.0.358` | AMXX module работи; runtime build се отчита като `5.29.0.359` |
| ReSemiclip      | `2.4.3`              | Native Metamod plugin; Pawn hook-ът е изключен при ReHLDS     |
| AMX Mod X       | `1.9.0.5303`         | 6/6 core modules работят                                      |
| Classic/GunGame | project presets      | И двата режима използват същите source-built plugins          |

Версиите са pin-нати в [`Dockerfile`](../Dockerfile) и не се обновяват
автоматично. Източници: [ReHLDS releases](https://github.com/rehlds/ReHLDS/releases),
[ReGameDLL_CS releases](https://github.com/rehlds/ReGameDLL_CS/releases),
[Metamod-R releases](https://github.com/rehlds/Metamod-R/releases) и
[ReAPI releases](https://github.com/rehlds/ReAPI/releases), както и
[ReSemiclip releases](https://github.com/rehlds/resemiclip/releases).

ReSemiclip archive-ът се проверява с pin-нат SHA-256 преди разархивиране.
`SEMICLIP_ENABLED=0|1` редактира native `config.ini`; Pawn semiclip fallback-ът
остава активен само във Valve image-а, за да няма два collision hook-а едновременно.

## Проверка

Build-ът изпълнява [`docker/rehlds-smoke.sh`](../docker/rehlds-smoke.sh), който
проверява engine, game DLL, Metamod-R и ReAPI файловете. След стартиране:

```text
version
game version
meta version
meta list
amxx modules
amxx plugins
```

`meta list`, `amxx modules` и `amxx plugins` трябва да показват компонентите като
running. Проверете и реална смяна на карта, статистики, admin менюто, GunGame
progression и custom plugins преди production migration.

## Compatibility лаборатория

Копирайте [`external-plugins.example.tsv`](../configs/rehlds/external-plugins.example.tsv)
и опишете точната версия на всеки външен signature/Orpheu plugin. Допустимите
статуси са `not-tested`, `passed`, `failed` и `blocked`. След runtime тест:

```bash
./docker/rehlds-lab.sh compatibility cs16-server-1 my-plugins.tsv
```

Командата записва pin-натите engine версии, Metamod/AMXX load списъците и
последните loader errors. Тя не превръща `not-tested` автоматично в `passed` —
това решение изисква map change, restart и реално упражняване на plugin-а.

## Performance benchmark

Стартирайте Classic/GunGame canary, свържете реалните test players или одобрени
load bots и запишете броя им в report metadata:

```bash
REHLDS_TEST_PLAYERS=24 ./docker/rehlds-lab.sh benchmark cs16-server-1 1800 5
```

JSONL report-ът съдържа timestamp, container health и суровите CPU/memory/network
Docker samples. Минимумът е 60 секунди; препоръчват се 30 минути на пълни слотове.
Сравнявайте със същата карта, player count, rates и host върху Valve image.
Инструментът събира evidence, но не твърди, че неизпълнен real-player тест е минал.

## Staged production migration

1. Направете off-host backup и запишете текущия Valve image ID.
2. Мигрирайте един непубличен Classic canary; проверете A2S, map change, AMXX,
   ReSemiclip, SQL stats, admins и 30-минутен player-load report.
3. Пуснете един публичен Classic сървър с наблюдение на crash/error logs поне 24 часа.
4. Повторете същите gates за GunGame, включително progression, respawn и double jump.
5. При regression изпълнете `./docker/compose engine valve` и
   `./docker/compose up -d`; volumes и configuration остават същите.

## Ограничения

- профилът е experimental и не заменя stable image-а;
- ReHLDS/ReGameDLL имат binary разлики спрямо Valve binaries; plugins, които
  използват signatures, Orpheu или директни offsets, изискват отделна проверка;
- host CPU трябва да поддържа SSE/SSE2/SSE3;
- ReUnion и non-Steam authentication не са включени и не са част от проекта;
- външните signature/Orpheu plugins остават `not-tested`, докато няма запазен
  runtime report за точната им версия;
- real-player performance gate остава незавършен, докато няма сравними Valve и
  ReHLDS reports под еднакъв load.
