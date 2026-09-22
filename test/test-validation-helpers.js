import assert from 'node:assert';
import { z } from 'zod';
import { parseListQuery, buildMeta } from '../utils/listQuery.js';
import { validateBody } from '../utils/validateBody.js';
import { requiredString, requiredNumber } from '../utils/zodHelpers.js';
import { findByIdOrThrow } from '../utils/lookup.js';
import { ApiError } from '../utils/apiError.js';

console.log('🧪 Testing Zod Validation Helpers & Query Parser...\n');

// 1. Test zodHelpers.js
console.log('▶ Testing utils/zodHelpers.js...');
const testSchema = z.object({
  name: requiredString('name'),
  price: requiredNumber('price'),
});

// Missing field test
const missingResult = testSchema.safeParse({});
assert(!missingResult.success);
const missingIssues = missingResult.error.errors;
assert(missingIssues.some(e => e.path[0] === 'name' && e.message === 'name is required'));
assert(missingIssues.some(e => e.path[0] === 'price' && e.message === 'price is required'));

// Wrong type test
const wrongTypeResult = testSchema.safeParse({ name: 123, price: 'free' });
assert(!wrongTypeResult.success);
const wrongTypeIssues = wrongTypeResult.error.errors;
assert(wrongTypeIssues.some(e => e.path[0] === 'name' && e.message === 'name must be a string'));
assert(wrongTypeIssues.some(e => e.path[0] === 'price' && e.message === 'price must be a number'));
console.log('  ✔ requiredString & requiredNumber custom error messages verified.');

// 2. Test validateBody.js
console.log('▶ Testing utils/validateBody.js...');
try {
  validateBody(testSchema, { name: '', price: 'abc' });
  assert.fail('Should have thrown ApiError');
} catch (err) {
  assert(err instanceof ApiError);
  assert.strictEqual(err.status, 422);
  assert.strictEqual(err.code, 'VALIDATION_ERROR');
  assert(Array.isArray(err.details));
  assert(err.details.some(d => d.field === 'name'));
  assert(err.details.some(d => d.field === 'price'));
}

const validData = validateBody(testSchema, { name: 'Burrito', price: 950 });
assert.deepStrictEqual(validData, { name: 'Burrito', price: 950 });
console.log('  ✔ validateBody throws 422 with details on failure and returns data on success.');

// 3. Test listQuery.js
console.log('▶ Testing utils/listQuery.js...');
const sortMap = {
  name: 'name',
  rating: 'rating',
  createdAt: 'created_at',
};

// Default values
const defaultQuery = parseListQuery({}, { sortMap, defaultSort: 'createdAt', defaultOrder: 'desc' });
assert.strictEqual(defaultQuery.limit, 20);
assert.strictEqual(defaultQuery.offset, 0);
assert.strictEqual(defaultQuery.sortColumn, 'created_at');
assert.strictEqual(defaultQuery.order, 'DESC');
assert.strictEqual(defaultQuery.sortClause, 'created_at DESC');

// Clamping oversized limit (e.g. 500 clamped to 100)
const clampedQuery = parseListQuery({ limit: '500' }, { sortMap });
assert.strictEqual(clampedQuery.limit, 100);

// Invalid limit = 0 -> throws 400
assert.throws(() => parseListQuery({ limit: '0' }, { sortMap }), (err) => err.status === 400 && err.details.some(d => d.field === 'limit'));

// Invalid limit = -5 -> throws 400
assert.throws(() => parseListQuery({ limit: '-5' }, { sortMap }), (err) => err.status === 400 && err.details.some(d => d.field === 'limit'));

// Non-numeric limit = 'abc' -> throws 400
assert.throws(() => parseListQuery({ limit: 'abc' }, { sortMap }), (err) => err.status === 400 && err.details.some(d => d.field === 'limit'));

// Negative offset -> throws 400
assert.throws(() => parseListQuery({ offset: '-10' }, { sortMap }), (err) => err.status === 400 && err.details.some(d => d.field === 'offset'));

// Unsupported sort -> throws 400 listing allowed values
try {
  parseListQuery({ sort: 'unsupportedField' }, { sortMap });
  assert.fail('Should have thrown for unsupported sort');
} catch (err) {
  assert.strictEqual(err.status, 400);
  assert(err.details.some(d => d.message.includes('Allowed values: name, rating, createdAt')));
}

// Custom resource filters
const filterQuery = parseListQuery(
  { cuisine: 'Mexican', city: 'Austin', limit: '15', offset: '30' },
  {
    sortMap,
    filters: {
      cuisine: z.string().optional(),
      city: z.string().optional(),
    },
  }
);
assert.strictEqual(filterQuery.limit, 15);
assert.strictEqual(filterQuery.offset, 30);
assert.strictEqual(filterQuery.filters.cuisine, 'Mexican');
assert.strictEqual(filterQuery.filters.city, 'Austin');

// buildMeta
const meta = buildMeta({ total: 55, limit: 20, offset: 20 });
assert.deepStrictEqual(meta, { total: 55, limit: 20, offset: 20, hasMore: true });
const metaLast = buildMeta({ total: 55, limit: 20, offset: 40 });
assert.deepStrictEqual(metaLast, { total: 55, limit: 20, offset: 40, hasMore: false });
console.log('  ✔ parseListQuery and buildMeta validated across all edge cases.');

// 4. Test lookup.js pre-database check
console.log('▶ Testing utils/lookup.js...');
assert.rejects(
  async () => {
    await findByIdOrThrow({ table: 'restaurants', prefix: 'rst', id: 'invalid_id_format' });
  },
  (err) => err.status === 400 && err.message.includes('Invalid id format')
);
console.log('  ✔ findByIdOrThrow rejects malformed ID with 400 before DB lookup.');

console.log('\n🎉 ALL VALIDATION & QUERY HELPERS VERIFIED SUCCESSFULLY!\n');
