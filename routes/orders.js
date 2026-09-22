import { Router } from 'express';
import { z } from 'zod';
import { pool, query } from '../db/pool.js';
import { PREFIXES, generateId } from '../utils/ids.js';
import { listEnvelope, itemEnvelope } from '../utils/envelope.js';
import { parseListQuery, buildMeta } from '../utils/listQuery.js';
import { validateBody } from '../utils/validateBody.js';
import { findByIdOrThrow } from '../utils/lookup.js';
import { serializeRow, serializeRows } from '../utils/serializers.js';
import { requiredString } from '../utils/zodHelpers.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import ApiError from '../utils/apiError.js';

const router = Router();

const ORDER_SORT_MAP = {
  createdAt: 'created_at',
  created_at: 'created_at',
  totalCents: 'total_cents',
  total_cents: 'total_cents',
  status: 'status',
};

const ORDER_STATUS_ENUM = ['pending', 'confirmed', 'preparing', 'out_for_delivery', 'delivered', 'cancelled'];

const createOrderSchema = z.object({
  restaurantId: requiredString('restaurantId'),
  customerId: requiredString('customerId'),
  deliveryAddress: requiredString('deliveryAddress'),
  totalCents: z.any().optional(), // Client-supplied total is accepted in body but strictly ignored
  total: z.any().optional(),
  items: z.array(z.object({
    menuItemId: requiredString('menuItemId'),
    quantity: z.number({
      required_error: 'quantity is required',
      invalid_type_error: 'quantity must be a positive integer',
    }).int('quantity must be an integer').min(1, 'quantity must be at least 1'),
  }), {
    required_error: 'items is required',
    invalid_type_error: 'items must be an array of order items',
  }).min(1, 'Order must contain at least 1 item'),
});

const updateOrderStatusSchema = z.object({
  status: z.enum(ORDER_STATUS_ENUM, {
    errorMap: () => ({
      message: `Invalid order status. Allowed values: ${ORDER_STATUS_ENUM.join(', ')}`,
    }),
  }),
});

// Helper to attach items to orders
async function attachItemsToOrders(orders) {
  if (orders.length === 0) return [];

  const orderIds = orders.map((o) => o.id);
  const placeholders = orderIds.map((_, idx) => `$${idx + 1}`).join(', ');
  const itemsRes = await query(`
    SELECT id, order_id, menu_item_id, quantity, unit_price_cents
    FROM order_items
    WHERE order_id IN (${placeholders})
  `, orderIds);

  const itemsByOrder = new Map();
  for (const item of itemsRes.rows) {
    if (!itemsByOrder.has(item.order_id)) {
      itemsByOrder.set(item.order_id, []);
    }
    itemsByOrder.get(item.order_id).push(serializeRow(item));
  }

  return orders.map((o) => {
    const serializedOrder = serializeRow(o);
    serializedOrder.items = itemsByOrder.get(o.id) || [];
    return serializedOrder;
  });
}

// 1. GET /api/v1/orders (List orders with pagination & filters)
router.get('/', asyncHandler(async (req, res) => {
  const { limit, offset, sortClause, filters } = parseListQuery(req.query, {
    sortMap: ORDER_SORT_MAP,
    defaultSort: 'createdAt',
    defaultOrder: 'desc',
    filters: {
      restaurantId: z.string().optional(),
      customerId: z.string().optional(),
      status: z.enum(ORDER_STATUS_ENUM).optional(),
    },
  });

  const conditions = [];
  const values = [];

  if (filters.restaurantId) {
    values.push(filters.restaurantId);
    conditions.push(`restaurant_id = $${values.length}`);
  }

  if (filters.customerId) {
    values.push(filters.customerId);
    conditions.push(`customer_id = $${values.length}`);
  }

  if (filters.status) {
    values.push(filters.status);
    conditions.push(`status = $${values.length}`);
  }

  const whereSql = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  const countRes = await query(`SELECT COUNT(*) FROM orders ${whereSql};`, values);
  const total = parseInt(countRes.rows[0].count, 10);

  const dataValues = [...values, limit, offset];
  const selectSql = `
    SELECT id, restaurant_id, customer_id, status, delivery_address, total_cents, created_at, updated_at
    FROM orders
    ${whereSql}
    ORDER BY ${sortClause}
    LIMIT $${dataValues.length - 1} OFFSET $${dataValues.length};
  `;

  const { rows } = await query(selectSql, dataValues);
  const ordersWithItems = await attachItemsToOrders(rows);

  res.status(200).json(listEnvelope(ordersWithItems, buildMeta({ total, limit, offset })));
}));

