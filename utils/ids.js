import crypto from 'node:crypto';

/**
 * Standard ID prefixes for all core resources
 */
export const PREFIXES = {
  restaurant: 'rst',
  menuItem: 'mnu',
  customer: 'cus',
  order: 'ord',
  orderItem: 'oit',
};

/**
 * Generates an unguessable, non-sequential prefixed ID (e.g. rst_3f9a1c2b8e7d4a56...)
 * Format: <prefix>_<24 hex characters>
 * 
 * @param {string} prefix - The resource prefix (e.g. 'rst', 'mnu', 'cus', 'ord', 'oit')
 * @returns {string} Generated ID
 */
export function generateId(prefix) {
  const hex = crypto.randomBytes(12).toString('hex'); // 12 bytes = 24 hex chars
  return `${prefix}_${hex}`;
}

/**
 * Validates if an ID matches the strict regex pattern: ^<prefix>_[0-9a-f]{24}$
 * Supports both (prefix, id) and (id, prefix) parameter signatures.
 * 
 * @param {string} prefixOrId - Resource prefix or ID string
 * @param {string} idOrPrefix - ID string or Resource prefix
 * @returns {boolean} True if format is valid
 */
export function isValidId(prefixOrId, idOrPrefix) {
  let prefix = prefixOrId;
  let id = idOrPrefix;

  // If first argument looks like the full ID (contains underscore) and second is the short prefix
  if (typeof prefixOrId === 'string' && prefixOrId.includes('_') && typeof idOrPrefix === 'string' && !idOrPrefix.includes('_')) {
    id = prefixOrId;
    prefix = idOrPrefix;
  }

  if (!id || typeof id !== 'string' || !prefix || typeof prefix !== 'string') {
    return false;
  }

  const regex = new RegExp(`^${prefix}_[0-9a-f]{24}$`);
  return regex.test(id);
}
