# Food Delivery API — Project Agent Rules

This repository contains the Food Delivery API project defined in [`Docs/food-delivery-api-prd.md`](./Docs/food-delivery-api-prd.md).

For detailed agent operating guidelines, see [`Docs/AGENTS.md`](./Docs/AGENTS.md).

## Customization Rules Location
All project-specific behavioral rules are structured in [`.agents/rules/`](./.agents/rules/):

1. [`.agents/rules/architecture-and-stack.md`](./.agents/rules/architecture-and-stack.md) — Node.js 20+ (ESM), Express 4, PostgreSQL 16 (`pg`), Zod.
2. [`.agents/rules/api-design-and-envelopes.md`](./.agents/rules/api-design-and-envelopes.md) — Standard response envelopes (`{ data, meta }`, `{ error }`) and HTTP status codes.
3. [`.agents/rules/pagination-filtering-sorting.md`](./.agents/rules/pagination-filtering-sorting.md) — Limit (default 20, max clamp 100), offset, sort allowlists, and filtering.
4. [`.agents/rules/validation-and-id-rules.md`](./.agents/rules/validation-and-id-rules.md) — Prefixed ID format (`<prefix>_[0-9a-f]{24}`), pre-DB 400 vs 404 validation, Zod 422 errors.
5. [`.agents/rules/database-and-seed-rules.md`](./.agents/rules/database-and-seed-rules.md) — PostgreSQL 16 schema, parameterized queries, snake_case vs camelCase, idempotent seed script.
6. [`.agents/rules/security-and-rate-limiting.md`](./.agents/rules/security-and-rate-limiting.md) — IP rate limiting, write-token abuse containment, CORS, SQL injection prevention.
7. [`.agents/rules/error-handling-and-logging.md`](./.agents/rules/error-handling-and-logging.md) — Zero 500s on bad input, centralized error handler, structured request logging.
8. [`.agents/rules/testing-and-verification.md`](./.agents/rules/testing-and-verification.md) — Integration test suite requirements and command.
