const { Pool } = require('pg');
const config = require('./config');

const isProduction = config.nodeEnv === 'production';
const requiresSsl =
  process.env.DATABASE_SSL === 'true' ||
  (isProduction &&
    !config.databaseUrl.includes('localhost') &&
    !config.databaseUrl.includes('127.0.0.1') &&
    !config.databaseUrl.includes('@db:'));

const pool = new Pool({
  connectionString: config.databaseUrl,
  ssl: requiresSsl ? { rejectUnauthorized: false } : false,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

pool.on('error', (err) => {
  console.error('[PostgreSQL Pool Error]', err.message, err.stack);
});

/**
 * Execute a parameterized SQL query against the connection pool.
 * @param {string} sql
 * @param {Array} [params=[]]
 * @returns {Promise<import('pg').QueryResult>}
 */
async function query(sql, params = []) {
  return pool.query(sql, params);
}

module.exports = {
  pool,
  query,
};
