# Food Delivery API — API Design & Response Envelopes

These rules define the REST routing conventions, versioning, HTTP status codes, and mandatory response structures across all endpoints.

---

## 1. REST API Routing & Versioning

- **Base Path:** All API routes must be versioned and mounted under `/api/v1/`.
- **Resources:**
  - `/api/v1/restaurants`
  - `/api/v1/menu-items`
  - `/api/v1/customers`
  - `/api/v1/orders`
  - `/api/v1/restaurants/:id/menu` (sub-resource route returning only menu items for that specific restaurant)

---

## 2. Response Envelopes (Mandatory)

Every endpoint MUST return JSON wrapped in one of the standard envelopes.

### A. List Response Envelope (`{ data, meta }`)
List endpoints must return an object with `data` array and a `meta` pagination object:

```json
{
  "data": [
    {
      "id": "rest_0123456789abcdef01234567",
      "name": "Golden Wok",
      "cuisine": "Chinese",
      "city": "San Francisco",
      "rating": 4.5,
      "priceLevel": 2,
      "imageUrl": "https://images.example.com/golden-wok.jpg",
      "createdAt": "2026-09-18T10:00:00.000Z"
    }
  ],
  "meta": {
    "total": 120,
    "limit": 20,
    "offset": 0,
    "hasMore": true
  }
}
```

### B. Single Resource Success Envelope (`{ data }`)
Single-entity endpoints (`GET /:id`, `POST /`, `PATCH /:id`) return an object wrapping the resource:

```json
{
  "data": {
    "id": "ord_0123456789abcdef01234567",
    "restaurantId": "rest_0123456789abcdef01234567",
    "customerId": "cust_0123456789abcdef01234567",
    "status": "pending",
    "deliveryAddress": "123 Market St, San Francisco, CA",
    "totalCents": 3450,
    "createdAt": "2026-09-18T10:05:00.000Z",
    "updatedAt": "2026-09-18T10:05:00.000Z",
    "items": [
      {
        "id": "item_0123456789abcdef01234567",
        "menuItemId": "menu_0123456789abcdef01234567",
        "quantity": 2,
        "unitPriceCents": 1250
      }
    ]
  }
}
```

---

## 3. Error Envelope (`{ error }`)

Every error response across the entire API, without exception, must match this exact shape:

```json
{
  "error": {
    "code": "ERROR_CODE_STRING",
    "message": "Human-readable description of what went wrong",
    "details": [
      {
        "field": "email",
        "message": "Invalid email address format"
      }
    ]
  }
}
```
*(Note: `details` is optional, used primarily for validation errors).*

---

## 4. Honest HTTP Status Codes

Do not mask errors or return generic 200/500 codes. Use honest HTTP statuses:

| Status Code | Error Code (`error.code`) | When to Use |
|---|---|---|
| **200 OK** | *(N/A)* | Successful `GET`, `PATCH`, `PUT`, or `DELETE` with payload |
| **201 Created** | *(N/A)* | Successful `POST` creating a resource |
| **204 No Content** | *(N/A)* | Successful `DELETE` returning no body |
| **400 Bad Request** | `BAD_REQUEST` | Malformed URL ID syntax, negative offset, non-numeric/negative limit, or invalid sort field |
| **404 Not Found** | `NOT_FOUND` | Valid ID syntax, but row does not exist in the database |
| **409 Conflict** | `CONFLICT` | Deleting a restaurant or customer still referenced by active orders |
| **422 Unprocessable** | `VALIDATION_ERROR` | Missing required body fields, invalid body types, or business rule violation (e.g. menu item not in restaurant) |
| **429 Too Many Req** | `TOO_MANY_REQUESTS`| Client exceeded rate limit window (must include `Retry-After` header) |
| **500 Internal Error**| `INTERNAL_SERVER_ERROR`| Unforeseen server crash or database failure (never returned for bad client input) |
