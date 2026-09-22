# Food Delivery API — Product Requirements Document

*Revision 2. Rewritten after a structured review (Skeptic / Author / Engineer / Product Lead / Judge) found 14 lapses in revision 1. All 14 corrections are applied below. Nothing else was changed.*

---

## 1. Product Summary

The Food Delivery API is a versioned REST API that serves restaurant, menu, customer, and order data for a food-delivery domain, plus a minimal web client that consumes it live. It is built for developers who need a realistic, relational backend to build against without writing one from scratch: a hackathon builder, a student proving API fundamentals, or an engineer prototyping a food-ordering UI. The API is public, read-heavy, and every list endpoint supports pagination, filtering, and sorting; every response follows one consistent envelope and every error uses an honest HTTP status code.

It exists first as a working proof that the data model and API surface are sound: the v1 build is deployed and callable from outside its own codebase. Whether external developers actually want to build against it is untested and unproven, not assumed. This PRD defines what the same product needs to become a real, safely-operated service rather than a portfolio demo, and where it currently falls short of that.

---

## 2. Problem Statement

Developers building food-delivery-style products, whether a student project, a hackathon prototype, or an internal tool that needs a realistic backend, lack a simple, well-documented, publicly reachable API with genuine relational data: restaurants that have menus, customers that place orders, orders that reference both. Generic public APIs such as JSONPlaceholder or DummyJSON solve the reachability problem but not the domain problem, their data has no food-delivery-specific relationships to filter, sort, or join against. Building a bespoke backend for every prototype burns the available time budget on plumbing, pagination, validation, rate limiting, error handling, instead of the feature the prototype was meant to test. This product removes that cost by being a real, deployed, documented API purpose-built for the food-delivery domain, with the plumbing already correct and provably tested against bad input.

**This problem statement is a hypothesis, not a validated need. No user research has been done.**

---

## 3. Goals and Non-Goals

**Goals (v1)**

- Serve four related resources (restaurants, menu items, customers, orders) with correct pagination, filtering, and sorting on every list endpoint.
- Return one consistent success envelope and one consistent error envelope, with honest HTTP status codes, on every endpoint.
- Rate-limit unauthenticated traffic by IP, with the limit stored in configuration, not hardcoded.
- Contain anonymous write abuse with a lightweight write-token mechanism: a client can only modify or delete rows it created, without requiring full identity-based authentication. *(Added in this revision — see Risks, Mitigation for Risk 1.)*
- Deploy to a public URL and document it well enough that a new developer never has to ask the author a question.
- Ship a minimal consumer web app that proves the API works from outside its own codebase.

**Non-Goals (v1)**

- No identity-based authentication (no user accounts, no login, no OAuth). Any client can still read and create new rows without an account; the write-token goal above limits who can *modify or delete* a given row, it is not a login system.
- No real payment processing or money movement of any kind.
- No restaurant-owner onboarding flow or vendor dashboard.
- No mobile app.
- No AI or ML features.
- No multi-tenancy; this is a single shared public dataset, not per-account data isolation. (This changes in v3 — see Phased Roadmap.)

---

## 4. User Personas

| Persona | Role | Needs | Current frustration |
| --- | --- | --- | --- |
| Dara, Prototype Developer | Student or hackathon builder | A working, realistic backend fast, so effort goes into the feature being tested, not the plumbing | Has to build a full CRUD API from scratch just to test a frontend idea |
| The Maintainer | Engineer extending the API later | To add a field or a new endpoint without breaking anyone already calling v1 | Undocumented breaking changes and APIs with no versioning story |

*A third, non-recurring role exists during grading: an evaluator checking this PRD and the API against a fixed rubric. Not a persona — a one-time audience, not an ongoing user type.*

---

## 5. Functional Requirements

