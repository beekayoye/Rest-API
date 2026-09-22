/**
 * ============================================================================
 * Central Application Configuration
 * ============================================================================
 * 
 * WHY CONFIGURATION VALUES LIVE HERE AND NOT INLINE:
 * 
 * Centralizing all ports, limits, pagination defaults, and rate limits in this
 * file ensures that every operational threshold is sourced from environment
 * variables.
 * 
 * Modifying limits (e.g. tuning rate limits under load, scaling page sizes,
 * or changing ports across hosting environments like Railway, Render, or Fly)
 * is purely an environment variable configuration change on the hosting platform,
 * NEVER requiring a code change, rebuild, or redeployment.
 * 
 * This is the ONLY file in the entire codebase where default fallback numbers
 * are defined. Every other module, middleware, and route handler must import
 * and reference these values from here.
 * ============================================================================
 */

import dotenv from 'dotenv';

dotenv.config();

const config = {
  port: parseInt(process.env.PORT, 10) || 3000,
  databaseUrl: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/food_delivery',
  pagination: {
    defaultLimit: parseInt(process.env.PAGINATION_DEFAULT_LIMIT, 10) || 20,
    maxLimit: parseInt(process.env.PAGINATION_MAX_LIMIT, 10) || 100,
  },
  rateLimit: {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS, 10) || 60000,
    max: parseInt(process.env.RATE_LIMIT_MAX, 10) || 100,
  },
};

export default config;
