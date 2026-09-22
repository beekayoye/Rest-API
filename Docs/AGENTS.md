# Food Delivery API — Agent Operating Guidelines

This document provides system instructions and domain context for all AI agents contributing to the Food Delivery API project.

---

## 📖 Project Context

- **PRD Reference:** [`Docs/food-delivery-api-prd.md`](./food-delivery-api-prd.md) (Revision 2).
- **Core Purpose:** A public, versioned (`/api/v1`) REST API serving relational food-delivery domain data (restaurants, menu items, customers, orders, order items) designed for developers prototyping frontends or testing integrations.
- **Design Philosophy:** Consistent envelopes, honest HTTP status codes, zero HTTP 500 errors on invalid input, and strict relational integrity.

---

## 🏛️ Rule Directory & Loading

All agents operating in this repository must strictly adhere to the rules defined in the [`.agents/rules/`](../.agents/rules/) directory:

| Rule File | Scope & Highlights |
|---|---|
| [`architecture-and-stack.md`](../.agents/rules/architecture-and-stack.md) | Node.js 20+ (ESM), Express 4, PostgreSQL 16 (`pg`), Zod, unidirectional layered architecture. |
| [`api-design-and-envelopes.md`](../.agents/rules/api-design-and-envelopes.md) | Standard response envelopes (`{ data, meta }` and `{ error }`), honest HTTP status codes (200, 201, 400, 404, 409, 422, 429). |
| [`pagination-filtering-sorting.md`](../.agents/rules/pagination-filtering-sorting.md) | Default limit (20), clamp > 100 to 100, negative limit/offset -> 400, sort allowlists, domain filtering. |
| [`validation-and-id-rules.md`](../.agents/rules/validation-and-id-rules.md) | `<prefix>_[0-9a-f]{24}` format, pre-DB ID validation (400 vs 404), Zod body validation (422 with details). |
| [`database-and-seed-rules.md`](../.agents/rules/database-and-seed-rules.md) | PostgreSQL 16 schema, parameterized queries, snake_case DB to camelCase API serialization, idempotent seeding. |
| [`security-and-rate-limiting.md`](../.agents/rules/security-and-rate-limiting.md) | IP-based rate limiting via config, write-token abuse containment, open CORS safety, SQL injection defense. |
| [`error-handling-and-logging.md`](../.agents/rules/error-handling-and-logging.md) | Zero 500s on bad input, centralized error handler, structured request logging (`timestamp`, `method`, `path`, `status`, `hashedIp`). |
| [`testing-and-verification.md`](../.agents/rules/testing-and-verification.md) | Integration test requirements for pagination, filtering, validation, domain constraints, and error codes. |

---

## ⚡ Agent Guardrails & Non-Negotiable Directives

1. **Never return naked JSON arrays or objects:** Always wrap list responses in `{ data, meta }` and single entities in `{ data }`.
2. **Never return raw errors:** Always format errors as `{ error: { code, message, details? } }`.
3. **Never allow SQL injection:** Always use `$1, $2, ...` parameterized placeholders with the `pg` client.
4. **Never trust client-submitted prices or order totals:** Compute `totalCents` on the server using database menu prices.
5. **Always validate IDs before querying the database:** Check regex format first (HTTP 400 on malformed syntax; HTTP 404 only when syntax is valid but row does not exist).
6. **Ensure idempotent seeding:** The database seed script must be safe to execute repeatedly without duplicating data.
