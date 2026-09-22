export const errorHandler = (err, req, res, next) => {
  const statusCode = err.status || err.statusCode || 500;
  const code = err.code || (statusCode === 500 ? 'INTERNAL_SERVER_ERROR' : 'BAD_REQUEST');
  const message = err.message || 'An unexpected error occurred';

  if (statusCode === 500) {
    console.error('💥 [Server 500 Error]:', err);
  }

  const response = {
    error: {
      code,
      message,
    },
  };

  if (err.details && Array.isArray(err.details)) {
    response.error.details = err.details;
  }

  res.status(statusCode).json(response);
};

export default errorHandler;
