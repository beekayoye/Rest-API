export function snakeToCamelKey(str) {
  return str.replace(/_([a-z])/g, (_, char) => char.toUpperCase());
}

export function serializeRow(row) {
  if (!row || typeof row !== 'object' || Array.isArray(row)) return row;

  const result = {};
  for (const [key, val] of Object.entries(row)) {
    const camelKey = snakeToCamelKey(key);
    result[camelKey] = val;
  }
  return result;
}

export function serializeRows(rows) {
  if (!Array.isArray(rows)) return [];
  return rows.map(serializeRow);
}
