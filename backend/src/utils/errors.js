class AppError extends Error {
  /**
   * @param {string} message
   * @param {number} [status=500]
   * @param {string} [code='INTERNAL_ERROR']
   */
  constructor(message, status = 500, code = 'INTERNAL_ERROR') {
    super(message);
    this.name = 'AppError';
    this.status = status;
    this.code = code;
    Error.captureStackTrace(this, this.constructor);
  }
}

const BadRequest = (message = 'Bad request', code = 'BAD_REQUEST') =>
  new AppError(message, 400, code);

const Unauthorized = (message = 'Unauthorized', code = 'UNAUTHORIZED') =>
  new AppError(message, 401, code);

const Forbidden = (message = 'Forbidden', code = 'FORBIDDEN') =>
  new AppError(message, 403, code);

const NotFound = (message = 'Resource not found', code = 'NOT_FOUND') =>
  new AppError(message, 404, code);

const Conflict = (message = 'Resource conflict', code = 'CONFLICT') =>
  new AppError(message, 409, code);

const Locked = (message = 'Account locked', code = 'ACCOUNT_LOCKED') =>
  new AppError(message, 423, code);

module.exports = {
  AppError,
  BadRequest,
  Unauthorized,
  Forbidden,
  NotFound,
  Conflict,
  Locked,
};
