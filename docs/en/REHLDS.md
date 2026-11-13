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

| Component       | Version              | Project status                                         |
| --------------- | -------------------- | ------------------------------------------------------ |
| ReHLDS          | `3.15.0.896`         | Runtime smoke tested                                   |
| ReGameDLL_CS    | `5.30.0.814`         | Loaded as `cstrike/dlls/cs.so`                         |
| Metamod-R       | `1.3.0.149`          | Loads AMX Mod X                                        |
| ReAPI           | release `5.29.0.358` | AMXX module works; runtime build reports `5.29.0.359`  |
| ReSemiclip      | `2.4.3`              | Native Metamod plugin; Pawn hook is disabled on ReHLDS |
| AMX Mod X       | `1.9.0.5303`         | 6/6 core modules running                               |
| Classic/GunGame | project presets      | Both modes use the same source-built plugins           |

Versions are pinned in the [`Dockerfile`](../../Dockerfile) and are not updated
automatically. Sources: [ReHLDS releases](https://github.com/rehlds/ReHLDS/releases),
[ReGameDLL_CS releases](https://github.com/rehlds/ReGameDLL_CS/releases),
[Metamod-R releases](https://github.com/rehlds/Metamod-R/releases), and
[ReAPI releases](https://github.com/rehlds/ReAPI/releases), plus
[ReSemiclip releases](https://github.com/rehlds/resemiclip/releases).

The ReSemiclip archive is checked against a pinned SHA-256 before extraction.
`SEMICLIP_ENABLED=0|1` updates the native `config.ini`; the Pawn semiclip fallback
remains active only in the Valve image so both collision hooks never run together.

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

## Compatibility lab

Copy [`external-plugins.example.tsv`](../../configs/rehlds/external-plugins.example.tsv)
and record the exact version of each external signature/Orpheu plugin. Allowed
statuses are `not-tested`, `passed`, `failed`, and `blocked`. After a runtime test:

```bash
./docker/rehlds-lab.sh compatibility cs16-server-1 my-plugins.tsv
```

The command records pinned engine versions, Metamod/AMXX load lists, and recent
loader errors. It never changes `not-tested` to `passed` automatically: that
decision requires map change, restart, and real exercise of the plugin.

## Performance benchmark

Start a Classic/GunGame canary, connect real test players or approved load bots,
and record their count in the report metadata:

```bash
REHLDS_TEST_PLAYERS=24 ./docker/rehlds-lab.sh benchmark cs16-server-1 1800 5
```

The JSONL report contains timestamps, container health, and raw Docker
CPU/memory/network samples. The minimum is 60 seconds; 30 minutes at full slots
is recommended. Compare the same map, player count, rates, and host against the
Valve image. The tool collects evidence but never claims that an unexecuted
real-player test passed.

## Staged production migration

1. Create an off-host backup and record the current Valve image ID.
2. Migrate one private Classic canary; verify A2S, map change, AMXX, ReSemiclip,
   SQL stats, admins, and a 30-minute player-load report.
3. Run one public Classic server while monitoring crash/error logs for at least 24 hours.
4. Repeat the same gates for GunGame, including progression, respawn, and double jump.
5. On regression run `./docker/compose engine valve` and
   `./docker/compose up -d`; volumes and configuration stay unchanged.

## Limitations

- the profile is experimental and does not replace the stable image;
- ReHLDS/ReGameDLL have binary differences from Valve binaries; plugins using
  signatures, Orpheu, or direct offsets need separate testing;
- the host CPU must support SSE/SSE2/SSE3;
- ReUnion and non-Steam authentication are not included or supported here;
- external signature/Orpheu plugins remain `not-tested` until a runtime report
  exists for their exact version;
- the real-player performance gate remains incomplete until comparable Valve and
  ReHLDS reports exist under the same load.
