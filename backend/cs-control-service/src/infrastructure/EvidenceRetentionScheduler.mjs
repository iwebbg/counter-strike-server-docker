import { runEvidenceRetention } from "../controllers/evidence/services/EvidenceService.mjs";
import { listServers } from "../controllers/servers/services/ServersService.mjs";

export default class EvidenceRetentionScheduler {
  timer = null;
  running = false;

  start() {
    if (process.env.EVIDENCE_RETENTION_ENABLED === "0") return;
    const interval = Math.max(60_000, Number(process.env.EVIDENCE_RETENTION_INTERVAL_MS || 21600000));
    this.timer = setInterval(() => this.tick(), interval);
    this.timer.unref();
    setTimeout(() => this.tick(), 15_000).unref();
  }

  async tick() {
    if (this.running) return;
    this.running = true;
    try {
      const servers = await listServers();
      for (const server of servers) {
        await runEvidenceRetention(server.id).catch((error) =>
          console.error("[evidence-retention] server cleanup failed", {
            serverId: server.serverId,
            error: error.message,
          }),
        );
      }
    } catch (error) {
      console.error("[evidence-retention] tick failed", error.message);
    } finally {
      this.running = false;
    }
  }

  stop() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }
}
