import Db from "../utils/Db.mjs";
import { runDueBackupPolicies } from "../controllers/backups/services/BackupPolicyService.mjs";

export default class BackupScheduler {
  timer = null;
  running = false;

  start() {
    if (!Db.enabled || process.env.BACKUP_SCHEDULER_ENABLED === "0") return;
    const interval = Math.max(30_000, Number(process.env.BACKUP_SCHEDULER_INTERVAL_MS || 60_000));
    this.timer = setInterval(() => this.tick(), interval);
    this.timer.unref();
    setTimeout(() => this.tick(), 5_000).unref();
  }

  async tick() {
    if (this.running) return;
    this.running = true;
    try {
      await runDueBackupPolicies();
    } catch (error) {
      console.error("[backup-scheduler] tick failed", error.message);
    } finally {
      this.running = false;
    }
  }

  stop() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }
}
