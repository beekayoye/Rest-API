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

const CUSTOMER_SORT_MAP = {
  name: 'name',
  email: 'email',
  createdAt: 'created_at',
  created_at: 'created_at',
};

const createCustomerSchema = z.object({
  name: requiredString('name'),
  email: z.string({
    required_error: 'email is required',
    invalid_type_error: 'email must be a string',
  }).email('Invalid email address format'),
  phone: optionalString('phone'),
});

// 1. GET /api/v1/customers (List customers)
router.get('/', asyncHandler(async (req, res) => {
  const { limit, offset, sortClause, filters } = parseListQuery(req.query, {
    sortMap: CUSTOMER_SORT_MAP,
    defaultSort: 'createdAt',
    defaultOrder: 'desc',
    filters: {
      name: z.string().optional(),
      email: z.string().optional(),
    },
  });

  const conditions = [];
  const values = [];

  if (filters.name) {
    values.push(`%${filters.name}%`);
    conditions.push(`name ILIKE $${values.length}`);
  }

  if (filters.email) {
    values.push(filters.email);
    conditions.push(`LOWER(email) = LOWER($${values.length})`);
  }

  const whereSql = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  const countRes = await query(`SELECT COUNT(*) FROM customers ${whereSql};`, values);
  const total = parseInt(countRes.rows[0].count, 10);

  const dataValues = [...values, limit, offset];
  const selectSql = `
    SELECT id, name, email, phone, created_at
    FROM customers
    ${whereSql}
    ORDER BY ${sortClause}
    LIMIT $${dataValues.length - 1} OFFSET $${dataValues.length};
  `;

  const { rows } = await query(selectSql, dataValues);
  res.status(200).json(listEnvelope(serializeRows(rows), buildMeta({ total, limit, offset })));
}));

// 2. GET /api/v1/customers/:id (Single customer)
router.get('/:id', asyncHandler(async (req, res) => {
  const row = await findByIdOrThrow({
    table: 'customers',
    prefix: PREFIXES.customer,
    id: req.params.id,
    resourceName: 'Customer',
  });

  res.status(200).json(itemEnvelope(serializeRow(row)));
}));

// 3. POST /api/v1/customers (Create customer)
router.post('/', asyncHandler(async (req, res) => {
  const body = validateBody(createCustomerSchema, req.body);

  // Check unique email
  const existingRes = await query('SELECT id FROM customers WHERE LOWER(email) = LOWER($1);', [body.email]);
  if (existingRes.rows.length > 0) {
    throw ApiError.conflict(`Customer with email '${body.email}' already exists.`);
  }

  const id = generateId(PREFIXES.customer);

  const insertSql = `
    INSERT INTO customers (id, name, email, phone)
    VALUES ($1, $2, $3, $4)
    RETURNING *;
  `;

  const { rows } = await query(insertSql, [id, body.name, body.email, body.phone || null]);
  res.status(201).json(itemEnvelope(serializeRow(rows[0])));
}));

// 4. DELETE /api/v1/customers/:id
router.delete('/:id', asyncHandler(async (req, res) => {
  const customer = await findByIdOrThrow({
    table: 'customers',
    prefix: PREFIXES.customer,
    id: req.params.id,
    resourceName: 'Customer',
  });

  // Check if customer has orders
  const orderCheck = await query('SELECT COUNT(*) FROM orders WHERE customer_id = $1;', [customer.id]);
  const orderCount = parseInt(orderCheck.rows[0].count, 10);

  if (orderCount > 0) {
    throw ApiError.conflict(
      `Cannot delete customer ${customer.id}. Customer has ${orderCount} associated order(s).`
    );
  }

  await query('DELETE FROM customers WHERE id = $1;', [customer.id]);
  res.status(200).json({ data: { message: `Customer ${customer.id} deleted successfully` } });
}));

export default router;
