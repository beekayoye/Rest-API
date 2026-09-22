import { newDb } from 'pg-mem';
import fs from 'node:fs';
import path from 'node:path';

function createJsonPool() {
  const db = newDb();
  const schemaSql = fs.readFileSync(path.resolve('db/schema.sql'), 'utf8');
  db.public.none(schemaSql);

  const dataPath = path.resolve('api/db.json');
  const dataset = JSON.parse(fs.readFileSync(dataPath, 'utf8'));

  const { Pool } = db.adapters.createPg();
  const poolInstance = new Pool();

  // Load initial data from data/db.json
  for (const r of dataset.restaurants) {
    db.public.none(`
      INSERT INTO restaurants (id, name, cuisine, description, address, city, rating, price_level, image_url, created_at)
      VALUES ('${r.id}', '${r.name.replace(/'/g, "''")}', '${r.cuisine.replace(/'/g, "''")}', ${r.description ? `'${r.description.replace(/'/g, "''")}'` : 'NULL'}, '${r.address.replace(/'/g, "''")}', '${r.city.replace(/'/g, "''")}', ${r.rating}, ${r.price_level}, ${r.image_url ? `'${r.image_url}'` : 'NULL'}, '${r.created_at}');
    `);
  }

  for (const m of dataset.menu_items) {
    db.public.none(`
      INSERT INTO menu_items (id, restaurant_id, name, description, category, price_cents, is_available, created_at)
      VALUES ('${m.id}', '${m.restaurant_id}', '${m.name.replace(/'/g, "''")}', ${m.description ? `'${m.description.replace(/'/g, "''")}'` : 'NULL'}, '${m.category}', ${m.price_cents}, ${m.is_available}, '${m.created_at}');
    `);
  }

  for (const c of dataset.customers) {
    db.public.none(`
      INSERT INTO customers (id, name, email, phone, created_at)
      VALUES ('${c.id}', '${c.name.replace(/'/g, "''")}', '${c.email}', ${c.phone ? `'${c.phone}'` : 'NULL'}, '${c.created_at}');
    `);
  }

  for (const o of dataset.orders) {
    db.public.none(`
      INSERT INTO orders (id, restaurant_id, customer_id, status, delivery_address, total_cents, created_at, updated_at)
      VALUES ('${o.id}', '${o.restaurant_id}', '${o.customer_id}', '${o.status}', '${o.delivery_address.replace(/'/g, "''")}', ${o.total_cents}, '${o.created_at}', '${o.updated_at}');
    `);
  }

  for (const oi of dataset.order_items) {
    db.public.none(`
      INSERT INTO order_items (id, order_id, menu_item_id, quantity, unit_price_cents, created_at)
      VALUES ('${oi.id}', '${oi.order_id}', '${oi.menu_item_id}', ${oi.quantity}, ${oi.unit_price_cents}, '${oi.created_at}');
    `);
  }

  return {
    db,
    pool: poolInstance,
    saveToJson: () => {
      const restaurants = db.public.many('SELECT * FROM restaurants');
      const menu_items = db.public.many('SELECT * FROM menu_items');
      const customers = db.public.many('SELECT * FROM customers');
      const orders = db.public.many('SELECT * FROM orders');
      const order_items = db.public.many('SELECT * FROM order_items');
      fs.writeFileSync(dataPath, JSON.stringify({ restaurants, menu_items, customers, orders, order_items }, null, 2));
    }
  };
}

async function test() {
  const { pool } = createJsonPool();
  const res = await pool.query('SELECT COUNT(*) FROM restaurants');
  console.log('JSON Pool Loaded Count:', res.rows[0].count);
}

test();
