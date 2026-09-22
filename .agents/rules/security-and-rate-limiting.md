# Food Delivery API — Security, Rate Limiting & Abuse Containment

These rules specify the security boundaries, rate limiting configurations, and write-token containment policies for the API.

---

## 1. Rate Limiting Configuration

- **Library:** `express-rate-limit`.
- **Keying:** Keyed by client IP address (`req.ip`).
- **Configuration:** Limits and window sizes MUST be loaded from environment variables via `config/index.js`, never hardcoded in middleware.
  - Default rate limit: `100` requests per minute per IP.
  - Exceeding limit response:
    - **HTTP 429 Too Many Requests**
    - `error.code = "TOO_MANY_REQUESTS"`
    - `error.message = "Too many requests. Please try again later."`
    - Must include standard `Retry-After` header.

---

## 2. Write Abuse Containment (Write-Token Mechanism)

Because the API does not use full identity/account authentication in v1, write endpoints (`POST`, `PATCH`, `PUT`, `DELETE`) are protected using a lightweight **Write-Token Mechanism**:

1. **Token Generation on Creation:**
   When a client creates a new row (`POST /api/v1/{resource}`), the server generates a cryptographically random write-token for that resource row and returns it in the response (or `X-Write-Token` header).
2. **Token Verification on Modification/Deletion:**
   When a client requests `PATCH`, `PUT`, or `DELETE` on a resource, the client must provide the matching `X-Write-Token` header or query token.
   - If the token does not match: Return **HTTP 403 Forbidden** (`error.code = "FORBIDDEN"`, `error.message = "Invalid or missing write token for this resource"`).
3. **Public Reads Remain Open:**
   `GET` list and detail endpoints require NO token or authentication and remain completely public.

---

## 3. CORS & Injection Defense

- **CORS:** Enabled for all origins (`*`) since the API is designed to be publicly accessible by prototype clients and web applications.
- **SQL Injection Prevention:** Strictly enforce parameterized queries for all query parameters and values.
- **Concurrent Writes:** In v1, concurrent updates follow last-write-wins (LWW) without row locking, as specified in PRD Functional Requirement 16.
