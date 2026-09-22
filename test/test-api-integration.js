import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import request from 'supertest';
import { newDb } from 'pg-mem';

// 1. Setup in-memory PostgreSQL schema for test isolation
const memDb = newDb();
const schemaSql = fs.readFileSync(path.resolve('db/schema.sql'), 'utf8');
memDb.public.none(schemaSql);

// Hook pg-mem into pg Pool
const { Pool: MemPool } = memDb.adapters.createPg();
const memPool = new MemPool();

// Mock db/pool.js pool instance for tests
import { pool } from '../db/pool.js';
pool.query = (...args) => memPool.query(...args);
pool.connect = (...args) => memPool.connect(...args);

// Import app after pool setup
import app from '../server.js';

console.log('🧪 Running Complete Food Delivery API Integration Tests...\n');

async function runTests() {
  // ── 1. RESTAURANTS ENDPOINTS ──
  console.log('▶ Testing /api/v1/restaurants endpoints...');

  // A. Create Restaurant
  const createRestRes = await request(app)
    .post('/api/v1/restaurants')
    .send({
      name: 'Bella Italia',
      cuisine: 'Italian',
      description: 'Authentic wood-fired pizza & pasta',
      address: '123 Roma Way',
      city: 'San Francisco',
      priceLevel: 2,
    });

  assert.strictEqual(createRestRes.status, 201);
  assert.ok(createRestRes.body.data.id.startsWith('rst_'));
  assert.strictEqual(createRestRes.body.data.name, 'Bella Italia');
  const rest1Id = createRestRes.body.data.id;
  console.log('  ✔ POST /api/v1/restaurants returns 201 with standard envelope.');

  // B. Validation Error on POST (Missing required field -> 422 with details)
  const badPostRes = await request(app)
    .post('/api/v1/restaurants')
    .send({ cuisine: 'Italian' });

  assert.strictEqual(badPostRes.status, 422);
  assert.strictEqual(badPostRes.body.error.code, 'VALIDATION_ERROR');
  assert.ok(Array.isArray(badPostRes.body.error.details));
  assert.ok(badPostRes.body.error.details.some(d => d.field === 'name'));
  console.log('  ✔ POST /api/v1/restaurants rejects missing fields with 422 VALIDATION_ERROR.');

  // C. GET Single Restaurant
  const getRestRes = await request(app).get(`/api/v1/restaurants/${rest1Id}`);
  assert.strictEqual(getRestRes.status, 200);
  assert.strictEqual(getRestRes.body.data.id, rest1Id);

  // D. GET Single Restaurant with Malformed ID -> 400 Bad Request
  const badIdRes = await request(app).get('/api/v1/restaurants/invalid-id');
  assert.strictEqual(badIdRes.status, 400);
  assert.strictEqual(badIdRes.body.error.code, 'BAD_REQUEST');
  console.log('  ✔ GET /api/v1/restaurants/:id returns 400 on malformed ID before DB lookup.');

  // E. GET Single Restaurant with Non-Existent ID -> 404 Not Found
  const notFoundRes = await request(app).get('/api/v1/restaurants/rst_000000000000000000000000');
  assert.strictEqual(notFoundRes.status, 404);
  assert.strictEqual(notFoundRes.body.error.code, 'NOT_FOUND');
  console.log('  ✔ GET /api/v1/restaurants/:id returns 404 on non-existent ID.');

  // F. List Restaurants with Pagination & Clamping
  const listRestRes = await request(app).get('/api/v1/restaurants?limit=500&offset=0');
  assert.strictEqual(listRestRes.status, 200);
  assert.strictEqual(listRestRes.body.meta.limit, 100); // Clamped to maxLimit 100
  assert.strictEqual(listRestRes.body.meta.offset, 0);
  assert.strictEqual(listRestRes.body.meta.total, 1);
  console.log('  ✔ GET /api/v1/restaurants clamps limit > 100 to 100.');

  // G. List Restaurants with invalid limit=0 -> 400
  const zeroLimitRes = await request(app).get('/api/v1/restaurants?limit=0');
  assert.strictEqual(zeroLimitRes.status, 400);
  assert.strictEqual(zeroLimitRes.body.error.code, 'BAD_REQUEST');
  console.log('  ✔ GET /api/v1/restaurants rejects limit=0 with 400.');

  // Create second restaurant for menu item ownership test
  const createRest2Res = await request(app)
    .post('/api/v1/restaurants')
    .send({
      name: 'Tokyo Ramen',
      cuisine: 'Japanese',
      address: '456 Sakura Blvd',
      city: 'San Francisco',
      priceLevel: 1,
    });
  const rest2Id = createRest2Res.body.data.id;

  // ── 2. MENU ITEMS ENDPOINTS ──
  console.log('\n▶ Testing /api/v1/menu-items endpoints...');

  // Create Menu Items for Restaurant 1
  const createMenu1Res = await request(app)
    .post('/api/v1/menu-items')
    .send({
      restaurantId: rest1Id,
      name: 'Margherita Pizza',
      description: 'Tomato, mozzarella, basil',
      category: 'Mains',
      priceCents: 1450,
      isAvailable: true,
    });
  assert.strictEqual(createMenu1Res.status, 201);
  assert.ok(createMenu1Res.body.data.id.startsWith('mnu_'));
  const menu1Id = createMenu1Res.body.data.id;

  const createMenu2Res = await request(app)
    .post('/api/v1/menu-items')
    .send({
      restaurantId: rest1Id,
      name: 'Tiramisu',
      category: 'Desserts',
      priceCents: 850,
    });
  const menu2Id = createMenu2Res.body.data.id;

  // Create Menu Item for Restaurant 2
  const createMenu3Res = await request(app)
    .post('/api/v1/menu-items')
    .send({
      restaurantId: rest2Id,
      name: 'Tonkotsu Ramen',
      category: 'Mains',
      priceCents: 1600,
    });
  const menu3Id = createMenu3Res.body.data.id;

  // Sub-resource /api/v1/restaurants/:id/menu
  const restMenuRes = await request(app).get(`/api/v1/restaurants/${rest1Id}/menu`);
  assert.strictEqual(restMenuRes.status, 200);
  assert.strictEqual(restMenuRes.body.data.length, 2);
  console.log('  ✔ GET /api/v1/restaurants/:id/menu returns only items for that restaurant.');

  // ── 3. CUSTOMERS ENDPOINTS ──
  console.log('\n▶ Testing /api/v1/customers endpoints...');

  const createCustRes = await request(app)
    .post('/api/v1/customers')
    .send({
      name: 'Alice Developer',
      email: 'alice@example.com',
      phone: '555-0199',
    });
  assert.strictEqual(createCustRes.status, 201);
  assert.ok(createCustRes.body.data.id.startsWith('cus_'));
  const custId = createCustRes.body.data.id;

  // Duplicate email -> 409 Conflict
  const dupEmailRes = await request(app)
    .post('/api/v1/customers')
    .send({
      name: 'Alice Clone',
      email: 'alice@example.com',
    });
  assert.strictEqual(dupEmailRes.status, 409);
  assert.strictEqual(dupEmailRes.body.error.code, 'CONFLICT');
  console.log('  ✔ POST /api/v1/customers rejects duplicate email with 409 CONFLICT.');

  // ── 4. ORDERS ENDPOINTS (Server-Side Price Calculation & Relational Checks) ──
  console.log('\n▶ Testing /api/v1/orders endpoints...');

  // A. Order with mismatched menu item (item from Restaurant 2 ordered under Restaurant 1) -> 422
  const mismatchedOrderRes = await request(app)
    .post('/api/v1/orders')
    .send({
      restaurantId: rest1Id,
      customerId: custId,
      deliveryAddress: '789 Market St, San Francisco, CA',
      items: [
        { menuItemId: menu1Id, quantity: 1 },
        { menuItemId: menu3Id, quantity: 1 }, // Belongs to rest2Id!
      ],
    });

  assert.strictEqual(mismatchedOrderRes.status, 422);
  assert.strictEqual(mismatchedOrderRes.body.error.code, 'VALIDATION_ERROR');
  console.log('  ✔ POST /api/v1/orders rejects items from another restaurant with 422.');

  // B. Order created with client-submitted fake total -> Server calculates true total
  // Pizza ($14.50 * 2) + Tiramisu ($8.50 * 1) = $37.50 (3750 cents)
  const validOrderRes = await request(app)
    .post('/api/v1/orders')
    .send({
      restaurantId: rest1Id,
      customerId: custId,
      deliveryAddress: '789 Market St, San Francisco, CA',
      totalCents: 100, // Client tries to spoof price -> MUST be ignored!
      items: [
        { menuItemId: menu1Id, quantity: 2 }, // 2 * 1450 = 2900
        { menuItemId: menu2Id, quantity: 1 }, // 1 * 850 = 850
      ],
    });

  assert.strictEqual(validOrderRes.status, 201);
  assert.ok(validOrderRes.body.data.id.startsWith('ord_'));
  assert.strictEqual(validOrderRes.body.data.totalCents, 3750); // Exact server-computed total
  assert.strictEqual(validOrderRes.body.data.status, 'pending');
  assert.strictEqual(validOrderRes.body.data.items.length, 2);
  const orderId = validOrderRes.body.data.id;
  console.log('  ✔ POST /api/v1/orders computes totalCents on server (3750 cents) and ignores client total.');

  // C. PATCH Order Status
  const patchOrderRes = await request(app)
    .patch(`/api/v1/orders/${orderId}`)
    .send({ status: 'preparing' });

  assert.strictEqual(patchOrderRes.status, 200);
  assert.strictEqual(patchOrderRes.body.data.status, 'preparing');
  console.log('  ✔ PATCH /api/v1/orders/:id updates order status.');

  // D. DELETE Restaurant with active orders -> 409 Conflict
  const deleteRestRes = await request(app).delete(`/api/v1/restaurants/${rest1Id}`);
  assert.strictEqual(deleteRestRes.status, 409);
  assert.strictEqual(deleteRestRes.body.error.code, 'CONFLICT');
  console.log('  ✔ DELETE /api/v1/restaurants/:id returns 409 CONFLICT when active orders reference it.');

  // E. GET Order by ID
  const getOrderRes = await request(app).get(`/api/v1/orders/${orderId}`);
  assert.strictEqual(getOrderRes.status, 200);
  assert.strictEqual(getOrderRes.body.data.id, orderId);
  assert.strictEqual(getOrderRes.body.data.items.length, 2);
  console.log('  ✔ GET /api/v1/orders/:id returns order with nested items.');

  console.log('\n🎉 ALL 100% FOOD DELIVERY API INTEGRATION TESTS PASSED!\n');
}

runTests().catch((err) => {
  console.error('❌ Integration Test Failure:', err);
  process.exit(1);
});
