const { verifyAccessToken } = require('../utils/jwt');
const { Unauthorized, Forbidden } = require('../utils/errors');

/**
 * Extract Bearer token from Authorization header.
 */
function extractBearerToken(req) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }
  return authHeader.slice(7).trim() || null;
}

/**
 * Require a valid JWT access token and attach decoded payload to req.user.
 */
function authenticate(req, _res, next) {
  const token = extractBearerToken(req);
  if (!token) {
    return next(Unauthorized('Authentication token required', 'TOKEN_MISSING'));
  }

  try {
    const decoded = verifyAccessToken(token);
    req.user = {
      id: decoded.sub,
      sub: decoded.sub,
      email: decoded.email,
      role: decoded.role,
      driverId: decoded.driverId || null,
    };
    return next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return next(Unauthorized('Access token expired', 'TOKEN_EXPIRED'));
    }
    return next(Unauthorized('Invalid access token', 'TOKEN_INVALID'));
  }
}

/**
 * Restrict route access to specific user roles.
 * @param {...string} roles
 */
function authorizeRole(...roles) {
  return (req, _res, next) => {
    if (!req.user) {
      return next(Unauthorized('Authentication required', 'UNAUTHORIZED'));
    }
    if (!roles.includes(req.user.role)) {
      return next(
        Forbidden('You do not have permission to perform this action', 'INSUFFICIENT_ROLE')
      );
    }
    return next();
  };
}

/**
 * Attach req.user if a valid Bearer token is present; otherwise continue without failing.
 */
function optionalAuth(req, _res, next) {
  const token = extractBearerToken(req);
  if (!token) {
    return next();
  }

  try {
    const decoded = verifyAccessToken(token);
    req.user = {
      id: decoded.sub,
      sub: decoded.sub,
      email: decoded.email,
      role: decoded.role,
      driverId: decoded.driverId || null,
    };
  } catch (_err) {
    // Ignore invalid/expired token for optional auth
  }
  return next();
}

module.exports = {
  authenticate,
  authorizeRole,
  optionalAuth,
};
