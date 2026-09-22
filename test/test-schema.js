import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { newDb } from 'pg-mem';

console.log('🧪 Testing db/schema.sql against PostgreSQL engine...\n');

const schemaPath = path.resolve('db/schema.sql');
const sql = fs.readFileSync(schemaPath, 'utf8');

const db = newDb();

// 1. Run schema
db.public.none(sql);
console.log('✔ Executed db/schema.sql successfully.\n');

// 2. Inspect Tables
const tables = db.public.many(`
  SELECT table_name
  FROM information_schema.tables
  WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
  ORDER BY table_name;
`);

console.log('📋 Database Tables (\\dt):');
console.table(tables);

const expectedTables = ['customers', 'menu_items', 'order_items', 'orders', 'restaurants'];
const actualTables = tables.map(t => t.table_name);
for (const table of expectedTables) {
  assert(actualTables.includes(table), `Table '${table}' must exist`);
}

// 3. Inspect Columns for each table
console.log('\n📋 Table Column Details:');
for (const table of expectedTables) {
  const cols = db.public.many(`
    SELECT column_name, data_type, is_nullable
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = '${table}'
    ORDER BY ordinal_position;
  `);
  console.log(`\n--- ${table} ---`);
  console.table(cols);
}

// 4. Verify 10 Indexes defined in schema.sql
const expectedIndexes = [
  'idx_menu_items_restaurant_id',
  'idx_menu_items_category',
  'idx_menu_items_price_cents',
  'idx_restaurants_cuisine',
  'idx_restaurants_city',
  'idx_orders_restaurant_id',
  'idx_orders_customer_id',
  'idx_orders_status',
  'idx_order_items_order_id',
  'idx_order_items_menu_item_id',
];

console.log('\n🔎 Verified Required 10 Indexes:');
for (const idx of expectedIndexes) {
  assert(sql.includes(idx), `Index '${idx}' must be defined in schema.sql`);
  console.log(`  ✔ Index defined: ${idx}`);
}

console.log('\n🎉 All 5 tables and 10 indexes verified successfully!\n');
