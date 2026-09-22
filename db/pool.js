import pg from 'pg';
import dotenv from 'dotenv';
import fs from 'node:fs';
import path from 'node:path';
import { createJsonPool } from './jsonPool.js';

dotenv.config();

const { Pool } = pg;

const dataSource = process.env.DATA_SOURCE || (process.env.DATABASE_URL?.startsWith('postgresql://') && !process.env.DATABASE_URL.includes('localhost:5432') ? 'postgres' : 'json');

let poolInstance;
let jsonAdapter = null;

if (dataSource === 'json' || !process.env.DATABASE_URL) {
  // Ensure api/db.json exists before creating JSON pool
  const dataPath = path.resolve('api/db.json');
  if (!fs.existsSync(dataPath)) {
    const { generateSeedData } = await import('../scripts/generate-json-data.js');
    generateSeedData();
  }
  jsonAdapter = createJsonPool();
  poolInstance = jsonAdapter.pool;
  console.log('📦 Data Source: JSON File Storage (api/db.json) initialized.');
} else {
  const connectionString = process.env.DATABASE_URL;
  const isSslRequired =
    connectionString.includes('sslmode=require') ||
    process.env.PGSSL === 'true';

  poolInstance = new Pool({
    connectionString,
    ssl: isSslRequired ? { rejectUnauthorized: false } : false,
  });
  console.log('🐘 Data Source: PostgreSQL Database connected.');
}

export const pool = poolInstance;

/**
 * Execute parameterized query using the pool
 * @param {string} text - SQL query string with $1, $2 placeholders
 * @param {Array} [params] - Query parameter array
 * @returns {Promise<pg.QueryResult>}
 */
export const query = (text, params) => pool.query(text, params);

export default pool;
