import fs from 'node:fs';
import path from 'node:path';
import pool from './pool.js';
import config from '../config/index.js';

async function migrate() {
  console.log(`Connecting to database at: ${config.databaseUrl.replace(/:[^:@]+@/, ':****@')}`);
  const schemaPath = path.resolve('db/schema.sql');
  const sql = fs.readFileSync(schemaPath, 'utf8');

  console.log('Running db/schema.sql against PostgreSQL...');
  await pool.query(sql);
  console.log('✅ Schema migration executed successfully.\n');

  // Query Tables (equivalent to \dt)
  const tablesRes = await pool.query(`
    SELECT table_name, table_type
    FROM information_schema.tables
    WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
    ORDER BY table_name;
  `);

  console.log('📋 Database Tables (\\dt):');
  console.table(tablesRes.rows);

  // Query Indexes (equivalent to \di)
  const indexesRes = await pool.query(`
    SELECT tablename, indexname
    FROM pg_indexes
    WHERE schemaname = 'public'
    ORDER BY tablename, indexname;
  `);

  console.log('🔎 Database Indexes (\\di):');
  console.table(indexesRes.rows);

  await pool.end();
}

migrate().catch((err) => {
  console.error('❌ Migration Error Details:');
  console.error('Code:', err.code);
  console.error('Message:', err.message);
  console.error('Stack:', err.stack);
  pool.end();
  process.exit(1);
});
