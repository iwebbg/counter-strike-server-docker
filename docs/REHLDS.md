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
| AMX Mod X       | `1.9.0.5303`         | 6/6 core modules работят                                      |
| Classic/GunGame | project presets      | И двата режима използват същите source-built plugins          |

Версиите са pin-нати в [`Dockerfile`](../Dockerfile) и не се обновяват
автоматично. Източници: [ReHLDS releases](https://github.com/rehlds/ReHLDS/releases),
[ReGameDLL_CS releases](https://github.com/rehlds/ReGameDLL_CS/releases),
[Metamod-R releases](https://github.com/rehlds/Metamod-R/releases) и
[ReAPI releases](https://github.com/rehlds/ReAPI/releases).

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

## Ограничения

- профилът е experimental и не заменя stable image-а;
- ReHLDS/ReGameDLL имат binary разлики спрямо Valve binaries; plugins, които
  използват signatures, Orpheu или директни offsets, изискват отделна проверка;
- host CPU трябва да поддържа SSE/SSE2/SSE3;
- ReUnion и non-Steam authentication не са включени и не са част от проекта;
- ReSemiclip и по-широка third-party plugin matrix остават отделна лабораторна
  стъпка.
