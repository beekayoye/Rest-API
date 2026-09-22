# Food Delivery API — Pagination, Filtering & Sorting Rules

These rules govern the behavior and validation of list endpoints (`GET /api/v1/{resource}`) according to Section 5 of the PRD.

---

## 1. Pagination Rules

All list endpoints MUST support pagination through `limit` and `offset` query parameters.

### `limit` Behavior:
- **Default value:** `20` when omitted.
- **Maximum clamp:** When `limit > 100`, the server **clamps the value to 100** and serves the response without throwing an error.
- **Invalid limit values:** If `limit` is `<= 0` or non-numeric (e.g., `?limit=0`, `?limit=-5`, `?limit=abc`), the server MUST reject the request with:
  - **HTTP 400 Bad Request**
  - `error.code = "BAD_REQUEST"`
  - `error.message` clearly naming `limit`.

### `offset` Behavior:
- **Default value:** `0` when omitted.
- **Invalid offset values:** If `offset < 0` or non-numeric (e.g. `?offset=-10`), the server MUST reject the request with:
  - **HTTP 400 Bad Request**
  - `error.code = "BAD_REQUEST"`
  - `error.message` clearly naming `offset`.

### `meta` Envelope Output:
The `meta` object must always contain:
- `total`: Total count of rows matching the query filters (integer).
- `limit`: The effective limit applied (integer, 1–100).
- `offset`: The effective offset applied (integer, >= 0).
- `hasMore`: Boolean (`offset + limit < total`).

---

## 2. Sorting Rules & Whitelisting

- **Format:** `?sort=field:asc` or `?sort=field:desc` (or `?sort=field` defaulting to `asc`).
- **Strict Allowlist:** Sort fields MUST be checked against a strict per-resource allowlist before query execution to prevent SQL injection.
- **Invalid Sort Handling:** If the client sends an unsupported sort parameter (e.g. `?sort=invalid_col:asc`), the server MUST return:
  - **HTTP 400 Bad Request**
  - `error.code = "BAD_REQUEST"`
  - `error.message` listing all allowed sort values for that resource.

### Resource Sort Allowlist:
- **Restaurants:** `name`, `rating`, `priceLevel`, `createdAt`
- **MenuItems:** `name`, `priceCents`, `category`, `createdAt`
- **Customers:** `name`, `createdAt`
- **Orders:** `createdAt`, `totalCents`, `status`

---

## 3. Filtering Rules

Every list endpoint must support at least two domain filters:
- **Restaurants:** `cuisine` (case-insensitive string match), `city` (exact string match), `priceLevel` (integer 1-4).
- **MenuItems:** `restaurantId` (exact match), `category` (case-insensitive match), `isAvailable` (boolean).
- **Customers:** `name` (partial string match), `email` (exact string match).
- **Orders:** `restaurantId`, `customerId`, `status` (`pending`, `confirmed`, `preparing`, `out_for_delivery`, `delivered`, `cancelled`).

---

## 4. Sub-Resource Route Filtering
- `GET /api/v1/restaurants/:id/menu` MUST return only menu items whose `restaurantId` matches the specified `:id`.
