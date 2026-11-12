import path from "node:path";
import { fileURLToPath } from "node:url";
import "./dotenv.mjs";

const directory = path.dirname(fileURLToPath(import.meta.url));
const connection = {
  host: process.env.DB_HOST ?? "mariadb",
  port: Number.parseInt(process.env.DB_PORT ?? "3306", 10),
  user: process.env.DB_USER ?? "cs16",
  password: process.env.DB_PASSWORD ?? "",
  database: process.env.DB_NAME ?? "cs16",
  timezone: "Z",
  charset: "utf8mb4",
  multipleStatements: process.env.DB_MULTIPLE_STATEMENTS === "1",
};
const shared = {
  client: "mariadb",
  connection,
  pool: {
    min: Number.parseInt(process.env.DB_POOL_MIN ?? "0", 10),
    max: Number.parseInt(process.env.DB_POOL_MAX ?? "5", 10),
  },
  migrations: {
    directory: path.resolve(directory, "../database/migrations"),
    loadExtensions: [".mjs"],
    extension: "mjs",
  },
};

export default {
  nodeEnv: process.env.NODE_ENV ?? "development",
  development: shared,
  test: { ...shared, connection: { ...connection, database: process.env.TEST_DB_NAME ?? connection.database } },
  production: shared,
};
