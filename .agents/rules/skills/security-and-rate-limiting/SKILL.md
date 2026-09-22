---
name: security-and-rate-limiting
description: >-
  Configure and verify rate limiting, write-token abuse containment headers, CORS configurations,
  and SQL injection protection mechanisms.
  Use when implementing or updating security middleware, rate limiters, or write-authorization checks.
---

# Security & Rate Limiting Implementation Workflow

This skill outlines how to configure IP-based rate limiting, enforce write-token authorization for mutation endpoints, and maintain strict injection defenses.

---

## 1. Rate Limiter Setup (`src/middleware/rateLimiter.js`)

```javascript
import rateLimit from 'express-rate-limit';
import config from '../config/index.js';

export const apiLimiter = rateLimit({
  windowMs: config.rateLimit.windowMs || 60 * 1000, // 1 minute
  max: config.rateLimit.max || 100, // 100 requests per window
  standardHeaders: true, // Return standard RateLimit headers
  legacyHeaders: false,
  handler: (req, res) => {
    res.status(429).json({
      error: {
        code: 'TOO_MANY_REQUESTS',
        message: 'Too many requests. Please try again later.',
      },
    });
  },
});
```

---

## 2. Write-Token Abuse Containment Middleware (`src/middleware/writeToken.js`)

Because v1 allows unauthenticated public writes, the write-token mechanism ensures only the client that created a row can modify or delete it.

### Workflow:
1. **On Creation (`POST`):**
   - Server generates a 32-character cryptographically secure token (`writeToken = crypto.randomBytes(16).toString('hex')`).
   - Store hash of the token in the database column `write_token_hash`.
   - Return the plaintext `writeToken` in the response body or `X-Write-Token` response header.

2. **On Modification / Deletion (`PATCH`, `PUT`, `DELETE`):**
   - Client sends `X-Write-Token` header.
   - Middleware checks if hash matches database row.
   - If mismatch or missing: Return **HTTP 403 Forbidden** (`error.code = "FORBIDDEN"`).

```javascript
// src/middleware/writeToken.js
import crypto from 'node:crypto';

export function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export function generateWriteToken() {
  return crypto.randomBytes(16).toString('hex');
}

export function verifyWriteToken(storedHash) {
  return (req, res, next) => {
    const providedToken = req.headers['x-write-token'] || req.query.writeToken;
    if (!providedToken || hashToken(providedToken) !== storedHash) {
      return res.status(403).json({
        error: {
          code: 'FORBIDDEN',
          message: 'Invalid or missing write token for this resource.',
        },
      });
    }
    next();
  };
}
```

---

## 3. SQL Injection Defense Checklist

- [ ] Every user value is passed via positional arguments (`$1, $2, ...`).
- [ ] No template string interpolation for user-provided query values (`WHERE name = '${userInput}'` is strictly prohibited).
- [ ] Dynamic table names, column names, and sort directions are checked against static allowlists before insertion into SQL strings.
- [ ] CORS is configured using `cors({ origin: '*' })` to support open public access safely.
