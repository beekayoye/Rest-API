---
name: pagination-filtering-and-sorting
description: >-
  Build, validate, and execute paginated list queries with limit clamping, offset validation,
  whitelisted sort clauses, and domain-specific filters for any resource list endpoint.
  Use when writing or modifying GET /api/v1/{resource} query logic.
---

# Pagination, Filtering & Sorting Implementation Workflow

This skill guides the agent in building robust, injection-safe SQL queries supporting pagination, filtering, and sorting as mandated by PRD Section 5.

---

## 1. Query Parameters Processing Pipeline

```
Raw Query (req.query)
      │
      ▼
1. Validate & Parse Limit / Offset
   - Missing limit -> default 20
   - limit > 100 -> clamp to 100
   - limit <= 0 or non-numeric -> Throw 400 BAD_REQUEST
   - offset < 0 or non-numeric -> Throw 400 BAD_REQUEST
      │
      ▼
2. Validate & Whitelist Sort Clause
   - Check column against ALLOWLIST
   - Unsupported column -> Throw 400 BAD_REQUEST listing allowed options
      │
      ▼
3. Construct Parameterized WHERE Filters
   - Build conditions array + values array ($1, $2, ...)
      │
      ▼
4. Execute Query & COUNT(*) for Total
      │
      ▼
5. Build Meta Envelope: { total, limit, offset, hasMore }
```

---

## 2. Reusable Helper Implementation

```javascript
// src/utils/queryBuilder.js

export function parsePagination(query) {
  let limit = 20;
  let offset = 0;

  if (query.limit !== undefined) {
    const rawLimit = Number(query.limit);
    if (!Number.isInteger(rawLimit) || rawLimit <= 0) {
      const err = new Error("Invalid 'limit'. Must be a positive integer greater than 0.");
      err.status = 400;
      err.code = 'BAD_REQUEST';
      throw err;
    }
    // Clamp to 100
    limit = Math.min(rawLimit, 100);
  }

  if (query.offset !== undefined) {
    const rawOffset = Number(query.offset);
    if (!Number.isInteger(rawOffset) || rawOffset < 0) {
      const err = new Error("Invalid 'offset'. Must be a non-negative integer (>= 0).");
      err.status = 400;
      err.code = 'BAD_REQUEST';
      throw err;
    }
    offset = rawOffset;
  }

  return { limit, offset };
}

export function parseSorting(sortStr, allowlist, defaultSort = 'created_at:desc') {
  const target = sortStr || defaultSort;
  const [field, direction] = target.split(':');
  const cleanField = field.trim();
  const cleanDirection = (direction || 'asc').toLowerCase() === 'desc' ? 'DESC' : 'ASC';

  if (!allowlist.includes(cleanField)) {
    const err = new Error(`Unsupported sort field '${cleanField}'. Allowed values: ${allowlist.join(', ')}`);
    err.status = 400;
    err.code = 'BAD_REQUEST';
    throw err;
  }

  return `${cleanField} ${cleanDirection}`;
}
```

---

## 3. List Endpoint Controller Pattern

```javascript
// src/services/restaurantService.js
import pool from '../db/pool.js';
import { parsePagination, parseSorting } from '../utils/queryBuilder.js';
import { snakeToCamel } from '../utils/serializer.js';

const ALLOWED_SORTS = ['name', 'rating', 'price_level', 'created_at'];

export async function listRestaurants(query) {
  const { limit, offset } = parsePagination(query);
  const sortClause = parseSorting(query.sort, ALLOWED_SORTS, 'created_at:desc');

  const conditions = [];
  const values = [];

  if (query.cuisine) {
    values.push(query.cuisine);
    conditions.push(`LOWER(cuisine) = LOWER($${values.length})`);
  }

  if (query.city) {
    values.push(query.city);
    conditions.push(`LOWER(city) = LOWER($${values.length})`);
  }

  if (query.priceLevel) {
    values.push(Number(query.priceLevel));
    conditions.push(`price_level = $${values.length}`);
  }

  const whereSql = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  // 1. Get total count
  const countRes = await pool.query(`SELECT COUNT(*) FROM restaurants ${whereSql}`, values);
  const total = parseInt(countRes.rows[0].count, 10);

  // 2. Fetch page data
  const dataValues = [...values, limit, offset];
  const dataQuery = `
    SELECT id, name, cuisine, description, address, city, rating, price_level, image_url, created_at
    FROM restaurants
    ${whereSql}
    ORDER BY ${sortClause}
    LIMIT $${dataValues.length - 1} OFFSET $${dataValues.length};
  `;

  const { rows } = await pool.query(dataQuery, dataValues);

  return {
    data: rows.map(snakeToCamel),
    meta: {
      total,
      limit,
      offset,
      hasMore: offset + limit < total,
    },
  };
}
```
