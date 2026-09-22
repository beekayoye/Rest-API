---
name: order-processing-and-validation
description: >-
  Implement and test complex order placement logic, transactional integrity, server-side price computation,
  menu item restaurant ownership verification, and order status state transitions.
  Use when modifying or testing POST /api/v1/orders, PATCH /api/v1/orders/:id, or order items logic.
---

# Order Processing & Validation Workflow

This skill outlines the business logic, relational verification, and transactional guarantees required for processing orders according to PRD Functional Requirements 9, 10, and 16.

---

## 1. Core Order Business Rules

1. **Server-Side Total Calculation:**
   - The server must lookup each `menu_item_id` in the database to fetch its current `price_cents`.
   - `totalCents = sum(quantity * item.price_cents)`.
   - Any client-submitted `total` or `totalCents` in the request body **must be ignored**.

2. **Restaurant Ownership Validation:**
   - Every menu item ordered must belong to the specified `restaurantId`.
   - If a menu item belongs to a different restaurant or does not exist:
     - Abort the transaction.
     - Return **HTTP 422 Unprocessable Entity**.
     - `error.code = "VALIDATION_ERROR"`.
     - `error.message = "Menu item <id> does not belong to restaurant <restaurantId>"`.

3. **Atomic Database Transactions:**
   - Order creation must insert into `orders` and `order_items` within a single `BEGIN ... COMMIT` block.

---

## 2. Order Creation Implementation Flow

```javascript
// src/services/orderService.js
import pool from '../db/pool.js';
import { generateId } from '../utils/idGenerator.js';

export async function createOrder({ restaurantId, customerId, deliveryAddress, items }) {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // 1. Verify restaurant exists
    const restCheck = await client.query('SELECT id FROM restaurants WHERE id = $1', [restaurantId]);
    if (restCheck.rows.length === 0) {
      const err = new Error(`Restaurant ${restaurantId} not found`);
      err.status = 404;
      err.code = 'NOT_FOUND';
      throw err;
    }

    // 2. Fetch menu items to verify ownership and current prices
    const itemIds = items.map(i => i.menuItemId);
    const { rows: menuRows } = await client.query(`
      SELECT id, restaurant_id, price_cents, is_available
      FROM menu_items
      WHERE id = ANY($1::text[])
    `, [itemIds]);

    const menuMap = new Map(menuRows.map(m => [m.id, m]));

    let calculatedTotalCents = 0;
    const validatedItems = [];

    for (const item of items) {
      const dbItem = menuMap.get(item.menuItemId);

      if (!dbItem || dbItem.restaurant_id !== restaurantId) {
        const err = new Error(`Menu item ${item.menuItemId} does not belong to restaurant ${restaurantId}`);
        err.status = 422;
        err.code = 'VALIDATION_ERROR';
        throw err;
      }

      const itemTotal = item.quantity * dbItem.price_cents;
      calculatedTotalCents += itemTotal;

      validatedItems.push({
        id: generateId('item'),
        menuItemId: item.menuItemId,
        quantity: item.quantity,
        unitPriceCents: dbItem.price_cents,
      });
    }

    // 3. Insert order record
    const orderId = generateId('ord');
    await client.query(`
      INSERT INTO orders (id, restaurant_id, customer_id, delivery_address, total_cents, status)
      VALUES ($1, $2, $3, $4, $5, 'pending')
    `, [orderId, restaurantId, customerId, deliveryAddress, calculatedTotalCents]);

    // 4. Insert order items
    for (const vItem of validatedItems) {
      await client.query(`
        INSERT INTO order_items (id, order_id, menu_item_id, quantity, unit_price_cents)
        VALUES ($1, $2, $3, $4, $5)
      `, [vItem.id, orderId, vItem.menuItemId, vItem.quantity, vItem.unitPriceCents]);
    }

    await client.query('COMMIT');

    return {
      id: orderId,
      restaurantId,
      customerId,
      deliveryAddress,
      totalCents: calculatedTotalCents,
      status: 'pending',
      items: validatedItems,
    };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}
```

---

## 3. Order Status State Transitions

Allowed status progression:
`pending` ➔ `confirmed` ➔ `preparing` ➔ `out_for_delivery` ➔ `delivered` (or `cancelled`).

On `PATCH /api/v1/orders/:id`:
- Validate status against the `OrderStatus` enum.
- Concurrent updates follow Last-Write-Wins (LWW).
- Update `updated_at = CURRENT_TIMESTAMP`.
