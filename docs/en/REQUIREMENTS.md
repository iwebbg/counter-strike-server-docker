# Requirements and resource planning

[Български](../REQUIREMENTS.md) | [English](REQUIREMENTS.md)

This project is designed for self-hosted Counter-Strike 1.6 servers on a local
computer, dedicated machine, or VPS. The figures below are starting guidance,
not a guarantee for a particular hosting provider. HLDS performance depends
mostly on single-core CPU speed, noisy VPS neighbours, player count, map, and
AMXX plugins.

## System requirements

- 64-bit Linux host with an `x86_64/amd64` CPU and 32-bit runtime support;
- Docker Engine and the Docker Compose plugin;
- one free UDP game port per instance, normally `27015/udp`;
- Compose also publishes TCP on the same number for compatibility;
- at least 2 GB free disk space for the built game image alone;
- additional room for build cache, logs, maps, volumes, and backups;
- public IPv4 or correctly configured NAT/port forwarding;
- stable network with low packet loss.

HLDS is mostly single-threaded. Budget roughly one fast CPU core for each busy
game instance. More slow vCPUs do not necessarily compensate for poor
single-core performance.

## Recommended VPS profiles

| Scenario            |                   CPU |      RAM |       SSD | Monthly traffic | Practical starting capacity              |
| ------------------- | --------------------: | -------: | --------: | --------------: | ---------------------------------------- |
| Local test          |                2 vCPU |     2 GB |     20 GB |      irrelevant | 1 server, 12–16 slots                    |
| Small public server |           2 fast vCPU |     4 GB |     40 GB |          2–4 TB | 1 server, up to 24 slots                 |
| Budget fleet        | 2 fast/dedicated vCPU |     6 GB |     80 GB |           10 TB | initially 2 × 24 slots, after monitoring |
| Recommended fleet   |                4 vCPU |   6–8 GB | 80–120 GB |        5–10+ TB | 2 × 24 slots plus panel and MariaDB      |
| Community fleet     |              6–8 vCPU | 12–16 GB |   160+ GB |          10+ TB | 3–5 instances depending on real load     |

A VPS with **2 vCPU, 6 GB RAM, 80 GB SSD, and 10 TB bandwidth** is a sensible
low-cost starting point for two 24-slot servers. CPU is more likely to be the
limit than RAM. Do not advertise 48 guaranteed concurrent players until you
have measured frame time, CPU steal, loss, and choke on that VPS.

For two consistently full instances, prefer 4 vCPU. This leaves room for the
OS, Control Panel, MariaDB, Docker, and short map-change spikes.

## Project baseline measurements

These are idle snapshots from a development machine on November 12, 2026.
They show baseline overhead but are **not a load test**:

| Component         | Measured idle RAM | Local image size |
| ----------------- | ----------------: | ---------------: |
| One HLDS instance |      about 72 MiB |    about 2.17 GB |
| CS Control Panel  |      about 18 MiB |     about 167 MB |
| MariaDB 11.8      |   not load-tested |     about 329 MB |

Use more conservative planning budgets:

- 256–512 MB RAM per HLDS instance;
- 128–256 MB for the Control Panel and Docker overhead;
- at least 512 MB–1 GB for a small MariaDB plus filesystem cache;
- at least 10–15 GB free after build for images, cache, and growth;
- separate capacity for backups and logs.

Repository maps are about 32 MB in total, but custom packs, models, sounds, and
FastDL content can increase disk use substantially.

## Bandwidth calculation

The current configuration allows `sv_maxrate 100000`, an upper bound of
100,000 bytes/s per client. Actual averages are often lower and depend on the
client rate, updaterate, voice, and map activity.

Estimate 30-day egress with:

```text
TB/month = average_players × average_bytes_per_second × 2,592,000 / 1,000,000,000,000
```

| Average occupancy | 25 KB/s per player | 50 KB/s per player | 100 KB/s per player |
| ----------------: | -----------------: | -----------------: | ------------------: |
|        24 players |            1.56 TB |            3.11 TB |             6.22 TB |
|        48 players |            3.11 TB |            6.22 TB |            12.44 TB |

This assumes continuous 24/7 occupancy. At 50% average occupancy, divide the
figures by roughly two. Allow extra traffic for ingress, voice, queries, map
downloads, backups, and monitoring. Some providers count both directions or
throttle the port after the quota.

A 10 TB allowance is generally practical for two community servers, but it is
not a mathematical guarantee for 48 players at maximum rate and 100% occupancy.
Prefer at least a 100 Mbps public port; 1 Gbps helps downloads and spikes but
does not replace DDoS protection.

## Validate the selected VPS

Start with one or two instances and observe at least one busy week:

```bash
docker stats
./docker/compose ps
./docker/compose logs --tail=200 server
df -h
docker system df
```

Watch CPU and CPU steal, RAM/swap/OOM events, real-player loss/choke/latency,
monthly egress, log/data/database growth, and custom-map download times. Add
another server only when existing instances remain stable at full slots.

## Public deployment

- Choose a provider that permits game servers and offers DDoS protection.
- Open only game ports and the protected Control Panel port.
- Keep public TCP `80` reachable for Let's Encrypt HTTP-01; HTTPS can use
  `443`, `8443`, or another selected host port.
- Do not publish MariaDB to the host.
- Use strong unique RCON, panel, and database passwords.
- Keep the panel behind VPN, SSH tunnel, or TLS proxy with extra identity
  protection; the default loopback bind is intentional.
- Store AMXX, log, and MariaDB backups outside the same VPS.
- For large downloads, use FastDL/CDN instead of serving every file from HLDS.
