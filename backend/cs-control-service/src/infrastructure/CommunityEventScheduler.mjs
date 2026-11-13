import Db from "../utils/Db.mjs";
import { runDueCommunityEvents } from "../controllers/communityEvents/services/CommunityEventService.mjs";

export default class CommunityEventScheduler {
  timer = null;
  running = false;

  start() {
    if (!Db.enabled || process.env.COMMUNITY_EVENT_SCHEDULER_ENABLED === "0") return;
    const interval = Math.max(30_000, Number(process.env.COMMUNITY_EVENT_SCHEDULER_INTERVAL_MS || 60_000));
    this.timer = setInterval(() => this.tick(), interval);
    this.timer.unref();
    setTimeout(() => this.tick(), 7_500).unref();
  }

  async tick() {
    if (this.running) return;
    this.running = true;
    try {
      await runDueCommunityEvents();
    } catch (error) {
      console.error("[community-events] tick failed", error.message);
    } finally {
      this.running = false;
    }
  }

  stop() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }
}
