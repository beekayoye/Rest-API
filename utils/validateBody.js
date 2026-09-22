import ApiError from './apiError.js';

/**
 * Validates a request body against a Zod schema.
 * Throws ApiError.validation(422) with individually named field errors on failure.
 * 
 * Supports two usages:
 * 1. Direct function: validateBody(schema, body) => returns validated data or throws ApiError
 * 2. Express middleware: validateBody(schema) => (req, res, next) => ...
 * 
 * @param {import('zod').ZodType} schema - Zod schema to validate against
 * @param {object} [body] - Optional request body object
 * @returns {object|Function} Validated data if body is passed, or middleware function
 */
export function validateBody(schema, body) {
  // If invoked as Express middleware generator: validateBody(schema)
  if (arguments.length === 1 || body === undefined) {
    return (req, res, next) => {
      try {
        req.body = validateBody(schema, req.body);
        next();
      } catch (err) {
        next(err);
      }
    };
  }

  // If invoked as direct function: validateBody(schema, body)
  const result = schema.safeParse(body);

  if (!result.success) {
    const details = result.error.errors.map((issue) => {
      const field = issue.path.length > 0 ? issue.path.join('.') : 'body';
      return {
        field,
        message: issue.message,
      };
    });

    throw ApiError.validation('Validation failed', details);
  }

  return result.data;
}

export default validateBody;