// 2. GET /api/v1/orders/:id (Single order with nested items)
router.get('/:id', asyncHandler(async (req, res) => {
  const order = await findByIdOrThrow({
    table: 'orders',
    prefix: PREFIXES.order,
    id: req.params.id,
    resourceName: 'Order',
  });

  const itemsRes = await query(
    'SELECT id, order_id, menu_item_id, quantity, unit_price_cents FROM order_items WHERE order_id = $1;',
    [order.id]
  );

  const serialized = serializeRow(order);
  serialized.items = serializeRows(itemsRes.rows);

  res.status(200).json(itemEnvelope(serialized));
}));

// 3. POST /api/v1/orders (Create order with relational ownership checks and server-computed total)
router.post('/', asyncHandler(async (req, res) => {
  const body = validateBody(createOrderSchema, req.body);

  // 1. Verify restaurant exists
  await findByIdOrThrow({
    table: 'restaurants',
    prefix: PREFIXES.restaurant,
    id: body.restaurantId,
    resourceName: 'Restaurant',
  });

  // 2. Verify customer exists
  await findByIdOrThrow({
    table: 'customers',
    prefix: PREFIXES.customer,
    id: body.customerId,
    resourceName: 'Customer',
  });

  // 3. Query all menu items to verify ownership and get current prices
  const itemIds = body.items.map((i) => i.menuItemId);
  const placeholders = itemIds.map((_, idx) => `$${idx + 1}`).join(', ');
  const menuRes = await query(
    `SELECT id, restaurant_id, name, price_cents, is_available FROM menu_items WHERE id IN (${placeholders});`,
    itemIds
  );

  const menuMap = new Map(menuRes.rows.map((m) => [m.id, m]));

  let calculatedTotalCents = 0;
  const validatedItems = [];

  for (const item of body.items) {
    const dbItem = menuMap.get(item.menuItemId);

    // PRD Requirement 10: Rejects with 422 if menu item does not belong to specified restaurant
    if (!dbItem || dbItem.restaurant_id !== body.restaurantId) {
      throw ApiError.validation(
        `Menu item ${item.menuItemId} does not belong to restaurant ${body.restaurantId}`,
        [
          {
            field: 'items',
            message: `Menu item ${item.menuItemId} does not belong to restaurant ${body.restaurantId}`,
          },
        ]
      );
    }

    // PRD Requirement 9: Server-side total calculation from current price_cents at order time
    const unitPriceCents = dbItem.price_cents;
    calculatedTotalCents += item.quantity * unitPriceCents;

    validatedItems.push({
      id: generateId(PREFIXES.orderItem),
      menuItemId: item.menuItemId,
      quantity: item.quantity,
      unitPriceCents,
    });
  }

  // 4. Atomic transaction inserting into orders and order_items
  const client = await pool.connect();
  const orderId = generateId(PREFIXES.order);

  try {
    await client.query('BEGIN');

    const insertOrderSql = `
      INSERT INTO orders (id, restaurant_id, customer_id, status, delivery_address, total_cents)
      VALUES ($1, $2, $3, 'pending', $4, $5)
      RETURNING *;
    `;
    const orderRes = await client.query(insertOrderSql, [
      orderId,
      body.restaurantId,
      body.customerId,
      body.deliveryAddress,
      calculatedTotalCents,
    ]);

    for (const vItem of validatedItems) {
      await client.query(`
        INSERT INTO order_items (id, order_id, menu_item_id, quantity, unit_price_cents)
        VALUES ($1, $2, $3, $4, $5);
      `, [vItem.id, orderId, vItem.menuItemId, vItem.quantity, vItem.unitPriceCents]);
    }

    await client.query('COMMIT');

    const serializedOrder = serializeRow(orderRes.rows[0]);
    serializedOrder.items = validatedItems;

    res.status(201).json(itemEnvelope(serializedOrder));
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}));

// 4. PATCH /api/v1/orders/:id (Update order status, last-write-wins)
router.patch('/:id', asyncHandler(async (req, res) => {
  const body = validateBody(updateOrderStatusSchema, req.body);

  // Validate order exists (400 if malformed ID, 404 if missing)
  const existing = await findByIdOrThrow({
    table: 'orders',
    prefix: PREFIXES.order,
    id: req.params.id,
    resourceName: 'Order',
  });

  const updateSql = `
    UPDATE orders
    SET status = $1, updated_at = CURRENT_TIMESTAMP
    WHERE id = $2
    RETURNING *;
  `;

  const { rows } = await query(updateSql, [body.status, existing.id]);
  const serialized = serializeRow(rows[0]);

  // Fetch items
  const itemsRes = await query('SELECT id, order_id, menu_item_id, quantity, unit_price_cents FROM order_items WHERE order_id = $1;', [existing.id]);
  serialized.items = serializeRows(itemsRes.rows);

  res.status(200).json(itemEnvelope(serialized));
}));

export default router;
