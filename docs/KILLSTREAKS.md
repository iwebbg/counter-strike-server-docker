# Kill-streak announcements

[Български](KILLSTREAKS.md) | [English](en/KILLSTREAKS.md)

Classic и GunGame зареждат `docker_killstreak.amxx`. Плъгинът показва кратко
HUD/chat съобщение и по избор пуска звуково известие. Не отчита самоубийства,
team kills или убийства по време на warmup.

## Събития

Multi-kill броячът отчита поредни убийства в рамките на
`KILLSTREAK_MULTI_WINDOW` секунди:

|         Убийства | Известие     |
| ---------------: | ------------ |
| първото за рунда | First Blood  |
|                2 | Double Kill  |
|                3 | Multi Kill   |
|                4 | Ultra Kill   |
|               5+ | Monster Kill |

Отделният streak брояч следи убийствата без смърт:

| Поредица | Известие      |
| -------: | ------------- |
|        5 | Killing Spree |
|       10 | Rampage       |
|       15 | Dominating    |
|       20 | Unstoppable   |
|       25 | Godlike       |

Ако едно убийство покрива едновременно двата прага, streak събитието има
приоритет и се пуска само един звук. Multi-kill броячът и First Blood се
нулират всеки рунд, а streak броячът — при смърт или излизане от сървъра.

## Настройки

```dotenv
KILLSTREAK_ENABLED=1
KILLSTREAK_SOUNDS_ENABLED=1
KILLSTREAK_HUD_ENABLED=1
KILLSTREAK_GLOBAL=1
KILLSTREAK_MULTI_WINDOW=4.0
```

- `KILLSTREAK_ENABLED=0` изключва цялата система;
- `KILLSTREAK_SOUNDS_ENABLED=0` оставя само текстовите известия;
- `KILLSTREAK_HUD_ENABLED=0` скрива HUD текста, но запазва chat реда;
- `KILLSTREAK_GLOBAL=1` известява всички, а `0` — само играча;
- `KILLSTREAK_MULTI_WINDOW` задава прозореца между две убийства.

Промените в `.env` се прилагат с recreate на Compose server-а. Новите сървъри,
създадени от Control Panel, наследяват същите настройки от panel container-а.

## Звуков пакет

В `assets/sounds/killstreak/` има десет оригинални синтезирани записа, генерирани
за този проект с eSpeak NG. Не са включени записи от Unreal Tournament или друга
игра. Готовият пакет е приблизително 620 KB и клиентът го изтегля при първото
свързване към сървъра.

Можете да замените файловете със собствени записи със същите имена. За максимална
GoldSource съвместимост използвайте mono PCM WAV, 16-bit, 11025 или 22050 Hz, след
което rebuild-нете image-а:

```bash
./docker/compose up -d
```
