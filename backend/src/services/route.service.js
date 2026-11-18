const { query } = require('../db');
const { NotFound, Conflict, BadRequest } = require('../utils/errors');

async function listRoutes({ search, page = 1, limit = 20 }) {
  const conditions = [];
  const params = [];

  if (search) {
    params.push(`%${search}%`);
    conditions.push(
      `(code ILIKE $${params.length} OR name ILIKE $${params.length} OR origin ILIKE $${params.length} OR destination ILIKE $${params.length})`
    );
  }

  const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const offset = (page - 1) * limit;

  const countRes = await query(
    `SELECT COUNT(*)::int AS total FROM routes ${whereClause}`,
    params
  );
  const total = countRes.rows[0]?.total || 0;

  const dataParams = [...params, limit, offset];
  const dataRes = await query(
    `SELECT * FROM routes
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

async function getRoute(id) {
  const res = await query(`SELECT * FROM routes WHERE id = $1`, [id]);
  if (!res.rows[0]) {
    throw NotFound('Route not found', 'ROUTE_NOT_FOUND');
  }
  return res.rows[0];
}

async function createRoute(data) {
  const dup = await query(`SELECT id FROM routes WHERE lower(code) = lower($1)`, [
    data.code,
  ]);
  if (dup.rows.length > 0) {
    throw Conflict('Route code already exists', 'DUPLICATE_ROUTE_CODE');
  }

  const res = await query(
    `INSERT INTO routes (
       code, name, origin, destination, distance_km,
       estimated_duration_hrs, base_rate_per_km, is_active
     ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     RETURNING *`,
    [
      data.code,
      data.name,
      data.origin,
      data.destination,
      data.distance_km,
      data.estimated_duration_hrs,
      data.base_rate_per_km ?? 2.5,
      data.is_active ?? true,
    ]
  );
  return res.rows[0];
}

async function updateRoute(id, data) {
  const existing = await query(`SELECT id FROM routes WHERE id = $1`, [id]);
  if (!existing.rows[0]) {
    throw NotFound('Route not found', 'ROUTE_NOT_FOUND');
  }

  if (data.code) {
    const dup = await query(
      `SELECT id FROM routes WHERE lower(code) = lower($1) AND id <> $2`,
      [data.code, id]
    );
    if (dup.rows.length > 0) {
      throw Conflict('Route code already in use', 'DUPLICATE_ROUTE_CODE');
    }
  }

  const fields = [];
  const params = [];
  const allowed = [
    'code',
    'name',
    'origin',
    'destination',
    'distance_km',
    'estimated_duration_hrs',
    'base_rate_per_km',
    'is_active',
  ];

  for (const key of allowed) {
    if (data[key] !== undefined) {
      params.push(data[key]);
      fields.push(`${key} = $${params.length}`);
    }
  }

  if (fields.length === 0) {
    throw BadRequest('No valid fields provided for update', 'EMPTY_UPDATE');
  }

  params.push(id);
  const res = await query(
    `UPDATE routes
     SET ${fields.join(', ')}
     WHERE id = $${params.length}
     RETURNING *`,
    params
  );
  return res.rows[0];
}

async function softDeleteRoute(id) {
  const res = await query(
    `UPDATE routes SET is_active = FALSE WHERE id = $1 RETURNING *`,
    [id]
  );
  if (!res.rows[0]) {
    throw NotFound('Route not found', 'ROUTE_NOT_FOUND');
  }
  return res.rows[0];
}

async function getRouteStats(id) {
  const exists = await query(`SELECT id, code, name FROM routes WHERE id = $1`, [id]);
  if (!exists.rows[0]) {
    throw NotFound('Route not found', 'ROUTE_NOT_FOUND');
  }

  const res = await query(
    `SELECT
       r.id AS route_id,
       r.code,
       r.name,
       COUNT(t.id) FILTER (WHERE t.status <> 'cancelled')::int AS usage_count,
       ROUND(
         COALESCE(
           100.0 * COUNT(t.id) FILTER (
             WHERE t.status = 'completed'
               AND t.actual_end IS NOT NULL
               AND t.actual_end <= t.scheduled_end
           ) / NULLIF(COUNT(t.id) FILTER (WHERE t.status = 'completed'), 0),
           100.0
         )::numeric,
         2
       ) AS avg_on_time_pct
     FROM routes r
     LEFT JOIN trips t ON t.route_id = r.id
     WHERE r.id = $1
     GROUP BY r.id, r.code, r.name`,
    [id]
  );
  return res.rows[0];
}

module.exports = {
  listRoutes,
  getRoute,
  createRoute,
  updateRoute,
  softDeleteRoute,
  getRouteStats,
};
