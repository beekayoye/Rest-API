import { z } from 'zod';

/**
 * Creates a Zod string schema with clear, field-specific error messages:
 * - "<field> is required" when missing or undefined
 * - "<field> must be a string" when wrong type
 * 
 * @param {string} field - The name of the field for error messages
 * @returns {z.ZodType<string>}
 */
export function requiredString(field) {
  return z.string({
    required_error: `${field} is required`,
    invalid_type_error: `${field} must be a string`,
  }).min(1, `${field} is required`);
}

/**
 * Creates a Zod number schema with clear, field-specific error messages:
 * - "<field> is required" when missing or undefined
 * - "<field> must be a number" when wrong type
 * 
 * @param {string} field - The name of the field for error messages
 * @returns {z.ZodType<number>}
 */
export function requiredNumber(field) {
  return z.number({
    required_error: `${field} is required`,
    invalid_type_error: `${field} must be a number`,
  });
}

/**
 * Optional string helper with custom invalid type error
 */
export function optionalString(field) {
  return z.string({
    invalid_type_error: `${field} must be a string`,
  }).optional();
}

/**
 * Optional number helper with custom invalid type error
 */
export function optionalNumber(field) {
  return z.number({
    invalid_type_error: `${field} must be a number`,
  }).optional();
}
