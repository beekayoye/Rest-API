---
name: integration-testing-and-verification
description: >-
  Execute integration tests, verify HTTP status code accuracy, check zero 500 error guarantees,
  and validate API response envelopes across happy and negative path test cases.
  Use when validating endpoints, adding test suites, or confirming bug fixes.
---

# Integration Testing & Verification Workflow

This skill provides step-by-step procedures to write and run integration tests ensuring that the Food Delivery API satisfies all PRD Success Metrics.

---

## 1. Zero 500 Error Verification Matrix

The test suite must verify that all invalid client inputs result in proper 4xx responses without throwing unhandled exceptions or returning HTTP 500:

| Scenario | Input | Expected Status | Expected `error.code` |
|---|---|---|---|
| Malformed ID syntax | `GET /api/v1/restaurants/abc-123` | **400 Bad Request** | `BAD_REQUEST` |
| Well-formed non-existent ID | `GET /api/v1/restaurants/rest_000000000000000000000000` | **404 Not Found** | `NOT_FOUND` |
| Negative limit | `GET /api/v1/restaurants?limit=-5` | **400 Bad Request** | `BAD_REQUEST` |
| Zero limit | `GET /api/v1/restaurants?limit=0` | **400 Bad Request** | `BAD_REQUEST` |
| Non-numeric limit | `GET /api/v1/restaurants?limit=foo` | **400 Bad Request** | `BAD_REQUEST` |
| Negative offset | `GET /api/v1/restaurants?offset=-1` | **400 Bad Request** | `BAD_REQUEST` |
| Unsupported sort | `GET /api/v1/restaurants?sort=fake:asc` | **400 Bad Request** | `BAD_REQUEST` |
| Missing required body field | `POST /api/v1/restaurants` `{ cuisine: "Italian" }` | **422 Unprocessable** | `VALIDATION_ERROR` |
| Menu item from another rest | `POST /api/v1/orders` with mismatched `menuItemId` | **422 Unprocessable** | `VALIDATION_ERROR` |
| Delete rest with active orders| `DELETE /api/v1/restaurants/:id` | **409 Conflict** | `CONFLICT` |
| Rate limit exceeded | 101 requests within 1 minute | **429 Too Many Req** | `TOO_MANY_REQUESTS` |

---

## 2. Writing Integration Tests (`supertest` / Node Test Runner)

```javascript
// test/integration/restaurants.test.js
import { describe, it } from 'node:test';
import assert from 'node:assert';
import request from 'supertest';
import app from '../../src/app.js';

describe('GET /api/v1/restaurants', () => {
  it('returns paginated restaurants in standard envelope', async () => {
    const res = await request(app).get('/api/v1/restaurants?limit=10&offset=0');
    assert.strictEqual(res.status, 200);
    assert.ok(Array.isArray(res.body.data));
    assert.strictEqual(res.body.meta.limit, 10);
    assert.strictEqual(res.body.meta.offset, 0);
    assert.strictEqual(typeof res.body.meta.total, 'number');
    assert.strictEqual(typeof res.body.meta.hasMore, 'boolean');
  });

  it('clamps limit above 100 to 100 without error', async () => {
    const res = await request(app).get('/api/v1/restaurants?limit=500');
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.meta.limit, 100);
  });

  it('rejects malformed ID with 400 before DB lookup', async () => {
    const res = await request(app).get('/api/v1/restaurants/invalid_id');
    assert.strictEqual(res.status, 400);
    assert.strictEqual(res.body.error.code, 'BAD_REQUEST');
  });

  it('returns 404 for valid ID that does not exist', async () => {
    const res = await request(app).get('/api/v1/restaurants/rest_ffffffffffffffffffffffff');
    assert.strictEqual(res.status, 404);
    assert.strictEqual(res.body.error.code, 'NOT_FOUND');
  });
});
```

---

## 3. Running the Test Suite

```bash
# Run all integration tests
npm test
```
