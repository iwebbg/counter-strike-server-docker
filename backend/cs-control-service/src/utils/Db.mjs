import knex from "knex";
import dbConfig from "../config/db.mjs";

class Db {
  static knexdb = null;

  static get enabled() {
    return process.env.DB_ENABLED === "1";
  }

  get enabled() {
    return Db.enabled;
  }

  static async init() {
    if (!Db.enabled) return null;
    if (!Db.knexdb) {
      const selected = dbConfig[dbConfig.nodeEnv] ?? dbConfig.development;
      Db.knexdb = knex(selected);
      await Db.knexdb.raw("SELECT 1");
    }
    return Db.knexdb;
  }

  async db() {
    const connection = await Db.init();
    if (!connection) throw new Error("MariaDB is disabled. Start the database Compose profile to enable fleet data.");
    return connection;
  }

  async status() {
    if (!Db.enabled) return { enabled: false, connected: false };
    try {
      const result = await (
        await this.db()
      ).raw("SELECT DATABASE() AS databaseName, VERSION() AS version, UTC_TIMESTAMP() AS checkedAt");
      return { enabled: true, connected: true, ...result[0][0] };
    } catch (error) {
      return { enabled: true, connected: false, error: error.message };
    }
  }

  async query(sql, parameters = []) {
    const result = await (await this.db()).raw(sql, parameters);
    return result[0];
  }

  async transaction(callback) {
    return (await this.db()).transaction((trx) =>
      callback({
        query: async (sql, parameters = []) => (await trx.raw(sql, parameters))[0],
      }),
    );
  }

  static async stop() {
    if (!Db.knexdb) return;
    await Db.knexdb.destroy();
    Db.knexdb = null;
  }
}

export default Db;
