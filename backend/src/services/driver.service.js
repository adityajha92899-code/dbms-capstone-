const { pool, query } = require('../db');
const { hashPassword } = require('../utils/password');
const { NotFound, Conflict } = require('../utils/errors');

async function listDrivers({ status, search, page = 1, limit = 20 }) {
  const conditions = [];
  const params = [];

  if (status) {
    params.push(status);
    conditions.push(`dp.status = $${params.length}`);
  }
  if (search) {
    params.push(`%${search}%`);
    conditions.push(
      `(u.full_name ILIKE $${params.length} OR u.email ILIKE $${params.length} OR dp.license_number ILIKE $${params.length})`
    );
  }

  const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const offset = (page - 1) * limit;

  const countRes = await query(
    `SELECT COUNT(*)::int AS total
     FROM driver_profiles dp
     JOIN users u ON u.id = dp.user_id
     ${whereClause}`,
    params
  );
  const total = countRes.rows[0]?.total || 0;

  const dataParams = [...params, limit, offset];
  const dataRes = await query(
    `SELECT dp.*,
            u.full_name,
            u.email,
            u.phone,
            u.is_active,
            COUNT(t.id) FILTER (WHERE t.status IN ('scheduled', 'in_progress'))::int AS active_trips_count,
            COALESCE(
              MAX(t.scheduled_end) FILTER (WHERE t.status IN ('scheduled', 'in_progress')),
              NOW()
            ) AS next_free_at
     FROM driver_profiles dp
     JOIN users u ON u.id = dp.user_id
     LEFT JOIN trips t ON t.driver_id = dp.id
     ${whereClause}
     GROUP BY dp.id, u.full_name, u.email, u.phone, u.is_active
     ORDER BY dp.created_at DESC
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

async function getDriver(id) {
  const driverRes = await query(
    `SELECT dp.*, u.full_name, u.email, u.phone, u.is_active
     FROM driver_profiles dp
     JOIN users u ON u.id = dp.user_id
     WHERE dp.id = $1`,
    [id]
  );
  const driver = driverRes.rows[0];
  if (!driver) {
    throw NotFound('Driver not found', 'DRIVER_NOT_FOUND');
  }

  const tripsRes = await query(
    `SELECT t.*, v.reg_number AS vehicle_reg, r.origin, r.destination
     FROM trips t
     JOIN vehicles v ON v.id = t.vehicle_id
     JOIN routes r ON r.id = t.route_id
     WHERE t.driver_id = $1
       AND t.status IN ('scheduled', 'in_progress')
     ORDER BY t.scheduled_start ASC`,
    [id]
  );

  return {
    ...driver,
    upcoming_trips: tripsRes.rows,
  };
}

async function createDriver(data) {
  const normalizedEmail = data.email.trim().toLowerCase();

  const dupEmail = await query(`SELECT id FROM users WHERE lower(email) = $1`, [
    normalizedEmail,
  ]);
  if (dupEmail.rows.length > 0) {
    throw Conflict('Email is already registered', 'EMAIL_EXISTS');
  }

  const dupLic = await query(
    `SELECT id FROM driver_profiles WHERE lower(license_number) = lower($1)`,
    [data.license_number]
  );
  if (dupLic.rows.length > 0) {
    throw Conflict('License number is already registered', 'DUPLICATE_LICENSE');
  }

  const passwordHash = await hashPassword(data.password);
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const userRes = await client.query(
      `INSERT INTO users (email, password_hash, full_name, phone, user_type, is_active)
       VALUES ($1, $2, $3, $4, 'driver', TRUE)
       RETURNING id, email, full_name, phone, user_type, is_active, created_at`,
      [normalizedEmail, passwordHash, data.full_name, data.phone ?? null]
    );
    const user = userRes.rows[0];

    const profileRes = await client.query(
      `INSERT INTO driver_profiles (
         user_id, license_number, license_class, license_expiry, hire_date
       ) VALUES ($1, $2, $3, $4::date, COALESCE($5::date, CURRENT_DATE))
       RETURNING *`,
      [
        user.id,
        data.license_number,
        data.license_class,
        data.license_expiry,
        data.hire_date ?? null,
      ]
    );

    await client.query('COMMIT');
    return {
      ...profileRes.rows[0],
      email: user.email,
      full_name: user.full_name,
      phone: user.phone,
      is_active: user.is_active,
    };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

async function updateDriverStatus(id, status) {
  const res = await query(
    `UPDATE driver_profiles
     SET status = $1, updated_at = NOW()
     WHERE id = $2
     RETURNING *`,
    [status, id]
  );
  if (!res.rows[0]) {
    throw NotFound('Driver not found', 'DRIVER_NOT_FOUND');
  }
  return res.rows[0];
}

async function getDriverPerformance(id) {
  const res = await query(
    `SELECT * FROM vw_driver_performance WHERE driver_id = $1`,
    [id]
  );
  if (!res.rows[0]) {
    throw NotFound('Driver not found', 'DRIVER_NOT_FOUND');
  }
  return res.rows[0];
}

module.exports = {
  listDrivers,
  getDriver,
  createDriver,
  updateDriverStatus,
  getDriverPerformance,
};
