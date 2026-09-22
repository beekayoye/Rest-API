import { newDb } from 'pg-mem';
import fs from 'node:fs';
import path from 'node:path';

function escapeSql(val) {
  if (val === null || val === undefined) return 'NULL';
  if (typeof val === 'number' || typeof val === 'boolean') return String(val);
  return `'${String(val).replace(/'/g, "''")}'`;
}

function chunkArray(arr, size) {
  const chunks = [];
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size));
  }
  return chunks;
}

export function createJsonPool() {
  const db = newDb();
  const schemaSql = fs.readFileSync(path.resolve('db/schema.sql'), 'utf8');
  db.public.none(schemaSql);

  const dataPath = path.resolve('api/db.json');
  if (!fs.existsSync(dataPath)) {
    throw new Error('api/db.json does not exist. Run node scripts/generate-json-data.js first.');
  }
  const dataset = JSON.parse(fs.readFileSync(dataPath, 'utf8'));

  // Fast bulk insert using chunked multi-row VALUES
  // 1. Restaurants
  for (const chunk of chunkArray(dataset.restaurants, 100)) {
    const valuesSql = chunk.map(r => 
      `(${escapeSql(r.id)}, ${escapeSql(r.name)}, ${escapeSql(r.cuisine)}, ${escapeSql(r.description)}, ${escapeSql(r.address)}, ${escapeSql(r.city)}, ${r.rating}, ${r.price_level}, ${escapeSql(r.image_url)}, ${escapeSql(r.created_at)})`
    ).join(',\n');
    db.public.none(`INSERT INTO restaurants (id, name, cuisine, description, address, city, rating, price_level, image_url, created_at) VALUES ${valuesSql};`);
  }

  // 2. Menu Items
  for (const chunk of chunkArray(dataset.menu_items, 100)) {
    const valuesSql = chunk.map(m => 
      `(${escapeSql(m.id)}, ${escapeSql(m.restaurant_id)}, ${escapeSql(m.name)}, ${escapeSql(m.description)}, ${escapeSql(m.category)}, ${m.price_cents}, ${m.is_available}, ${escapeSql(m.created_at)})`
    ).join(',\n');
    db.public.none(`INSERT INTO menu_items (id, restaurant_id, name, description, category, price_cents, is_available, created_at) VALUES ${valuesSql};`);
  }

  // 3. Customers
  for (const chunk of chunkArray(dataset.customers, 100)) {
    const valuesSql = chunk.map(c => 
      `(${escapeSql(c.id)}, ${escapeSql(c.name)}, ${escapeSql(c.email)}, ${escapeSql(c.phone)}, ${escapeSql(c.created_at)})`
    ).join(',\n');
    db.public.none(`INSERT INTO customers (id, name, email, phone, created_at) VALUES ${valuesSql};`);
  }

  // 4. Orders
  for (const chunk of chunkArray(dataset.orders, 100)) {
    const valuesSql = chunk.map(o => 
      `(${escapeSql(o.id)}, ${escapeSql(o.restaurant_id)}, ${escapeSql(o.customer_id)}, ${escapeSql(o.status)}, ${escapeSql(o.delivery_address)}, ${o.total_cents}, ${escapeSql(o.created_at)}, ${escapeSql(o.updated_at)})`
    ).join(',\n');
    db.public.none(`INSERT INTO orders (id, restaurant_id, customer_id, status, delivery_address, total_cents, created_at, updated_at) VALUES ${valuesSql};`);
  }

  // 5. Order Items
  for (const chunk of chunkArray(dataset.order_items, 100)) {
    const valuesSql = chunk.map(oi => 
      `(${escapeSql(oi.id)}, ${escapeSql(oi.order_id)}, ${escapeSql(oi.menu_item_id)}, ${oi.quantity}, ${oi.unit_price_cents})`
    ).join(',\n');
    db.public.none(`INSERT INTO order_items (id, order_id, menu_item_id, quantity, unit_price_cents) VALUES ${valuesSql};`);
  }

  const { Pool } = db.adapters.createPg();
  const poolInstance = new Pool();

  const saveToJson = () => {
    try {
      const restaurants = db.public.many('SELECT * FROM restaurants');
      const menu_items = db.public.many('SELECT * FROM menu_items');
      const customers = db.public.many('SELECT * FROM customers');
      const orders = db.public.many('SELECT * FROM orders');
      const order_items = db.public.many('SELECT * FROM order_items');
      fs.writeFileSync(dataPath, JSON.stringify({ restaurants, menu_items, customers, orders, order_items }, null, 2), 'utf8');
    } catch (err) {
      console.error('Failed to sync to api/db.json:', err);
    }
  };

  const originalQuery = poolInstance.query.bind(poolInstance);
  poolInstance.query = async function (text, params) {
    const result = await originalQuery(text, params);
    if (typeof text === 'string') {
      const upper = text.trim().toUpperCase();
      if (upper.startsWith('INSERT') || upper.startsWith('UPDATE') || upper.startsWith('DELETE') || upper.startsWith('TRUNCATE') || upper.startsWith('COMMIT')) {
        saveToJson();
      }
    }
    return result;
  };

  return {
    db,
    pool: poolInstance,
    saveToJson,
  };
}
