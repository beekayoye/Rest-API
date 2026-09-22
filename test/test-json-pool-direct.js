import { createJsonPool } from '../db/jsonPool.js';

async function test() {
  const { pool } = createJsonPool();
  const [r, m, c, o, oi] = await Promise.all([
    pool.query('SELECT COUNT(*) FROM restaurants'),
    pool.query('SELECT COUNT(*) FROM menu_items'),
    pool.query('SELECT COUNT(*) FROM customers'),
    pool.query('SELECT COUNT(*) FROM orders'),
    pool.query('SELECT COUNT(*) FROM order_items'),
  ]);

  console.log('JSON Pool Successfully Loaded:');
  console.log('Restaurants count:', r.rows[0].count);
  console.log('Menu items count:', m.rows[0].count);
  console.log('Customers count:', c.rows[0].count);
  console.log('Orders count:', o.rows[0].count);
  console.log('Order items count:', oi.rows[0].count);
}

test();
