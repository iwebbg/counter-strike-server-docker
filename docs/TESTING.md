# Тестване

Проектът има два слоя backend тестове:

- бързи unit/contract тестове за route discovery, validation, permissions, sessions, RCON, A2S и архивните формати;
- изолиран Docker E2E тест с реални MariaDB, Redis, control API и временно създаден CS 1.6 сървър.

## Бързи тестове

```bash
npm --prefix backend/cs-control-service test
npm run format:check
```

## Docker E2E

Тежкият E2E тест не блокира автоматичния CI, защото зависи от UDP/A2S/RCON
поведението на GitHub hosted runner. В GitHub го стартирайте при нужда от
`Actions → Full E2E → Run workflow`. Автоматичният CI изпълнява unit/contract
тестовете, frontend build-а, Compose validation и ReHLDS image smoke test-а.

Първо трябва да съществува локалният game image:

```bash
./docker/compose build server
```

След това изпълнете:

```bash
npm --prefix backend/cs-control-service run test:e2e
```

Тестът използва Compose project `cs16-e2e`, web port `18080` и game ports
`29015–29025`. Той проверява login и permissions за ролите `owner`, `admin`,
`moderator` и `viewer`, както и реални операции за server lifecycle, players,
logs, maps, admins, templates/import/export/clone, configuration history и
rollback, resource/network ограничения, image update/rollback, map packages,
backup/restore и policies, seasons, moderation, audit log, HLTV evidence и
suspicious-player marker lifecycle. Lifecycle matrix-ът физически премахва
временния game container и рестартира control API, за да потвърди, че persistent
desired state възстановява `running`, `stopped` и `paused` точно.

При приключване временните контейнери, мрежа, database/backup volumes и volumes на тестовия CS сървър се премахват автоматично. Основният Compose project `cs16` и неговите данни не се променят.

При неуспех runner-ът отпечатва статусите и последните логове преди cleanup и
качва artifact `cs16-e2e-diagnostics`.
