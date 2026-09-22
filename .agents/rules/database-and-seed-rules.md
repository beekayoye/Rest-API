# Food Delivery API — Database & Seeding Rules

These rules govern database schemas, SQL queries, casing conversions, and seed script idempotency according to Sections 7 & 10 of the PRD.

---

## 1. Database Schema & Tables

- **Engine:** PostgreSQL 16
- **Schema:** Single schema with five relational tables:
  1. `restaurants`
  2. `menu_items` (Foreign key: `restaurant_id` -> `restaurants.id`)
  3. `customers`
  4. `orders` (Foreign keys: `restaurant_id` -> `restaurants.id`, `customer_id` -> `customers.id`)
  5. `order_items` (Foreign keys: `order_id` -> `orders.id`, `menu_item_id` -> `menu_items.id`)

### Order Status Enum:
Allowed order statuses: `pending`, `confirmed`, `preparing`, `out_for_delivery`, `delivered`, `cancelled`.

---

## 2. Parameterized SQL & Injection Prevention

- **Never Concatenate Values:** Every variable value in an SQL query must be passed as parameterized positional variables (`$1`, `$2`, `$3`, etc.) using the `pg` client.
- **Dynamic Columns & Sort Orders:** Dynamic table names or sort directions must be strictly checked against static JavaScript allowlists before insertion into SQL strings.

---

## 3. Case Conversion Rules (snake_case vs. camelCase)

- **Database Layer:** All SQL tables and columns MUST use `snake_case` (e.g. `price_cents`, `restaurant_id`, `created_at`, `is_available`).
- **API / JSON Layer:** All JSON request bodies and response fields MUST use `camelCase` (e.g. `priceCents`, `restaurantId`, `createdAt`, `isAvailable`).
- **Serialization:** Always use a response serializer to convert PostgreSQL row objects from `snake_case` to `camelCase` before building the API response envelope.

---

## 4. Idempotent Database Seeding Rules

- The seed script (`scripts/seed.js` or `npm run seed`) MUST be strictly **idempotent**.
- Running the seed script multiple times against the same PostgreSQL database must leave the database in the exact same consistent state without creating duplicate records or throwing primary key / unique constraint errors.
- Use `ON CONFLICT (id) DO NOTHING` or clean upsert logic.
- Seed scale baseline: ~200 restaurants, ~1,700 menu items, ~400 orders.
