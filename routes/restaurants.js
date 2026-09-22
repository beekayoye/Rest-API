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
import ApiError from '../utils/apiError.js';

const router = Router();

const RESTAURANT_SORT_MAP = {
  name: 'name',
  rating: 'rating',
  priceLevel: 'price_level',
  price_level: 'price_level',
  createdAt: 'created_at',
  created_at: 'created_at',
  city: 'city',
  cuisine: 'cuisine',
};

const createRestaurantSchema = z.object({
  name: requiredString('name'),
  cuisine: requiredString('cuisine'),
  description: optionalString('description'),
  address: requiredString('address'),
  city: requiredString('city'),
  priceLevel: z.number({
    required_error: 'priceLevel is required',
    invalid_type_error: 'priceLevel must be an integer between 1 and 4',
  }).int().min(1, 'priceLevel must be between 1 and 4').max(4, 'priceLevel must be between 1 and 4'),
  rating: z.number().min(0).max(5).optional(),
  imageUrl: optionalString('imageUrl'),
});

// 1. GET /api/v1/restaurants (List with pagination, sorting & filters)
router.get('/', asyncHandler(async (req, res) => {
  const { limit, offset, sortClause, filters } = parseListQuery(req.query, {
    sortMap: RESTAURANT_SORT_MAP,
    defaultSort: 'createdAt',
    defaultOrder: 'desc',
    filters: {
      cuisine: z.string().optional(),
      city: z.string().optional(),
      priceLevel: z.preprocess((v) => (v !== undefined ? Number(v) : undefined), z.number().int().min(1).max(4).optional()),
    },
  });

  const conditions = [];
  const values = [];

  if (filters.cuisine) {
    values.push(`%${filters.cuisine}%`);
    conditions.push(`cuisine ILIKE $${values.length}`);
  }

  if (filters.city) {
    values.push(filters.city);
    conditions.push(`LOWER(city) = LOWER($${values.length})`);
  }

  if (filters.priceLevel !== undefined) {
    values.push(filters.priceLevel);
    conditions.push(`price_level = $${values.length}`);
  }

  const whereSql = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  // Get total count
  const countRes = await query(`SELECT COUNT(*) FROM restaurants ${whereSql};`, values);
  const total = parseInt(countRes.rows[0].count, 10);

  // Fetch paginated page
  const dataValues = [...values, limit, offset];
  const selectSql = `
    SELECT id, name, cuisine, description, address, city, rating, price_level, image_url, created_at
    FROM restaurants
    ${whereSql}
    ORDER BY ${sortClause}
    LIMIT $${dataValues.length - 1} OFFSET $${dataValues.length};
  `;

  const { rows } = await query(selectSql, dataValues);

  res.status(200).json(listEnvelope(serializeRows(rows), buildMeta({ total, limit, offset })));
}));

// 2. GET /api/v1/restaurants/:id (Single restaurant)
router.get('/:id', asyncHandler(async (req, res) => {
  const row = await findByIdOrThrow({
    table: 'restaurants',
    prefix: PREFIXES.restaurant,
    id: req.params.id,
    resourceName: 'Restaurant',
  });

  res.status(200).json(itemEnvelope(serializeRow(row)));
}));

// 3. POST /api/v1/restaurants (Create restaurant)
router.post('/', asyncHandler(async (req, res) => {
  const body = validateBody(createRestaurantSchema, req.body);
  const id = generateId(PREFIXES.restaurant);

  const insertSql = `
    INSERT INTO restaurants (id, name, cuisine, description, address, city, rating, price_level, image_url)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
    RETURNING *;
  `;

  const { rows } = await query(insertSql, [
    id,
    body.name,
    body.cuisine,
    body.description || null,
    body.address,
    body.city,
    body.rating || 0.0,
    body.priceLevel,
    body.imageUrl || null,
  ]);

  res.status(201).json(itemEnvelope(serializeRow(rows[0])));
}));

// 4. DELETE /api/v1/restaurants/:id (Delete restaurant, with 409 conflict detection)
router.delete('/:id', asyncHandler(async (req, res) => {
  const restaurant = await findByIdOrThrow({
    table: 'restaurants',
    prefix: PREFIXES.restaurant,
    id: req.params.id,
    resourceName: 'Restaurant',
  });

  // PRD Requirement 11: Return 409 CONFLICT if existing orders still reference this restaurant
  const orderCheck = await query(
    'SELECT COUNT(*) FROM orders WHERE restaurant_id = $1;',
    [restaurant.id]
  );
  const orderCount = parseInt(orderCheck.rows[0].count, 10);

  if (orderCount > 0) {
    throw ApiError.conflict(
      `Cannot delete restaurant ${restaurant.id}. There are ${orderCount} existing order(s) referencing this restaurant.`
    );
  }

  await query('DELETE FROM restaurants WHERE id = $1;', [restaurant.id]);
  res.status(200).json({ data: { message: `Restaurant ${restaurant.id} deleted successfully` } });
}));

// 5. GET /api/v1/restaurants/:id/menu (Sub-resource: menu items for restaurant)
router.get('/:id/menu', asyncHandler(async (req, res) => {
  // Validate restaurant exists (throws 400 or 404)
  await findByIdOrThrow({
    table: 'restaurants',
    prefix: PREFIXES.restaurant,
    id: req.params.id,
    resourceName: 'Restaurant',
  });

  const { limit, offset, sortClause, filters } = parseListQuery(req.query, {
    sortMap: {
      name: 'name',
      priceCents: 'price_cents',
      category: 'category',
      createdAt: 'created_at',
    },
    defaultSort: 'category',
    defaultOrder: 'asc',
    filters: {
      category: z.string().optional(),
      isAvailable: z.preprocess((v) => (v === 'true' ? true : v === 'false' ? false : v), z.boolean().optional()),
    },
  });

  const conditions = ['restaurant_id = $1'];
  const values = [req.params.id];

  if (filters.category) {
    values.push(`%${filters.category}%`);
    conditions.push(`category ILIKE $${values.length}`);
  }

  if (filters.isAvailable !== undefined) {
    values.push(filters.isAvailable);
    conditions.push(`is_available = $${values.length}`);
  }

  const whereSql = `WHERE ${conditions.join(' AND ')}`;

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

export default router;
