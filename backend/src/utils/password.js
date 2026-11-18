const bcrypt = require('bcrypt');

const BCRYPT_COST = parseInt(process.env.BCRYPT_COST, 10) || 12;

/**
 * Hash a plaintext password using bcrypt.
 * @param {string} plain
 * @returns {Promise<string>}
 */
async function hashPassword(plain) {
  return bcrypt.hash(plain, BCRYPT_COST);
}

/**
 * Verify a plaintext password against a bcrypt hash.
 * @param {string} plain
 * @param {string} hash
 * @returns {Promise<boolean>}
 */
async function verifyPassword(plain, hash) {
  if (!plain || !hash) return false;
  return bcrypt.compare(plain, hash);
}

module.exports = {
  hashPassword,
  verifyPassword,
};
