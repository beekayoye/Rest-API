import assert from 'node:assert';
import config from '../config/index.js';
import { pool, query } from '../db/pool.js';
import { generateId, isValidId, PREFIXES } from '../utils/ids.js';
import { listEnvelope, itemEnvelope } from '../utils/envelope.js';
import { ApiError } from '../utils/apiError.js';

console.log('🧪 Testing Core Infrastructure Modules...\n');

// 1. Test config
console.log('▶ Testing config/index.js...');
assert.strictEqual(config.port, 3000);
assert.strictEqual(config.pagination.defaultLimit, 20);
assert.strictEqual(config.pagination.maxLimit, 100);
assert.strictEqual(config.rateLimit.windowMs, 60000);
assert.strictEqual(config.rateLimit.max, 100);
console.log('  ✔ config values verified.');

// 2. Test utils/ids.js
console.log('▶ Testing utils/ids.js...');
assert.deepStrictEqual(PREFIXES, {
  restaurant: 'rst',
  menuItem: 'mnu',
  customer: 'cus',
  order: 'ord',
  orderItem: 'oit',
});

const restId = generateId(PREFIXES.restaurant);
assert(restId.startsWith('rst_'));
assert.strictEqual(restId.length, 28); // 3 + 1 + 24
assert(isValidId('rst', restId));
assert(isValidId(PREFIXES.restaurant, restId));
assert(!isValidId('rst', 'invalid-id'));
assert(!isValidId('rst', 'rst_123')); // too short
assert(!isValidId('mnu', restId)); // wrong prefix
console.log(`  ✔ Generated ID: ${restId}`);
console.log('  ✔ isValidId validations passed.');

// 3. Test utils/envelope.js
console.log('▶ Testing utils/envelope.js...');
const item = itemEnvelope({ id: restId, name: 'Taco Haven' });
assert.deepStrictEqual(item, { data: { id: restId, name: 'Taco Haven' } });

const list = listEnvelope([{ id: restId }], { total: 1, limit: 20, offset: 0, hasMore: false });
assert.deepStrictEqual(list, {
  data: [{ id: restId }],
  meta: { total: 1, limit: 20, offset: 0, hasMore: false },
});
console.log('  ✔ itemEnvelope & listEnvelope verified.');

// 4. Test utils/apiError.js
console.log('▶ Testing utils/apiError.js...');
const badReq = ApiError.badRequest('Invalid parameter');
assert.strictEqual(badReq.status, 400);
assert.strictEqual(badReq.code, 'BAD_REQUEST');
assert.strictEqual(badReq.message, 'Invalid parameter');

const valErr = ApiError.validation('Body validation failed', [{ field: 'name', message: 'Required' }]);
assert.strictEqual(valErr.status, 422);
assert.strictEqual(valErr.code, 'VALIDATION_ERROR');
assert.strictEqual(valErr.details.length, 1);

const notFoundErr = ApiError.notFound('Restaurant not found');
assert.strictEqual(notFoundErr.status, 404);
assert.strictEqual(notFoundErr.code, 'NOT_FOUND');

const conflictErr = ApiError.conflict('Cannot delete restaurant with active orders');
assert.strictEqual(conflictErr.status, 409);
assert.strictEqual(conflictErr.code, 'CONFLICT');
console.log('  ✔ ApiError and all static helpers verified.');

// 5. Test db/pool.js exports
console.log('▶ Testing db/pool.js exports...');
assert(pool !== undefined);
assert(typeof query === 'function');
console.log('  ✔ db/pool.js exports verified.');

console.log('\n🎉 ALL CORE MODULES VERIFIED SUCCESSFULLY!\n');
