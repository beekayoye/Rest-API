# Food Delivery API — Validation & ID Format Rules

These rules govern request validation using Zod, primary key format conventions, and pre-database ID validation.

---

## 1. Resource ID Format Convention

All resource primary keys follow a strict prefixed hex format:
`^<prefix>_[0-9a-f]{24}$` (Total length: prefix + 1 underscore + 24 hex characters).

### Resource Prefix Map:
| Resource | Prefix | Example ID |
|---|---|---|
| Restaurant | `rest` | `rest_66eb0a1e5f8d9b1a2c3d4e5f` |
| Menu Item | `menu` | `menu_66eb0a1e5f8d9b1a2c3d4e60` |
| Customer | `cust` | `cust_66eb0a1e5f8d9b1a2c3d4e61` |
| Order | `ord` | `ord_66eb0a1e5f8d9b1a2c3d4e62` |
| Order Item | `item` | `item_66eb0a1e5f8d9b1a2c3d4e63` |

---

## 2. Pre-Database ID Validation (HTTP 400 vs HTTP 404)

Whenever an endpoint receives an ID in the URL parameter (e.g., `GET /api/v1/restaurants/:id`):

1. **Step 1 — Regex Syntax Validation:**
   Validate `:id` against `^<expected_prefix>_[0-9a-f]{24}$` **before executing any SQL query**.
   - If invalid format (e.g. `invalid-id`, `12345`, `wrongprefix_123`):
     - Return **HTTP 400 Bad Request** immediately.
     - `error.code = "BAD_REQUEST"`
     - `error.message = "Invalid id format for <resource>. Expected format: <prefix>_<24 hex characters>"`

2. **Step 2 — Database Query Lookup:**
   If the ID matches the syntax pattern, perform the database lookup.
   - If no matching row is found:
     - Return **HTTP 404 Not Found**.
     - `error.code = "NOT_FOUND"`
     - `error.message = "<Resource> with id <id> not found"`

---

## 3. Request Body Validation with Zod (HTTP 422)

All `POST`, `PUT`, and `PATCH` endpoints must validate the request body through Zod schemas.

- **Missing or Invalid Fields:**
  If validation fails, return **HTTP 422 Unprocessable Entity**.
  - `error.code = "VALIDATION_ERROR"`
  - `error.message = "Validation failed for request body"`
  - `error.details = Array<{ field: string, message: string }>` naming each failed field.

### Example 422 Response:
```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Validation failed for request body",
    "details": [
      {
        "field": "name",
        "message": "Required"
      },
      {
        "field": "priceLevel",
        "message": "Expected integer between 1 and 4"
      }
    ]
  }
}
```

---

## 4. Domain & Relational Validation Rules

### A. Server-Computed Order Totals
- On `POST /api/v1/orders`, the server MUST calculate `totalCents` by multiplying `quantity` by each `menu_item`'s current `price_cents` fetched from the database at order time.
- Any client-submitted `totalCents` or `total` in the request body MUST be strictly ignored.

### B. Menu Item Restaurant Ownership
- On `POST /api/v1/orders`, the server MUST verify that every `menuItemId` in `items` belongs to the specified `restaurantId`.
- If any menu item belongs to a different restaurant:
  - Return **HTTP 422 Unprocessable Entity**.
  - `error.code = "VALIDATION_ERROR"`
  - `error.message = "Menu item <id> does not belong to restaurant <restaurantId>"`.

### C. Foreign Key Reference Deletion Conflict
- When attempting `DELETE /api/v1/restaurants/:id`:
  - If existing orders reference that restaurant, return **HTTP 409 Conflict** (`error.code = "CONFLICT"`), **NOT HTTP 500**.