1. `GET /api/v1/{resource}` returns a paginated list wrapped as `{data, meta}`, with `meta` containing `total`, `limit`, `offset`, and `hasMore`.
2. When `limit` is omitted, the default is 20. When `limit` exceeds 100, the response is served with `limit` clamped to 100, not rejected.
3. A `limit` of 0, negative, or non-numeric returns HTTP 400 naming the field — the same treatment as a negative offset. A missing `limit` still defaults to 20. *(Added in this revision.)*
4. A request with `offset` below 0 returns HTTP 400, `error.code = BAD_REQUEST`, and a message naming `offset`.
5. A request with an unsupported `sort` value returns HTTP 400 and a message listing the allowed sort values for that resource.
6. `GET /api/v1/{resource}/:id` returns HTTP 404 with `error.code = NOT_FOUND` when `:id` is well-formed but no matching row exists.
7. `GET /api/v1/{resource}/:id` returns HTTP 400 when `:id` does not match that resource's id pattern (`<prefix>_[0-9a-f]{24}`), before any database lookup runs.
8. `POST /api/v1/{resource}` with a missing required field returns HTTP 422, `error.code = VALIDATION_ERROR`, and a `details` array naming every missing or invalid field.
9. `POST /api/v1/orders` computes `totalCents` on the server from each menu item's current price at order time; any client-supplied total is ignored.
10. `POST /api/v1/orders` rejects, with HTTP 422, an order whose `menuItemId` does not belong to the specified `restaurantId`.
11. `DELETE /api/v1/restaurants/:id` returns HTTP 409 (`CONFLICT`), not HTTP 500, when existing orders still reference that restaurant.
12. A client sending more requests than the configured rate limit within the configured window receives HTTP 429 with a `Retry-After` header.
13. Every error response, on every endpoint, matches the shape `{error: {code, message, details?}}` with no exceptions.
14. Running the seed script twice against the same database leaves row counts identical in every table (idempotent, no duplication).
15. `GET /api/v1/restaurants/:id/menu` returns only menu items whose `restaurantId` equals the requested `:id`.
16. Concurrent updates to the same order use last-write-wins with no locking or conflict detection in v1. This is a stated limitation, not an oversight. *(Added in this revision.)*
17. The API logs, at minimum, timestamp, method, path, status code, and a hashed IP per request — sufficient to compute the Success Metrics in section 11 without new instrumentation later. *(Added in this revision.)*

---

## 6. AI Processing Pipeline

Not applicable to v1. The product has no AI or ML component: no model inference, no embeddings, no generated content, no natural-language processing anywhere in the request path. If a future version adds an AI-assisted feature, such as semantic search over restaurants or a natural-language ordering flow, this section will be rewritten at that time to define its input, the model or method used, its output, and its failure modes.

---

## 7. Technical Requirements

**Stack deviation from the locked default.** The locked stack calls for TypeScript and Prisma. The actual v1 implementation uses plain JavaScript (ESM, Node 22) with raw parameterized SQL through the `pg` driver instead of Prisma; Zod is used for validation, matching the locked stack on that point. The deviation happened because the Prisma release available at build time was an unstable pre-release major version with a changing CLI, an unacceptable risk for a graded, reproducible deliverable. Whether to migrate to Prisma is listed as an open question, and the Prisma Data Model section below is written to the locked-stack standard regardless of what v1 actually runs.

