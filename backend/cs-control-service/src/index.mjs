import globalConfig from "./config/global.mjs";
import Db from "./utils/Db.mjs";
import Redis from "./utils/Redis.mjs";
import Server from "./utils/Server.mjs";
import BackupScheduler from "./infrastructure/BackupScheduler.mjs";
import EvidenceRetentionScheduler from "./infrastructure/EvidenceRetentionScheduler.mjs";
import CommunityEventScheduler from "./infrastructure/CommunityEventScheduler.mjs";
import { reconcileServerDefinitions } from "./controllers/servers/services/ServerDefinitionService.mjs";

const lifecycle = [];

async function start() {
  await Db.init();
  lifecycle.push(() => Db.stop());
  await Redis.init();
  lifecycle.unshift(() => Redis.stop());
  if (globalConfig.processRole === "api") {
    try {
      const reconciliation = await reconcileServerDefinitions();
      if (reconciliation.restored.length || reconciliation.failed.length)
        console.log("[panel] server definition reconciliation", reconciliation);
    } catch (error) {
      console.error("[panel] server definition reconciliation failed; continuing API startup", error);
    }
    const server = new Server();
    await server.init();
    lifecycle.unshift(() => server.stop());
    const backupScheduler = new BackupScheduler();
    backupScheduler.start();
    lifecycle.unshift(() => backupScheduler.stop());
    const evidenceRetentionScheduler = new EvidenceRetentionScheduler();
    evidenceRetentionScheduler.start();
    lifecycle.unshift(() => evidenceRetentionScheduler.stop());
    const communityEventScheduler = new CommunityEventScheduler();
    communityEventScheduler.start();
    lifecycle.unshift(() => communityEventScheduler.stop());
    return;
  }
  throw new Error(`Unsupported PROCESS_ROLE: ${globalConfig.processRole}`);
}

let stopping = false;
async function stop(signal, error = null) {
  if (stopping) return;
  stopping = true;
  if (error) console.error(error);
  for (const close of lifecycle) await close().catch((closeError) => console.error(closeError));
  process.exitCode = error ? 1 : 0;
  if (signal) console.log(`Stopped after ${signal}`);
}

for (const signal of ["SIGINT", "SIGTERM"]) process.once(signal, () => stop(signal));
process.once("uncaughtException", (error) => stop("uncaughtException", error));
process.once("unhandledRejection", (error) => stop("unhandledRejection", error));

await start();
