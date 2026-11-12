import mariadb from 'mariadb';

function integer(value, fallback) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

export function createDatabase(environment = process.env) {
  const enabled = environment.DB_ENABLED === '1';
  const pool = enabled ? mariadb.createPool({
    host: environment.DB_HOST || 'mariadb',
    port: integer(environment.DB_PORT, 3306),
    user: environment.DB_USER || 'cs16',
    password: environment.DB_PASSWORD || '',
    database: environment.DB_NAME || 'cs16',
    connectionLimit: integer(environment.DB_POOL_SIZE, 5),
    charset: 'utf8mb4',
    timezone: 'Z',
    bigIntAsNumber: true,
    insertIdAsNumber: true,
  }) : null;

  async function query(sql, parameters = []) {
    if (!pool) throw new Error('MariaDB is disabled. Start with compose.database.yaml to enable fleet data.');
    return pool.query(sql, parameters);
  }

  async function transaction(callback) {
    if (!pool) throw new Error('MariaDB is disabled. Start with compose.database.yaml to enable fleet data.');
    let connection;
    try {
      connection = await pool.getConnection();
      await connection.beginTransaction();
      const result = await callback(connection);
      await connection.commit();
      return result;
    } catch (error) {
      if (connection) await connection.rollback();
      throw error;
    } finally {
      if (connection) connection.release();
    }
  }

  async function status() {
    if (!pool) return { enabled: false, connected: false };
    try {
      const rows = await query('SELECT DATABASE() AS databaseName, VERSION() AS version, UTC_TIMESTAMP() AS checkedAt');
      return { enabled: true, connected: true, ...rows[0] };
    } catch (error) {
      return { enabled: true, connected: false, error: error.message };
    }
  }

  return { enabled, query, transaction, status, close: () => pool?.end() };
}
