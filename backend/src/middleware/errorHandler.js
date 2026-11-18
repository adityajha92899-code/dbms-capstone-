const { AppError } = require('../utils/errors');

/**
 * 404 handler for unmatched routes.
 */
function notFoundHandler(req, res, _next) {
  return res.status(404).json({
    error: `Route not found: ${req.method} ${req.originalUrl}`,
    code: 'ROUTE_NOT_FOUND',
  });
}

/**
 * Global Express error handler.
 */
function errorHandler(err, _req, res, _next) {
  if (err instanceof AppError) {
    return res.status(err.status).json({
      error: err.message,
      code: err.code,
    });
  }

  console.error('[Unhandled Error]', err);
  return res.status(500).json({
    error: 'Internal server error',
    code: 'INTERNAL_ERROR',
  });
}

module.exports = {
  notFoundHandler,
  errorHandler,
};