- **Runtime:** Node.js 20+, Express 4.
- **Database:** PostgreSQL 16, one schema, five tables (`restaurants`, `menu_items`, `customers`, `orders`, `order_items`).
- **Validation:** one Zod schema per resource per route file, covering both query parameters and request bodies.
- **API style:** REST, versioned at `/api/v1`, JSON only.
- **Rate limiting:** `express-rate-limit`, keyed by IP, values sourced from environment variables through `config/index.js`, never hardcoded in a handler.
- **Hosting:** Railway is the primary recommendation, for its combined managed Postgres and auto-deploy from GitHub; Render and Fly.io are documented fallbacks.
- **Data flow:** client → Express router → Zod validation → parameterized SQL query → Postgres → response serializer (snake_case to camelCase) → envelope → JSON.
- **Third-party integrations:** none in v1. No payment gateway, no email, no SMS.
- **Performance target (unverified):** p95 latency under 300ms on list endpoints at seed-scale (about 200 restaurants, 1,700 menu items, 400 orders). This is a design goal, not a tested requirement, until a real load test exists. *(Reworded in this revision — previously stated as if verified.)*
- **Security:** no identity-based authentication in v1, by design (see Non-Goals); SQL injection is prevented by parameterized queries and a sort-field allowlist, never string-concatenated identifiers; CORS is open to all origins since the API is intentionally public. **Open CORS combined with unauthenticated writes (see Non-Goals, and Risk 1 in section 9) means any web page can trigger writes against this API from a visitor's browser without their knowledge. This compounds Risk 1 and should be read together with it.** *(Added in this revision.)*

---

## 8. Business Model

No monetization in v1. The API is free and public: no API keys, no usage tiers, no billing. If this becomes a real product, three monetization paths are available and none is evaluated yet: metered per-request API access, a paid tier with a higher rate limit than the free 100 requests per minute, or a platform commission on real orders once real restaurants and real payments exist. **No path is chosen because no path can be chosen responsibly before Open Question 1 (is this a real business or a permanent demo) is answered. This section is blocked on that question, not simply undecided.** *(Added in this revision.)*

---

## 9. Risks

| Risk | Type | Impact if it happens | Mitigation |
| --- | --- | --- | --- |
| No identity auth on write endpoints; anyone can create, edit, or delete any restaurant, menu item, customer, or order | Technical / Security | The public dataset can be vandalized within hours of real traffic | **Ships in v1, not v2: the write-token mechanism (see Goals) limits modification and deletion to the client that created a row. Full identity-based auth still waits for v2.** *(Added in this revision.)* |
| Single shared Postgres instance with no backup strategy defined | Technical | Data loss on instance failure; the seed script rebuilds synthetic data but any real user-generated data would be gone for good | Accepted for v1. No backup plan scheduled; revisit if real user data is ever introduced. |
| Free-tier hosting may sleep, throttle, or delete the database after inactivity | Operational | The live URL used for grading or demos stops responding without warning | Accepted for v1. A paid tier is an open question (see section 14) if reliability becomes a requirement. |
| Rate-limit store is in-memory (the `express-rate-limit` default) | Technical | The limit resets on every deploy or restart, and does not work correctly across more than one server instance | Accepted for v1, single-instance deployment only. A shared store (e.g. Redis) is required before this product runs on more than one instance. |
| The entire "market" is synthetic; no real restaurants exist | Market / Product | Not a viable business without a separate vendor-onboarding workstream, which this PRD does not cover | Accepted for v1. Vendor onboarding is out of scope until Open Question 1 is answered in favor of a real business. |

---

## 10. Prisma Data Model

**⚠️ WARNING: this schema is not deployed. v1 runs on raw SQL against a hand-written `schema.sql`. Do not write Prisma client code against production until a real migration exists.** *(Strengthened from a soft caveat in this revision.)*

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

enum OrderStatus {
  pending
  confirmed
  preparing
  out_for_delivery
  delivered
  cancelled
}

model Restaurant {
  id          String     @id
  name        String
  cuisine     String
  description String?
  address     String
  city        String
  rating      Decimal    @default(0) @db.Decimal(2, 1)
  priceLevel  Int        @map("price_level")
  imageUrl    String?    @map("image_url")
  createdAt   DateTime   @default(now()) @map("created_at")
  menuItems   MenuItem[]
  orders      Order[]

  @@index([cuisine])
  @@index([city])
  @@map("restaurants")
}

