import "./dotenv.mjs";

export default {
  redisUrl: process.env.REDIS_URL ?? "redis://localhost:6379",
  required: process.env.REDIS_REQUIRED !== "false",
};
