const crypto = require('crypto');
const { query } = require('../db');
const { hashPassword } = require('../utils/password');
const { NotFound } = require('../utils/errors');

async function listUsers({ type, status, search, page = 1, limit = 20 } = {}) {
  const conditions = [];
  const params = [];

  if (type) {
    params.push(type);
    conditions.push(`user_type = $${params.length}`);
  }
  if (status === 'active') {
    conditions.push(`is_active = TRUE`);
  } else if (status === 'inactive') {
    conditions.push(`is_active = FALSE`);
  }
  if (search) {
    params.push(`%${search}%`);
    conditions.push(`(email ILIKE $${params.length} OR full_name ILIKE $${params.length})`);
  }

  const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const offset = (page - 1) * limit;

  const countRes = await query(
    `SELECT COUNT(*)::int AS total FROM users ${whereClause}`,
    params
  );
  const total = countRes.rows[0]?.total || 0;

  const dataParams = [...params, limit, offset];
  const dataRes = await query(
    `SELECT id, email, full_name, phone, user_type, is_active,
            failed_attempts, locked_until, last_login_at, created_at, updated_at
     FROM users
     ${whereClause}
     ORDER BY created_at DESC
     LIMIT $${dataParams.length - 1} OFFSET $${dataParams.length}`,
    dataParams
  );

  return {
    data: dataRes.rows,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit) || 1,
    },
  };
}

async function updateUserStatus(id, isActive, adminId = null) {
  const res = await query(
    `UPDATE users
     SET is_active = $1, updated_at = NOW()
     WHERE id = $2
     RETURNING id, email, full_name, phone, user_type, is_active, updated_at`,
    [Boolean(isActive), id]
  );

  const user = res.rows[0];
  if (!user) {
    throw NotFound('User not found', 'USER_NOT_FOUND');
  }

  await query(
    `INSERT INTO login_audit_log (user_id, email, success, failure_reason)
     VALUES ($1, $2, TRUE, $3)`,
    [
      user.id,
      user.email,
      `admin_status_change:is_active=${Boolean(isActive)} by=${adminId || 'system'}`,
    ]
  );

  return user;
}

async function resetUserPassword(id) {
  const existing = await query(`SELECT id, email FROM users WHERE id = $1`, [id]);
  if (!existing.rows[0]) {
    throw NotFound('User not found', 'USER_NOT_FOUND');
  }

  const tempPassword = `FF-${crypto.randomBytes(6).toString('base64url')}!1`;
  const passwordHash = await hashPassword(tempPassword);

  await query(
    `UPDATE users
     SET password_hash = $1,
         failed_attempts = 0,
         locked_until = NULL,
         updated_at = NOW()
     WHERE id = $2`,
    [passwordHash, id]
  );

  return {
    id: existing.rows[0].id,
    email: existing.rows[0].email,
    temporaryPassword: tempPassword,
  };
}

async function getLoginAudit({ userId, page = 1, limit = 50 } = {}) {
  const conditions = [];
  const params = [];

  if (userId) {
    params.push(userId);
    conditions.push(`user_id = $${params.length}`);
  }

  const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const offset = (page - 1) * limit;

  const countRes = await query(
    `SELECT COUNT(*)::int AS total FROM login_audit_log ${whereClause}`,
    params
  );
  const total = countRes.rows[0]?.total || 0;

  const dataParams = [...params, limit, offset];
  const dataRes = await query(
    `SELECT * FROM login_audit_log
     ${whereClause}
     ORDER BY occurred_at DESC
     LIMIT $${dataParams.length - 1} OFFSET $${dataParams.length}`,
    dataParams
  );

  return {
    data: dataRes.rows,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit) || 1,
    },
  };
}

module.exports = {
  listUsers,
  updateUserStatus,
  resetUserPassword,
  getLoginAudit,
};