model MenuItem {
  id           String      @id
  restaurantId String      @map("restaurant_id")
  restaurant   Restaurant  @relation(fields: [restaurantId], references: [id], onDelete: Cascade)
  name         String
  description  String?
  category     String
  priceCents   Int         @map("price_cents")
  isAvailable  Boolean     @default(true) @map("is_available")
  createdAt    DateTime    @default(now()) @map("created_at")
  orderItems   OrderItem[]

  @@index([restaurantId])
  @@index([category])
  @@map("menu_items")
}

model Customer {
  id        String   @id
  name      String
  email     String   @unique
  phone     String?
  createdAt DateTime @default(now()) @map("created_at")
  orders    Order[]

  @@map("customers")
}

model Order {
  id              String      @id
  restaurantId    String      @map("restaurant_id")
  restaurant      Restaurant  @relation(fields: [restaurantId], references: [id])
  customerId      String      @map("customer_id")
  customer        Customer    @relation(fields: [customerId], references: [id])
  status          OrderStatus @default(pending)
  deliveryAddress String      @map("delivery_address")
  totalCents      Int         @default(0) @map("total_cents")
  createdAt       DateTime    @default(now()) @map("created_at")
  updatedAt       DateTime    @updatedAt @map("updated_at")
  items           OrderItem[]

  @@index([restaurantId])
  @@index([customerId])
  @@index([status])
  @@map("orders")
}

