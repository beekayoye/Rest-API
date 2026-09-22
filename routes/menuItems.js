import { Router } from 'express';
import { z } from 'zod';
import { query } from '../db/pool.js';
import { PREFIXES, generateId } from '../utils/ids.js';
import { listEnvelope, itemEnvelope } from '../utils/envelope.js';
import { parseListQuery, buildMeta } from '../utils/listQuery.js';
import { validateBody } from '../utils/validateBody.js';
import { findByIdOrThrow } from '../utils/lookup.js';
import { serializeRow, serializeRows } from '../utils/serializers.js';
import { requiredString, optionalString } from '../utils/zodHelpers.js';
import { asyncHandler } from '../middleware/asyncHandler.js';

const router = Router();

const MENU_ITEM_SORT_MAP = {
  name: 'name',
  priceCents: 'price_cents',
  price_cents: 'price_cents',
  category: 'category',
  createdAt: 'created_at',
  created_at: 'created_at',
};

const createMenuItemSchema = z.object({
  restaurantId: requiredString('restaurantId'),
  name: requiredString('name'),
  description: optionalString('description'),
  category: requiredString('category'),
  priceCents: z.number({
    required_error: 'priceCents is required',
    invalid_type_error: 'priceCents must be a non-negative integer',
  }).int('priceCents must be an integer').min(0, 'priceCents must be >= 0'),
  isAvailable: z.boolean().optional(),
});

// 1. GET /api/v1/menu-items (List with pagination, sorting & filters)
router.get('/', asyncHandler(async (req, res) => {
  const { limit, offset, sortClause, filters } = parseListQuery(req.query, {
    sortMap: MENU_ITEM_SORT_MAP,
    defaultSort: 'createdAt',
    defaultOrder: 'desc',
    filters: {
      restaurantId: z.string().optional(),
      category: z.string().optional(),
      isAvailable: z.preprocess((v) => (v === 'true' ? true : v === 'false' ? false : v), z.boolean().optional()),
    },
  });

  const conditions = [];
  const values = [];

  if (filters.restaurantId) {
    values.push(filters.restaurantId);
    conditions.push(`restaurant_id = $${values.length}`);
  }

  if (filters.category) {
    values.push(`%${filters.category}%`);
    conditions.push(`category ILIKE $${values.length}`);
  }

  if (filters.isAvailable !== undefined) {
    values.push(filters.isAvailable);
    conditions.push(`is_available = $${values.length}`);
  }

  const whereSql = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  const countRes = await query(`SELECT COUNT(*) FROM menu_items ${whereSql};`, values);
  const total = parseInt(countRes.rows[0].count, 10);

  const dataValues = [...values, limit, offset];
  const selectSql = `
    SELECT id, restaurant_id, name, description, category, price_cents, is_available, created_at
    FROM menu_items
    ${whereSql}
    ORDER BY ${sortClause}
    LIMIT $${dataValues.length - 1} OFFSET $${dataValues.length};
  `;

  const { rows } = await query(selectSql, dataValues);
  res.status(200).json(listEnvelope(serializeRows(rows), buildMeta({ total, limit, offset })));
}));

// 2. GET /api/v1/menu-items/:id (Single menu item)
router.get('/:id', asyncHandler(async (req, res) => {
  const row = await findByIdOrThrow({
    table: 'menu_items',
    prefix: PREFIXES.menuItem,
    id: req.params.id,
    resourceName: 'Menu item',
  });

  res.status(200).json(itemEnvelope(serializeRow(row)));
}));

// 3. POST /api/v1/menu-items (Create menu item)
router.post('/', asyncHandler(async (req, res) => {
  const body = validateBody(createMenuItemSchema, req.body);

  // Verify parent restaurant exists (throws 400 or 404)
  await findByIdOrThrow({
    table: 'restaurants',
    prefix: PREFIXES.restaurant,
    id: body.restaurantId,
    resourceName: 'Restaurant',
  });

  const id = generateId(PREFIXES.menuItem);

  const insertSql = `
    INSERT INTO menu_items (id, restaurant_id, name, description, category, price_cents, is_available)
    VALUES ($1, $2, $3, $4, $5, $6, $7)
    RETURNING *;
  `;

  const { rows } = await query(insertSql, [
    id,
    body.restaurantId,
    body.name,
    body.description || null,
    body.category,
    body.priceCents,
    body.isAvailable !== undefined ? body.isAvailable : true,
  ]);

  res.status(201).json(itemEnvelope(serializeRow(rows[0])));
}));

// 4. DELETE /api/v1/menu-items/:id
router.delete('/:id', asyncHandler(async (req, res) => {
  const item = await findByIdOrThrow({
    table: 'menu_items',
    prefix: PREFIXES.menuItem,
    id: req.params.id,
    resourceName: 'Menu item',
  });

  await query('DELETE FROM menu_items WHERE id = $1;', [item.id]);
  res.status(200).json({ data: { message: `Menu item ${item.id} deleted successfully` } });
}));

export default router;
