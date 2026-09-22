import { z } from 'zod';
import config from '../config/index.js';
import ApiError from './apiError.js';

/**
 * Validates and parses list query parameters using Zod.
 * 
 * Rules:
 * - limit: optional positive integer (> 0). Invalid/negative/0/non-numeric returns 400.
 *   If valid and > config.pagination.maxLimit, clamps silently to maxLimit.
 * - offset: optional non-negative integer (>= 0). Negative/non-numeric returns 400.
 * - sort: optional, must be one of Object.keys(sortMap). Unsupported values return 400 listing allowed values.
 * - order: optional 'asc' | 'desc' (case-insensitive). Defaults to 'asc'.
 * - filters: additional Zod schema or schema shape for resource-specific query filters.
 * 
 * @param {object} rawQuery - Express req.query object
 * @param {object} options
 * @param {Record<string, string>} [options.sortMap={}] - Mapping from public sort field to SQL column name
 * @param {string} [options.defaultSort] - Default public sort field when omitted
 * @param {string} [options.defaultOrder='asc'] - Default sort order ('asc' | 'desc')
 * @param {z.ZodRawShape|z.ZodObject<any>} [options.filters={}] - Zod filter definitions
 * @returns {{ limit: number, offset: number, sortField: string, sortColumn: string, order: 'ASC'|'DESC', sortClause: string, filters: object }}
 */
export function parseListQuery(rawQuery = {}, { sortMap = {}, defaultSort, defaultOrder = 'asc', filters = {} } = {}) {
  const allowedSortKeys = Object.keys(sortMap);
  const effectiveDefaultSort = defaultSort || (allowedSortKeys.length > 0 ? allowedSortKeys[0] : undefined);

  // Helper for numeric integer query string validation
  const limitSchema = z.preprocess((val) => {
    if (val === undefined || val === null || val === '') return undefined;
    const num = Number(val);
    return isNaN(num) ? val : num;
  }, z.number({
    invalid_type_error: 'limit must be a positive integer',
  }).int('limit must be an integer').positive('limit must be a positive integer greater than 0').optional());

  const offsetSchema = z.preprocess((val) => {
    if (val === undefined || val === null || val === '') return undefined;
    const num = Number(val);
    return isNaN(num) ? val : num;
  }, z.number({
    invalid_type_error: 'offset must be a non-negative integer',
  }).int('offset must be an integer').nonnegative('offset must be greater than or equal to 0').optional());

  // Build sort schema
  let sortSchema;
  if (allowedSortKeys.length > 0) {
    sortSchema = z.string().refine((val) => allowedSortKeys.includes(val), {
      message: `Invalid sort field. Allowed values: ${allowedSortKeys.join(', ')}`,
    }).optional();
  } else {
    sortSchema = z.string().optional();
  }

  // Build order schema
  const orderSchema = z.string().optional().transform((val) => {
    if (!val) return defaultOrder.toUpperCase() === 'DESC' ? 'DESC' : 'ASC';
    const lower = val.toLowerCase();
    if (lower !== 'asc' && lower !== 'desc') {
      throw new Error("order must be 'asc' or 'desc'");
    }
    return lower === 'desc' ? 'DESC' : 'ASC';
  });

  // Combine into complete schema
  const filterShape = filters instanceof z.ZodObject ? filters.shape : filters;

  const querySchema = z.object({
    limit: limitSchema,
    offset: offsetSchema,
    sort: sortSchema,
    order: orderSchema,
    ...filterShape,
  });

  const result = querySchema.safeParse(rawQuery);

  if (!result.success) {
    const details = result.error.errors.map((issue) => {
      const field = issue.path.length > 0 ? issue.path.join('.') : 'query';
      return {
        field,
        message: issue.message,
      };
    });

    throw ApiError.badRequest('Invalid query parameters', details);
  }

  const data = result.data;

  // 1. Process Limit (Default & Silent Clamp)
  let limit = config.pagination.defaultLimit;
  if (data.limit !== undefined) {
    limit = Math.min(data.limit, config.pagination.maxLimit);
  }

  // 2. Process Offset (Default)
  const offset = data.offset !== undefined ? data.offset : 0;

  // 3. Process Sort & Column Mapping
  const sortField = data.sort || effectiveDefaultSort;
  const sortColumn = sortMap[sortField] || sortField;
  const order = data.order || 'ASC';

  const sortClause = sortColumn ? `${sortColumn} ${order}` : '';

  // 4. Extract Filter Values
  const filterValues = {};
  for (const key of Object.keys(filterShape)) {
    if (data[key] !== undefined) {
      filterValues[key] = data[key];
    }
  }

  return {
    limit,
    offset,
    sortField,
    sortColumn,
    order,
    sortClause,
    filters: filterValues,
  };
}

/**
 * Builds standard pagination metadata object
 * 
 * @param {object} params
 * @param {number} params.total - Total record count matching query
 * @param {number} params.limit - Applied page limit
 * @param {number} params.offset - Applied page offset
 * @returns {{ total: number, limit: number, offset: number, hasMore: boolean }}
 */
export function buildMeta({ total, limit, offset }) {
  return {
    total,
    limit,
    offset,
    hasMore: offset + limit < total,
  };
}