model OrderItem {
  id             String   @id
  orderId        String   @map("order_id")
  order          Order    @relation(fields: [orderId], references: [id], onDelete: Cascade)
  menuItemId     String   @map("menu_item_id")
  menuItem       MenuItem @relation(fields: [menuItemId], references: [id])
  quantity       Int
  unitPriceCents Int      @map("unit_price_cents")

  @@map("order_items")
}
```

*(`@@index` lines added in this revision on the fields named as filter/sort targets in sections 5 and 7 — previously absent, which would have regressed the performance target on first migration.)*

---

## 11. Success Metrics

**v1 (demo / grading scope)**

- 100% of list endpoints support `limit`, `offset`, `sort`, and at least two filters, verified by manual and scripted curl checks.
- 0 of the documented bad-input cases (oversized limit, zero/negative/non-numeric limit, negative offset, bad sort, malformed id, missing required field) return HTTP 500.
- The live API returns HTTP 200 to at least one request made from a device that never touched the build machine.
- A second person, given only the README, successfully completes 3 example curl calls with no additional help.

**If productized beyond v1**

- Monthly active API consumers (unique hashed IPs or keys in a trailing 30-day window).
- p95 latency under 300ms, measured continuously, not just at seed-scale.
- Uptime at or above 99%, measured monthly.
- 429 responses under 1% of total request volume, meaning the rate limit is protective rather than actively blocking normal use.

*All four post-v1 metrics depend on Functional Requirement 17 (request logging), added in this revision. Before that requirement ships, these four metrics are not measurable.*

---

## 12. Assumptions

| # | Assumption | Tag |
| --- | --- | --- |
| 1 | The product targets developers and prototypers, not real restaurant vendors or diners, in v1 | Default assumption |
| 2 | All data is synthetic (Faker-generated); no real personal data is collected or stored | Default assumption |
| 3 | Write endpoints stay free of identity-based auth permanently, versus gaining it before any real use | Needs confirmation |
| 4 | The product migrates from raw SQL (`pg`) to Prisma to match the locked stack, versus keeping the current implementation | Needs confirmation |
| 5 | No AI component exists or is planned for v1 | Default assumption |
| 6 | No monetization in v1; the business model beyond that is unresolved | Default assumption |
| 7 | A single-region, single-instance Postgres is sufficient for expected v1 traffic (demo-scale, not production-scale) | **Needs confirmation** — *retagged in this revision. This was previously marked a default assumption despite section 7 stating traffic was never load-tested; it will remain unconfirmed until real traffic data or a load test exists.* |
| 8 | Railway is the target hosting platform | Needs confirmation |
| 9 | 100 requests per minute per IP is an appropriate rate limit for a public demo API; not benchmarked against real usage | Default assumption |
| 10 | This PRD describes evolving the existing repository, versus planning a from-scratch rebuild on the locked stack | Needs confirmation |

---

## 13. Phased Roadmap

| Phase | Scope | Rationale |
| --- | --- | --- |
| v1 (shipped) | Public REST API across 4 resources, pagination, filtering, sorting, rate limiting, write-token abuse containment, idempotent seed script, minimal consumer app, deployed on a free-tier host. No identity auth, no payments, no AI | Prove the data model and API surface end to end before spending effort on anything that depends on them |
| v2 | API-key authentication for write endpoints, replacing the write-token mechanism; per-key rate limits replace pure IP-based limiting; automated test suite and CI, replacing today's manual curl verification | Writes are the actual abuse surface; locking them down further is cheaper than building broader auth before it's needed |
| v3 | A real vendor-facing flow so restaurant owners manage their own menu through authenticated endpoints, replacing today's fully-open writes; a cursor-based endpoint for order-status changes to support a kitchen-display-style consumer polling for new orders. **This phase introduces the product's first data-isolation boundary between restaurant owners — the beginning of multi-tenancy the v1 Non-Goals explicitly excluded.** *(Clause added in this revision.)* | Only worth building once v2 proves the API can be safely written to by more than one trusted party |
| v4 | Evaluate real payment integration and a genuine business model | Only after v2 and v3 prove real demand beyond the demo and portfolio use case; building payments before that is pure risk with no evidence of need |

---

## 14. Open Questions

*Reordered in this revision: question 1 below was previously question 3. It is listed first because questions 3, 5, 6, and 7 below cannot be answered correctly until this one is.*

1. Is there an intended real business behind this, with real restaurants, real orders, real money, or does it stay a permanent public demo API?
2. Should the project migrate from raw SQL to Prisma to match the locked stack, or is the current implementation the accepted long-term approach?
3. Should write endpoints ever require identity-based authentication beyond the v1 write-token containment, and if so, by what method: API keys, OAuth, or session-based login?
4. Is the v1 write-token mechanism (Goals, section 3) an acceptable interim containment, or does it need to ship before this PRD is considered complete?
5. If monetized, what is the pricing model: metered API access, tiered plans, or order commission?
6. What is the permanent target hosting platform, Railway, Render, or Fly, and is a free tier acceptable long-term or does this need a paid plan for reliability?
7. Should there ever be an AI feature, such as search, recommendations, or natural-language ordering, and if so, which one is worth building first?
8. What is the actual target scale in requests per day and dataset size, since v1 has never been load-tested beyond its seeded 200 restaurants and 400 orders?

---

## Changelog from Revision 1

Applied all 14 corrections from the structured review:

1. Product Summary — dropped unearned demand claim, stated adoption as untested.
2. Problem Statement — added explicit "hypothesis, not validated" line.
3. Goals/Non-Goals — added v1 write-token containment goal; clarified non-goal scope.
4. Personas — removed "The Reviewer" from the table, moved to a footnote.
5. Functional Requirements — added bad-`limit` handling (item 3) and concurrent-write behavior (item 16).
6. AI Processing Pipeline — unchanged, confirmed correct as "not applicable."
7. Technical Requirements — reworded performance target as unverified; added CORS + open-writes compounding note.
8. Business Model — added explicit block on Open Question 1.
9. Risks — added a Mitigation column to every row.
10. Prisma Data Model — strengthened the "not deployed" warning; added missing `@@index` declarations.
11. Success Metrics — added dependency note on the new logging requirement (Functional Requirement 17).
12. Assumptions — retagged assumption 7 from "Default" to "Needs confirmation."
13. Phased Roadmap — named v3 as the start of multi-tenancy explicitly.
14. Open Questions — reordered so the business-vs-demo question leads, with a note explaining why.
