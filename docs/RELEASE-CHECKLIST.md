# Release checklist

[Български](RELEASE-CHECKLIST.md) | [English](en/RELEASE-CHECKLIST.md)

Този checklist е release gate за публичен tag. Отбелязвайте точките само върху
конкретния commit, който ще бъде публикуван.

## 1. Чисто repository

- [ ] `git status --short` е празен;
- [ ] `.env` secrets, backup archives, demos и runtime logs не са staged;
- [ ] BG/EN документацията и примерните environment стойности са синхронизирани;
- [ ] release notes описват migrations, несъвместимости и rollback.

## 2. Статични проверки

- [ ] `npm run format:check`;
- [ ] `npm test` в `backend/cs-control-service`;
- [ ] `npm run build` в `frontend/cs-control`;
- [ ] `bash -n docker/compose docker/*.sh docker/entrypoint.sh` за приложимите scripts;
- [ ] `./docker/compose config` валидира избраната конфигурация.

## 3. Изолиран integration gate

- [ ] `npm run test:e2e` в backend минава в отделния `cs16-e2e` project;
- [ ] lifecycle matrix покрива running/stopped/paused desired state и физически
      премахнат container;
- [ ] create/edit/update/rollback пазят `SERVER_ID`, ports, network и volumes;
- [ ] admins/maps/players/backups/evidence endpoint-ите работят с четирите роли;
- [ ] временните E2E containers, networks и volumes са почистени.

## 4. Runtime smoke

- [ ] Classic и GunGame стигат `healthy` и отговарят на A2S;
- [ ] AMXX/Metamod modules, SQL stats и map rotation се зареждат без errors;
- [ ] MariaDB migrations са idempotent; Redis session refresh и sign-out работят;
- [ ] panel restart и Docker/VPS restart възстановяват само desired `running` и
      `paused` сървъри; stopped сървърите остават спрени;
- [ ] Resources екранът показва retained volumes, а cleanup отказва активен ресурс.

## 5. Proxy и production

- [ ] local и production NGINX routing към Next.js/API е проверен;
- [ ] production domain, HTTPS port, certificate path и renewal са проверени;
- [ ] panel/API/MariaDB/Redis не са публикувани директно;
- [ ] login/moderation rate limits, allowlist/VPN/SSO настройките са проверени;
- [ ] backup + restore rehearsal е направен преди migration.

## 6. Release

- [ ] image tags са immutable и са записани текущите image IDs;
- [ ] database и volume backup е наличен извън Docker host-а;
- [ ] rollback командите са проверени;
- [ ] tag/release се създава едва след преминаване на горните gates;
- [ ] след deploy се проверяват health, logs, A2S, login и един test server.

Не записвайте „real-player benchmark passed“, ако тестът не е изпълнен с реален
player load. ReHLDS performance резултатите се пазят отделно според
[`REHLDS.md`](REHLDS.md).
