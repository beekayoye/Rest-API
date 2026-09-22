---
name: database-seeding-and-migrations
description: >-
  Manage PostgreSQL 16 schema definitions, table relations, indexes, and idempotent seed scripts.
  Use when initializing the database, updating schema.sql, or writing seed scripts that must execute
  repeatedly without generating duplicate rows.
---

# Database Seeding & Migrations Workflow

This skill details how to manage the PostgreSQL database schema and write idempotent seed scripts for the Food Delivery API domain.

---

## 1. Schema Structure & Relationships

The database consists of 5 core tables with explicit foreign keys and indexes:

```sql
-- schema.sql
CREATE TABLE IF NOT EXISTS restaurants (
  id VARCHAR(32) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  cuisine VARCHAR(100) NOT NULL,
  description TEXT,
  address VARCHAR(255) NOT NULL,
  city VARCHAR(100) NOT NULL,
  rating NUMERIC(2, 1) DEFAULT 0.0,
  price_level INT NOT NULL CHECK (price_level BETWEEN 1 AND 4),
  image_url TEXT,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_restaurants_cuisine ON restaurants(cuisine);
CREATE INDEX IF NOT EXISTS idx_restaurants_city ON restaurants(city);

CREATE TABLE IF NOT EXISTS menu_items (
  id VARCHAR(32) PRIMARY KEY,
  restaurant_id VARCHAR(32) NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  category VARCHAR(100) NOT NULL,
  price_cents INT NOT NULL CHECK (price_cents >= 0),
  is_available BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_menu_items_restaurant_id ON menu_items(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_menu_items_category ON menu_items(category);

CREATE TABLE IF NOT EXISTS customers (
  id VARCHAR(32) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  phone VARCHAR(50),
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TYPE order_status_enum AS ENUM ('pending', 'confirmed', 'preparing', 'out_for_delivery', 'delivered', 'cancelled');

CREATE TABLE IF NOT EXISTS orders (
  id VARCHAR(32) PRIMARY KEY,
  restaurant_id VARCHAR(32) NOT NULL REFERENCES restaurants(id),
  customer_id VARCHAR(32) NOT NULL REFERENCES customers(id),
  status order_status_enum DEFAULT 'pending',
  delivery_address TEXT NOT NULL,
  total_cents INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_orders_restaurant_id ON orders(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_orders_customer_id ON orders(customer_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);

CREATE TABLE IF NOT EXISTS order_items (
  id VARCHAR(32) PRIMARY KEY,
  order_id VARCHAR(32) NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  menu_item_id VARCHAR(32) NOT NULL REFERENCES menu_items(id),
  quantity INT NOT NULL CHECK (quantity > 0),
  unit_price_cents INT NOT NULL CHECK (unit_price_cents >= 0)
);
```

---

## 2. Idempotent Seeding Pattern

Seed scripts must be safe to execute multiple times without producing duplicate entries or failing on primary/unique key constraints:

```javascript
// scripts/seed.js
import pool from '../src/db/pool.js';
import { generateId } from '../src/utils/idGenerator.js';

export async function seedDatabase() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Seed Restaurants with ON CONFLICT DO NOTHING
    for (const r of sampleRestaurants) {
      await client.query(`
        INSERT INTO restaurants (id, name, cuisine, description, address, city, rating, price_level, image_url)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        ON CONFLICT (id) DO NOTHING;
      `, [r.id, r.name, r.cuisine, r.description, r.address, r.city, r.rating, r.priceLevel, r.imageUrl]);
    }

    // 2. Seed Menu Items
    for (const m of sampleMenuItems) {
      await client.query(`
        INSERT INTO menu_items (id, restaurant_id, name, description, category, price_cents, is_available)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        ON CONFLICT (id) DO NOTHING;
      `, [m.id, m.restaurantId, m.name, m.description, m.category, m.priceCents, m.isAvailable]);
    }

    await client.query('COMMIT');
    console.log('Seeding completed successfully.');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}
```

---

## 3. Verification Steps

1. Run `node scripts/seed.js` on an empty database.
2. Query row counts:
   ```sql
   SELECT count(*) FROM restaurants;
   SELECT count(*) FROM menu_items;
   ```
3. Run `node scripts/seed.js` a second time.
4. Verify row counts remain identical and no errors are raised.
