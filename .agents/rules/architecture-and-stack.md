# Food Delivery API — Architecture & Tech Stack Rules

These rules govern the architecture, runtime stack, folder structure, and design patterns for the Food Delivery API based on the Product Requirements Document (PRD Revision 2).

---

## 1. Technology Stack

- **Runtime:** Node.js 20+ (using native ECMAScript Modules `import`/`export`, `"type": "module"`).
- **Framework:** Express 4.x.
- **Database:** PostgreSQL 16 accessed using raw parameterized SQL queries with the `pg` driver (Node-Postgres).
- **Validation:** Zod for all request queries, URL parameters, and request bodies.
- **Rate Limiting:** `express-rate-limit`, configurable through environment variables.
- **Environment & Config:** Centralized in `config/index.js` reading from `process.env`. Never hardcode configuration, ports, rate limits, or credentials in handlers.

---

## 2. Layered Architecture & Request Data Flow

Every API endpoint must strictly adhere to the unidirectional data flow:

```
Client Request
      │
      ▼
Express Router (`routes/`)
      │
      ▼
Zod Validation Middleware (`validators/`)  ──► Rejects invalid input immediately with 400/422
      │
      ▼
Controller / Service Layer (`controllers/` / `services/`)
      │
      ▼
Parameterized SQL via `pg` Pool (`db/`)
      │
      ▼
PostgreSQL Database
      │
      ▼
Response Serializer (`utils/serializer.js`)  ──► Transforms snake_case DB columns to camelCase
      │
      ▼
Standard Response Envelope (`utils/envelope.js`) ──► { data, meta? }
      │
      ▼
Client Response (JSON)
```

---

## 3. Directory Layout Standards

When adding or modifying backend files, follow this organization:

```
src/
├── config/             # Environment variables and app configuration
├── db/                 # Postgres connection pool, schema.sql, and query helpers
├── routes/             # Express route declarations mounted under /api/v1
├── validators/         # Zod schemas for request validation (query, params, body)
├── controllers/        # Route controllers managing request/response flow
├── services/           # Business logic and database operations
├── middleware/         # Error handler, rate limiter, request logger, write-token validator
├── utils/              # Envelope formatters, serializers, ID generators
└── app.js (or index.js)# Express app initialization and middleware setup
```

---

## 4. Coding & Module Guidelines

- **Use pure ESM:** Always use `import ... from '...'` and `export`.
- **Pure Async/Await:** Use `async/await` with clean try/catch or an `asyncHandler` wrapper to forward unhandled errors to the central error middleware.
- **No Mock / In-Memory State for Data:** All business data (restaurants, menu items, customers, orders, order items) must persist in PostgreSQL.
- **Configuration Centralization:** Always read config from `config/index.js`.
