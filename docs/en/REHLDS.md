# Experimental ReHLDS profile

[Български](../REHLDS.md) | [English](REHLDS.md)

The project provides ReHLDS/ReGameDLL as a separate opt-in image. Valve HLDS
from Steam's `steam_legacy` branch remains the stable default. This lets you
evaluate the alternative engine without changing server data or configuration,
and roll back with one command.

## Enable and roll back

```bash
./docker/compose engine rehlds
./docker/compose up -d
```

Return to the stable image:

```bash
./docker/compose engine valve
./docker/compose up -d
```

Compose recreates the container while preserving environment settings, ports,
networks, and persistent AMXX/log volumes. Back up a production server before
an engine migration and validate Classic before GunGame.

## Pinned compatibility matrix

| Component       | Version              | Project status                                        |
| --------------- | -------------------- | ----------------------------------------------------- |
| ReHLDS          | `3.15.0.896`         | Runtime smoke tested                                  |
| ReGameDLL_CS    | `5.30.0.814`         | Loaded as `cstrike/dlls/cs.so`                        |
| Metamod-R       | `1.3.0.149`          | Loads AMX Mod X                                       |
| ReAPI           | release `5.29.0.358` | AMXX module works; runtime build reports `5.29.0.359` |
| AMX Mod X       | `1.9.0.5303`         | 6/6 core modules running                              |
| Classic/GunGame | project presets      | Both modes use the same source-built plugins          |

Versions are pinned in the [`Dockerfile`](../../Dockerfile) and are not updated
automatically. Sources: [ReHLDS releases](https://github.com/rehlds/ReHLDS/releases),
[ReGameDLL_CS releases](https://github.com/rehlds/ReGameDLL_CS/releases),
[Metamod-R releases](https://github.com/rehlds/Metamod-R/releases), and
[ReAPI releases](https://github.com/rehlds/ReAPI/releases).

## Verification

The build runs [`docker/rehlds-smoke.sh`](../../docker/rehlds-smoke.sh), which
checks the engine, game DLL, Metamod-R, and ReAPI files. After startup, run:

```text
version
game version
meta version
meta list
amxx modules
amxx plugins
```

`meta list`, `amxx modules`, and `amxx plugins` should report the components as
running. Validate a real map change, statistics, the admin menu, GunGame
progression, and custom plugins before a production migration.

## Limitations

- the profile is experimental and does not replace the stable image;
- ReHLDS/ReGameDLL have binary differences from Valve binaries; plugins using
  signatures, Orpheu, or direct offsets need separate testing;
- the host CPU must support SSE/SSE2/SSE3;
- ReUnion and non-Steam authentication are not included or supported here;
- ReSemiclip and a broader third-party plugin matrix remain a separate lab step.
