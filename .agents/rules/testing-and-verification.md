# Food Delivery API — Testing & Verification Rules

These rules define the required automated and manual verification procedures for all API endpoints and features.

---

## 1. Automated Test Coverage Requirements

Every route and functional requirement must be covered by automated integration tests:

1. **Pagination & Clamping Tests:**
   - Default limit (20) when omitted.
   - Limit > 100 clamped to 100.
   - Limit <= 0 or non-numeric returns HTTP 400.
   - Negative offset returns HTTP 400.
   - `hasMore` calculation verified.
2. **Sorting & Filtering Tests:**
   - Supported sort columns return correctly ordered rows.
   - Unsupported sort columns return HTTP 400 with allowed list.
   - Filters accurately constrain database queries.
3. **Validation & ID Tests:**
   - Malformed ID format (`invalid-id`) returns HTTP 400 before DB lookup.
   - Well-formed non-existent ID returns HTTP 404.
   - Missing required body fields on POST returns HTTP 422 with `details` array.
4. **Domain Integrity Tests:**
   - Order total computed server-side from menu item prices; client total ignored.
   - Order with menu item not in target restaurant rejected with HTTP 422.
   - Deleting a restaurant with referenced orders returns HTTP 409.
5. **Rate Limiting & Security Tests:**
   - Exceeding configured rate limit triggers HTTP 429 with `Retry-After` header.
   - Parameterized SQL prevents SQL injection.

---

## 2. Test Execution Command

Run tests using:
```bash
npm test
```
All tests must execute in isolated environments or against a test Postgres database instance.
