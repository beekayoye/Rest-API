# Food Delivery API — Error Handling & Observability Rules

These rules govern centralized error handling, HTTP status code discipline, and request logging.

---

## 1. Zero 500s on Bad User Input

The API must achieve 100% resilience against bad client input:
- **Zero 500 Internal Server Errors** for any malformed ID, invalid JSON syntax, oversized/negative limits, negative offsets, bad sort parameters, or missing required fields.
- Every client-induced error MUST map to an appropriate 4xx status code (`400`, `404`, `409`, `422`, `429`).

---

## 2. Centralized Error Middleware

All errors caught during request execution must be passed via `next(err)` to a single centralized error-handling middleware:

- Format all uncaught errors into the standard error envelope `{ error: { code, message, details? } }`.
- Log full error stack traces server-side while sanitizing the response payload to avoid leaking internal database error messages to the client.
- Handle JSON parse errors from `express.json()` gracefully with **HTTP 400 Bad Request** (`error.code = "BAD_REQUEST"`).

---

## 3. Structured Request Logging (PRD Requirement 17)

Every incoming HTTP request must be logged in a structured format containing at least:
1. `timestamp`: ISO 8601 timestamp (`new Date().toISOString()`).
2. `method`: HTTP method (`GET`, `POST`, `PATCH`, `DELETE`, etc.).
3. `path`: Request path and normalized route.
4. `statusCode`: HTTP status code returned.
5. `durationMs`: Processing duration in milliseconds.
6. `hashedIp`: SHA-256 (or cryptographic hash) of the client IP address (ensures privacy while enabling unique active consumer metrics calculation).

This logging is mandatory to measure the post-v1 success metrics defined in PRD Section 11.
