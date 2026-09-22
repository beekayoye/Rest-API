---
name: api-endpoint-scaffolding
description: >-
  Scaffold or extend REST API endpoints for the Food Delivery API following the project's
  layered architecture, Zod validation, parameterized SQL, and standard JSON response envelopes.
  Use when adding new routes, resources, or HTTP methods under /api/v1/.
---

# API Endpoint Scaffolding Workflow

This skill guides the agent through creating or modifying endpoints in the Food Delivery API to ensure 100% compliance with the PRD and architecture rules.

---

## 1. Prerequisites & Architectural Layers

Every endpoint must be implemented through the standard unidirectional data flow:
1. **Route definition** (`src/routes/`)
2. **Zod validation schemas** (`src/validators/`)
3. **Controller** (`src/controllers/`)
4. **Service & SQL queries** (`src/services/` & `src/db/`)
5. **Serializer & Envelope formatting** (`src/utils/serializer.js` & `src/utils/envelope.js`)

---

## 2. Step-by-Step Implementation Procedure

### Step 1: Define Zod Validation Schema (`src/validators/`)
Create separate schemas for params, query, and request body.

```javascript
import { z } from 'zod';

// ID Regex pattern: <prefix>_[0-9a-f]{24}
export const restaurantIdParamSchema = z.object({
  id: z.string().regex(/^rest_[0-9a-f]{24}$/, {
    message: 'Invalid id format for restaurant. Expected format: rest_<24 hex characters>',
  }),
});

export const createRestaurantSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  cuisine: z.string().min(1, 'Cuisine is required'),
  description: z.string().optional(),
  address: z.string().min(1, 'Address is required'),
  city: z.string().min(1, 'City is required'),
  priceLevel: z.number().int().min(1).max(4, 'Price level must be between 1 and 4'),
  imageUrl: z.string().url().optional(),
});
```

### Step 2: Implement Controller (`src/controllers/`)
Controllers handle HTTP parsing, invoke services, and wrap responses in the standard envelope.

```javascript
import { successEnvelope, listEnvelope } from '../utils/envelope.js';
import * as restaurantService from '../services/restaurantService.js';

export async function getRestaurantById(req, res, next) {
  try {
    const restaurant = await restaurantService.findById(req.params.id);
    if (!restaurant) {
      return res.status(404).json({
        error: {
          code: 'NOT_FOUND',
          message: `Restaurant with id ${req.params.id} not found`,
        },
      });
    }
    return res.status(200).json(successEnvelope(restaurant));
  } catch (err) {
    next(err);
  }
}
```

### Step 3: Implement Database Service (`src/services/`)
Execute parameterized SQL queries using `pg.pool`.

```javascript
import pool from '../db/pool.js';
import { snakeToCamel } from '../utils/serializer.js';

export async function findById(id) {
  const query = `
    SELECT id, name, cuisine, description, address, city, rating, price_level, image_url, created_at
    FROM restaurants
    WHERE id = $1;
  `;
  const { rows } = await pool.query(query, [id]);
  return rows.length > 0 ? snakeToCamel(rows[0]) : null;
}
```

### Step 4: Mount Route with Middleware (`src/routes/`)
Attach Zod validation middleware before the controller.

```javascript
import { Router } from 'express';
import { validateParams, validateBody } from '../middleware/validate.js';
import { restaurantIdParamSchema, createRestaurantSchema } from '../validators/restaurantValidator.js';
import * as controller from '../controllers/restaurantController.js';

const router = Router();

router.get('/:id', validateParams(restaurantIdParamSchema), controller.getRestaurantById);
router.post('/', validateBody(createRestaurantSchema), controller.createRestaurant);

export default router;
```

---

## 3. Verification Checklist

- [ ] Route is mounted under `/api/v1/{resource}`.
- [ ] List response wrapped in `{ data: [...], meta: { total, limit, offset, hasMore } }`.
- [ ] Single item response wrapped in `{ data: { ... } }`.
- [ ] All database columns in `snake_case` serialized to `camelCase` in JSON.
- [ ] All SQL queries parameterized with `$1, $2, ...`.
- [ ] Non-existent ID returns HTTP 404 `{ error: { code: "NOT_FOUND", ... } }`.
- [ ] Malformed ID syntax returns HTTP 400 `{ error: { code: "BAD_REQUEST", ... } }`.
