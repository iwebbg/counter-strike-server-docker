# Kill-streak announcements

[Български](../KILLSTREAKS.md) | [English](KILLSTREAKS.md)

Classic and GunGame load `docker_killstreak.amxx`. The plugin shows a short
HUD/chat message and can play a sound announcement. It ignores suicides, team
kills, and kills during warmup.

## Events

The multi-kill counter tracks consecutive kills within
`KILLSTREAK_MULTI_WINDOW` seconds:

|              Kills | Announcement |
| -----------------: | ------------ |
| first in the round | First Blood  |
|                  2 | Double Kill  |
|                  3 | Multi Kill   |
|                  4 | Ultra Kill   |
|                 5+ | Monster Kill |

A separate streak counter tracks kills without dying:

| Streak | Announcement  |
| -----: | ------------- |
|      5 | Killing Spree |
|     10 | Rampage       |
|     15 | Dominating    |
|     20 | Unstoppable   |
|     25 | Godlike       |

If a kill reaches both thresholds, the streak event wins and only one sound is
played. Multi-kill and First Blood reset every round; the streak counter resets
on death or disconnect.

## Settings

```dotenv
KILLSTREAK_ENABLED=1
KILLSTREAK_SOUNDS_ENABLED=1
KILLSTREAK_HUD_ENABLED=1
KILLSTREAK_GLOBAL=1
KILLSTREAK_MULTI_WINDOW=4.0
```

- `KILLSTREAK_ENABLED=0` disables the entire system;
- `KILLSTREAK_SOUNDS_ENABLED=0` leaves text announcements enabled;
- `KILLSTREAK_HUD_ENABLED=0` hides HUD text but keeps the chat line;
- `KILLSTREAK_GLOBAL=1` announces to everyone, while `0` targets the player only;
- `KILLSTREAK_MULTI_WINDOW` controls the time window between kills.

Apply `.env` changes by recreating the Compose server. Servers created by the
Control Panel inherit the same settings from the panel container.

## Sound pack

`assets/sounds/killstreak/` contains ten original synthesized recordings made
for this project with eSpeak NG. It does not include recordings from Unreal
Tournament or another game. The package is about 620 KB and clients download
it on their first connection.

You can replace the files with your own recordings using the same filenames.
For maximum GoldSource compatibility, use mono PCM WAV, 16-bit, 11025 or
22050 Hz, then rebuild the image:

```bash
./docker/compose up -d
```
