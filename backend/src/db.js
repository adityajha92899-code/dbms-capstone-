const { Pool } = require('pg');
const config = require('./config');

const pool = new Pool({
  connectionString: config.databaseUrl,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
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
