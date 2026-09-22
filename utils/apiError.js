/**
 * ============================================================================
 * ApiError - Standard Custom HTTP Error Class
 * ============================================================================
 * 
 * Route handlers throw these errors instead of ever calling res.status().json()
 * directly for an error response.
 */

export class ApiError extends Error {
  /**
   * @param {number} status - HTTP status code
   * @param {string} code - Error code identifier (e.g. 'BAD_REQUEST', 'NOT_FOUND')
   * @param {string} message - Human-readable error message
   * @param {Array|null} [details=null] - Optional detailed error array
   */
  constructor(status, code, message, details = null) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
  }

  /**
   * HTTP 400 Bad Request
   */
  static badRequest(message = 'Bad request', details = null) {
    return new ApiError(400, 'BAD_REQUEST', message, details);
  }

  /**
   * HTTP 422 Unprocessable Entity / Validation Error
   */
  static validation(message = 'Validation failed', details = null) {
    return new ApiError(422, 'VALIDATION_ERROR', message, details);
  }

  // Alias for validation
  static validationError(message = 'Validation failed', details = null) {
    return ApiError.validation(message, details);
  }

  /**
   * HTTP 404 Not Found
   */
  static notFound(message = 'Resource not found', details = null) {
    return new ApiError(404, 'NOT_FOUND', message, details);
  }

  /**
   * HTTP 409 Conflict
   */
  static conflict(message = 'Conflict detected', details = null) {
    return new ApiError(409, 'CONFLICT', message, details);
  }

  /**
   * HTTP 429 Too Many Requests
   */
  static tooManyRequests(message = 'Too many requests. Please try again later.') {
    return new ApiError(429, 'TOO_MANY_REQUESTS', message);
  }
}

export default ApiError;
