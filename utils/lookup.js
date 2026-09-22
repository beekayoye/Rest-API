import pool from '../db/pool.js';
import ApiError from './apiError.js';
import { isValidId } from './ids.js';

/**
 * Validates resource ID format and fetches the database row, or throws the appropriate ApiError:
 * 1. Malformed ID -> throws HTTP 400 (BAD_REQUEST) BEFORE any database query runs.
 * 2. Valid ID format, but row not found -> throws HTTP 404 (NOT_FOUND).
 * 
 * @param {object} options
 * @param {string} options.table - SQL table name
 * @param {string} options.prefix - Expected resource ID prefix (e.g. 'rst', 'mnu', 'cus', 'ord')
 * @param {string} options.id - The ID string to validate and lookup
 * @param {string} [options.resourceName] - Human-readable resource name for error messages
 * @returns {Promise<object>} The retrieved database row
 */
export async function findByIdOrThrow({ table, prefix, id, resourceName }) {
  const name = resourceName || table.replace(/s$/, '').replace(/_/g, ' ');

  // 1. Validate ID format pre-database
  if (!isValidId(prefix, id)) {
    throw ApiError.badRequest(
      `Invalid id format for ${name}. Expected format: ${prefix}_<24 hex characters>`
    );
  }

  // 2. Perform parameterized database query
  const query = `SELECT * FROM ${table} WHERE id = $1 LIMIT 1;`;
  const { rows } = await pool.query(query, [id]);

  if (rows.length === 0) {
    throw ApiError.notFound(`${name.charAt(0).toUpperCase() + name.slice(1)} with id ${id} not found`);
  }

  return rows[0];
}

// Alias for flexible naming
export const findResourceOr404 = (table, prefix, id, resourceName) =>
  findByIdOrThrow({ table, prefix, id, resourceName });

export default findByIdOrThrow;
