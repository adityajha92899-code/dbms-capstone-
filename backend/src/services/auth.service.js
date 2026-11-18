const { pool, query } = require('../db');
const { hashPassword, verifyPassword } = require('../utils/password');
const {
  generateAccessToken,
  generateRefreshToken,
  verifyRefreshToken,
  hashToken,
} = require('../utils/jwt');
const {
  Unauthorized,
  Forbidden,
  Conflict,
  Locked,
  NotFound,
} = require('../utils/errors');

const MAX_FAILED_ATTEMPTS = 5;
const LOCK_DURATION_MINUTES = 15;
const REFRESH_TTL_DAYS = 7;

function getClientMeta(req) {
  const ip =
    req?.ip ||
    req?.headers?.['x-forwarded-for']?.split(',')[0]?.trim() ||
    null;
  const userAgent = req?.headers?.['user-agent'] || null;
  return { ip, userAgent };
}

async function logAudit({ userId = null, email, success, failureReason = null, req }) {
  const { ip, userAgent } = getClientMeta(req);
  await query(
    `INSERT INTO login_audit_log (user_id, email, success, failure_reason, ip_address, user_agent)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [userId, email, success, failureReason, ip, userAgent]
  );
}

async function fetchRoleProfile(user) {
  if (user.user_type === 'driver') {
    const res = await query(
      `SELECT id, license_number, license_class, license_expiry, rating, status
       FROM driver_profiles WHERE user_id = $1`,
      [user.id]
    );
    return res.rows[0] || null;
  }
  if (user.user_type === 'customer') {
    const res = await query(
      `SELECT id, company_name, tax_id, billing_address, credit_limit, payment_terms_days
       FROM customer_profiles WHERE user_id = $1`,
      [user.id]
    );
    return res.rows[0] || null;
  }
  return null;
}

function sanitizeUser(user, profile = null) {
  return {
    id: user.id,
    email: user.email,
    full_name: user.full_name,
    phone: user.phone,
    role: user.user_type,
    user_type: user.user_type,
    is_active: user.is_active,
    last_login_at: user.last_login_at,
    profile,
  };
}

/**
 * Authenticate a user with email and password.
 */
async function login(email, password, req) {
  const normalizedEmail = email.trim().toLowerCase();

  const userRes = await query(
    `SELECT id, email, password_hash, full_name, phone, user_type, is_active,
            failed_attempts, locked_until, last_login_at
     FROM users
     WHERE lower(email) = $1`,
    [normalizedEmail]
  );

  const user = userRes.rows[0];
  if (!user) {
    await logAudit({
      email: normalizedEmail,
      success: false,
      failureReason: 'user_not_found',
      req,
    });
    throw Unauthorized('Invalid credentials', 'INVALID_CREDENTIALS');
  }

  if (user.locked_until && new Date(user.locked_until) > new Date()) {
    throw Locked(
      `Account locked until ${new Date(user.locked_until).toISOString()}`,
      'ACCOUNT_LOCKED'
    );
  }

  if (!user.is_active) {
    await logAudit({
      userId: user.id,
      email: normalizedEmail,
      success: false,
      failureReason: 'account_deactivated',
      req,
    });
    throw Forbidden('Account deactivated', 'ACCOUNT_DEACTIVATED');
  }

  const valid = await verifyPassword(password, user.password_hash);
  if (!valid) {
    const nextAttempts = (user.failed_attempts || 0) + 1;
    if (nextAttempts >= MAX_FAILED_ATTEMPTS) {
      await query(
        `UPDATE users
         SET failed_attempts = $1,
             locked_until = NOW() + ($2 || ' minutes')::interval
         WHERE id = $3`,
        [nextAttempts, LOCK_DURATION_MINUTES, user.id]
      );
    } else {
      await query(
        `UPDATE users SET failed_attempts = $1 WHERE id = $2`,
        [nextAttempts, user.id]
      );
    }

    await logAudit({
      userId: user.id,
      email: normalizedEmail,
      success: false,
      failureReason: 'invalid_password',
      req,
    });
    throw Unauthorized('Invalid credentials', 'INVALID_CREDENTIALS');
  }

  // Reset lockout counters and record login timestamp
  const updatedRes = await query(
    `UPDATE users
     SET failed_attempts = 0,
         locked_until = NULL,
         last_login_at = NOW()
     WHERE id = $1
     RETURNING id, email, full_name, phone, user_type, is_active, last_login_at`,
    [user.id]
  );
  const updatedUser = updatedRes.rows[0];

  const profile = await fetchRoleProfile(updatedUser);
  const accessToken = generateAccessToken(updatedUser, profile);
  const refreshToken = generateRefreshToken(updatedUser);
  const tokenHash = hashToken(refreshToken);
  const { ip, userAgent } = getClientMeta(req);

  await query(
    `INSERT INTO refresh_tokens (user_id, token_hash, expires_at, ip_address, user_agent)
     VALUES ($1, $2, NOW() + ($3 || ' days')::interval, $4, $5)`,
    [updatedUser.id, tokenHash, REFRESH_TTL_DAYS, ip, userAgent]
  );

  await logAudit({
    userId: updatedUser.id,
    email: normalizedEmail,
    success: true,
    req,
  });

  return {
    accessToken,
    refreshToken,
    user: sanitizeUser(updatedUser, profile),
  };
}

/**
 * Rotate refresh token and issue a new access token.
 */
async function refresh(refreshToken, req) {
  if (!refreshToken) {
    throw Unauthorized('Refresh token required', 'TOKEN_MISSING');
  }

  let decoded;
  try {
    decoded = verifyRefreshToken(refreshToken);
  } catch (_err) {
    throw Unauthorized('Invalid or expired refresh token', 'TOKEN_INVALID');
  }

  const tokenHash = hashToken(refreshToken);
  const tokenRes = await query(
    `SELECT id, user_id, expires_at, revoked_at
     FROM refresh_tokens
     WHERE token_hash = $1`,
    [tokenHash]
  );

  const stored = tokenRes.rows[0];
  if (!stored) {
    throw Unauthorized('Refresh token not recognized', 'TOKEN_INVALID');
  }

  // Reuse detection: if token was already revoked, revoke all active tokens for this user
  if (stored.revoked_at) {
    await query(
      `UPDATE refresh_tokens
       SET revoked_at = NOW()
       WHERE user_id = $1 AND revoked_at IS NULL`,
      [stored.user_id]
    );
    throw Unauthorized('Refresh token reuse detected; all sessions revoked', 'TOKEN_REVOKED');
  }

  if (new Date(stored.expires_at) <= new Date()) {
    throw Unauthorized('Refresh token expired', 'TOKEN_EXPIRED');
  }

  const userRes = await query(
    `SELECT id, email, full_name, phone, user_type, is_active, last_login_at
     FROM users
     WHERE id = $1`,
    [decoded.sub]
  );
  const user = userRes.rows[0];
  if (!user || !user.is_active) {
    throw Forbidden('Account is inactive or unavailable', 'ACCOUNT_DEACTIVATED');
  }

  const profile = await fetchRoleProfile(user);
  const newAccessToken = generateAccessToken(user, profile);
  const newRefreshToken = generateRefreshToken(user);
  const newHash = hashToken(newRefreshToken);
  const { ip, userAgent } = getClientMeta(req);

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(
      `UPDATE refresh_tokens SET revoked_at = NOW() WHERE id = $1`,
      [stored.id]
    );
    await client.query(
      `INSERT INTO refresh_tokens (user_id, token_hash, expires_at, ip_address, user_agent)
       VALUES ($1, $2, NOW() + ($3 || ' days')::interval, $4, $5)`,
      [user.id, newHash, REFRESH_TTL_DAYS, ip, userAgent]
    );
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }

  return {
    accessToken: newAccessToken,
    refreshToken: newRefreshToken,
  };
}

/**
 * Revoke the provided refresh token on logout.
 */
async function logout(refreshToken, userId) {
  if (!refreshToken) return;
  const tokenHash = hashToken(refreshToken);
  await query(
    `UPDATE refresh_tokens
     SET revoked_at = NOW()
     WHERE token_hash = $1 AND user_id = $2 AND revoked_at IS NULL`,
    [tokenHash, userId]
  );
}

/**
 * Register a new customer user and customer profile.
 */
async function register({ email, password, full_name, phone, company_name }) {
  const normalizedEmail = email.trim().toLowerCase();

  const existing = await query(
    `SELECT id FROM users WHERE lower(email) = $1`,
    [normalizedEmail]
  );
  if (existing.rows.length > 0) {
    throw Conflict('Email is already registered', 'EMAIL_EXISTS');
  }

  const passwordHash = await hashPassword(password);
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const userRes = await client.query(
      `INSERT INTO users (email, password_hash, full_name, phone, user_type, is_active)
       VALUES ($1, $2, $3, $4, 'customer', TRUE)
       RETURNING id, email, full_name, phone, user_type, is_active, last_login_at, created_at`,
      [normalizedEmail, passwordHash, full_name, phone]
    );
    const newUser = userRes.rows[0];

    const profileRes = await client.query(
      `INSERT INTO customer_profiles (user_id, company_name, billing_address)
       VALUES ($1, $2, $3)
       RETURNING id, company_name, tax_id, billing_address, credit_limit, payment_terms_days`,
      [newUser.id, company_name, 'Pending billing address']
    );

    await client.query('COMMIT');
    return sanitizeUser(newUser, profileRes.rows[0]);
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Retrieve authenticated user and their role-specific profile.
 */
async function getMe(userId) {
  const userRes = await query(
    `SELECT id, email, full_name, phone, user_type, is_active, last_login_at, created_at
     FROM users
     WHERE id = $1`,
    [userId]
  );

  const user = userRes.rows[0];
  if (!user) {
    throw NotFound('User not found', 'USER_NOT_FOUND');
  }

  const profile = await fetchRoleProfile(user);
  return sanitizeUser(user, profile);
}


async function changePassword(userId, { currentPassword, newPassword }) {
  const res = await query(`SELECT id, password_hash FROM users WHERE id = $1`, [userId]);
  const user = res.rows[0];
  if (!user) throw NotFound('User not found', 'USER_NOT_FOUND');

  const valid = await verifyPassword(currentPassword, user.password_hash);
  if (!valid) throw Unauthorized('Current password is incorrect', 'INVALID_PASSWORD');

  const nextHash = await hashPassword(newPassword);
  await query(`UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2`, [nextHash, userId]);
}

async function updateProfile(userId, { full_name, phone, settings }) {
  const res = await query(
    `UPDATE users
     SET full_name = COALESCE($1, full_name),
         phone = COALESCE($2, phone),
         settings = COALESCE($3::jsonb, settings),
         updated_at = NOW()
     WHERE id = $4
     RETURNING id, email, full_name, phone, user_type, is_active, settings`,
    [full_name ?? null, phone ?? null, settings ? JSON.stringify(settings) : null, userId]
  );
  if (!res.rows[0]) throw NotFound('User not found', 'USER_NOT_FOUND');
  return sanitizeUser(res.rows[0]);
}

module.exports = {
  login,
  refresh,
  logout,
  register,
  getMe,
  changePassword,
  updateProfile,
};
