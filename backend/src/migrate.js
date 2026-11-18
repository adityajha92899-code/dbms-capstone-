const fs = require('fs');
const path = require('path');
const { pool } = require('./db');

async function runSqlFile(client, filePath) {
  const fullPath = path.resolve(__dirname, filePath);
  const sql = fs.readFileSync(fullPath, 'utf8');
  console.log(`[Migration] Executing ${path.basename(filePath)}...`);
  await client.query(sql);
  console.log(`[Migration] Completed ${path.basename(filePath)}.`);
}

async function migrate() {
  const client = await pool.connect();
  const withSeed = process.argv.includes('--seed') || process.env.RUN_SEED === 'true';

  try {
    console.log('[Migration] Starting database migration...');
    await client.query('BEGIN');
    await runSqlFile(client, '../db/schema.sql');
    await runSqlFile(client, '../db/triggers.sql');
    await runSqlFile(client, '../db/views.sql');
    await runSqlFile(client, '../db/indexes.sql');
    await client.query('COMMIT');
    console.log('[Migration] Schema, triggers, views, and indexes successfully applied.');

    if (withSeed) {
      console.log('[Migration] Seeding initial data...');
      // seed.sql has its own BEGIN and COMMIT
      const seedSql = fs.readFileSync(path.resolve(__dirname, '../db/seed.sql'), 'utf8');
      await client.query(seedSql);
      console.log('[Migration] Seed data inserted successfully.');
    }
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('[Migration Error]', err.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

migrate();
