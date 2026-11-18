const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const config = require('../config');

const JWT_ISSUER = 'tms-api';
const JWT_AUDIENCE = 'tms-web';

/**
 * Generate a signed JWT access token.
 * Payload: { sub, email, role, driverId }
 */
function generateAccessToken(user, profile = null) {
  const payload = {
    sub: user.id,
    email: user.email,
    role: user.user_type,
    driverId: user.user_type === 'driver' && profile ? profile.id : null,
  };

  return jwt.sign(payload, config.jwtAccessSecret, {
    expiresIn: config.accessTokenTtl || '15m',
    issuer: JWT_ISSUER,
    audience: JWT_AUDIENCE,
  });
}

/**
 * Generate a signed JWT refresh token.
 * Payload: { sub, tokenId }
 */
function generateRefreshToken(user) {
  const payload = {
    sub: user.id,
    tokenId: crypto.randomUUID(),
  };

  return jwt.sign(payload, config.jwtRefreshSecret, {
    expiresIn: config.refreshTokenTtl || '7d',
    issuer: JWT_ISSUER,
    audience: JWT_AUDIENCE,
  });
}

/**
 * Verify and decode an access token.
 */
function verifyAccessToken(token) {
  return jwt.verify(token, config.jwtAccessSecret, {
    issuer: JWT_ISSUER,
    audience: JWT_AUDIENCE,
  });
}

/**
 * Verify and decode a refresh token.
 */
function verifyRefreshToken(token) {
  return jwt.verify(token, config.jwtRefreshSecret, {
    issuer: JWT_ISSUER,
    audience: JWT_AUDIENCE,
  });
}

/**
 * Compute SHA-256 hex digest of a token for secure DB storage.
 */
function hashToken(token) {
  return crypto.createHash('sha256').update(String(token)).digest('hex');
}

module.exports = {
  generateAccessToken,
  generateRefreshToken,
  verifyAccessToken,
  verifyRefreshToken,
  hashToken,
};
