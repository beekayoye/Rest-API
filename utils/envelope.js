/**
 * ============================================================================
 * Standard API Response Envelopes
 * ============================================================================
 * 
 * These two functions are the ONLY way any endpoint builds a success response body.
 */

/**
 * Builds standard paginated list response envelope
 * 
 * @param {Array} data - Array of resource objects
 * @param {object} meta - Pagination metadata
 * @param {number} meta.total - Total matching records count
 * @param {number} meta.limit - Effective limit applied
 * @param {number} meta.offset - Effective offset applied
 * @param {boolean} meta.hasMore - Whether more records exist beyond current page
 * @returns {{ data: Array, meta: { total: number, limit: number, offset: number, hasMore: boolean } }}
 */
export function listEnvelope(data, { total, limit, offset, hasMore }) {
  return {
    data,
    meta: {
      total,
      limit,
      offset,
      hasMore,
    },
  };
}

/**
 * Builds standard single-item response envelope
 * 
 * @param {object} data - Single resource object
 * @returns {{ data: object }}
 */
export function itemEnvelope(data) {
  return {
    data,
  };
}

// Alias for backwards compatibility
export const successEnvelope = itemEnvelope;
