import { createClient } from "redis";
import redisConfig from "../config/redis.mjs";

class Redis {
  static redisClient = null;
  static async init() {
    if (Redis.redisClient) return Redis.redisClient;
    const client = createClient({ url: redisConfig.redisUrl });
    client.on("error", (error) => console.error("Redis.error", error.message));
    try {
      await client.connect();
      Redis.redisClient = client;
      return client;
    } catch (error) {
      if (redisConfig.required) throw error;
      await client.disconnect().catch(() => undefined);
      return null;
    }
  }
  async client() { return Redis.redisClient ?? Redis.init(); }
  async set(key, data, ttlSeconds) {
    const client = await this.client();
    if (!client) return false;
    if (ttlSeconds) await client.setEx(key, ttlSeconds, data);
    else await client.set(key, data);
    return true;
  }
  async get(key) {
    const client = await this.client();
    return client ? client.get(key) : null;
  }
  async delete(key) {
    const client = await this.client();
    if (!client) return false;
    await client.del(key);
    return true;
  }
  static async stop() {
    if (!Redis.redisClient) return;
    await Redis.redisClient.quit();
    Redis.redisClient = null;
  }
}

export default Redis;
