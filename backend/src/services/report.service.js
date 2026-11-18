const { query } = require('../db');

/**
 * Single-query KPI snapshot using CTEs.
 */
async function getKpis() {
  const res = await query(`
    WITH vehicle_stats AS (
      SELECT
        COUNT(*) FILTER (WHERE status IN ('available', 'in_transit'))::int AS active_vehicles,
        COUNT(*) FILTER (WHERE status <> 'inactive')::int AS total_vehicles
      FROM vehicles
    ),
    trip_stats AS (
      SELECT
        COUNT(*) FILTER (WHERE status = 'in_progress')::int AS active_trips,
        COUNT(*) FILTER (
          WHERE scheduled_start >= date_trunc('day', NOW())
            AND scheduled_start < date_trunc('day', NOW()) + INTERVAL '1 day'
            AND status <> 'cancelled'
        )::int AS trips_today,
        ROUND(
          COALESCE(
            100.0 * COUNT(*) FILTER (
              WHERE status = 'completed'
                AND actual_end >= NOW() - INTERVAL '30 days'
                AND actual_end <= scheduled_end
            ) / NULLIF(
              COUNT(*) FILTER (
                WHERE status = 'completed'
                  AND actual_end >= NOW() - INTERVAL '30 days'
              ),
              0
            ),
            100.0
          )::numeric,
          2
        ) AS on_time_rate_30d
      FROM trips
    ),
    booking_stats AS (
      SELECT
        ROUND(
          COALESCE(
            SUM(quoted_price) FILTER (
              WHERE status = 'delivered'
                AND delivered_at >= NOW() - INTERVAL '30 days'
            ),
            0
          )::numeric,
          2
        ) AS revenue_30d,
        COUNT(*) FILTER (WHERE status = 'pending')::int AS pending_bookings
      FROM bookings
    ),
    maint_stats AS (
      SELECT COUNT(DISTINCT v.id)::int AS maintenance_due_7d
      FROM vehicles v
      LEFT JOIN maintenance_records mr ON mr.vehicle_id = v.id
      WHERE v.status <> 'inactive'
        AND (
          v.insurance_expiry <= CURRENT_DATE + INTERVAL '7 days'
          OR (v.fitness_expiry IS NOT NULL AND v.fitness_expiry <= CURRENT_DATE + INTERVAL '7 days')
          OR mr.next_service_date <= CURRENT_DATE + INTERVAL '7 days'
        )
    )
    SELECT
      vs.active_vehicles,
      vs.total_vehicles,
      ts.active_trips,
      ts.trips_today,
      ts.on_time_rate_30d,
      bs.revenue_30d,
      bs.pending_bookings,
      ms.maintenance_due_7d
    FROM vehicle_stats vs
    CROSS JOIN trip_stats ts
    CROSS JOIN booking_stats bs
    CROSS JOIN maint_stats ms
  `);

  return res.rows[0];
}

async function getFuelEfficiency({ from, to, vehicle_id } = {}) {
  const conditions = [];
  const params = [];

  if (from) {
    params.push(from);
    conditions.push(`fl.fueled_at >= $${params.length}::timestamptz`);
  }
  if (to) {
    params.push(to);
    conditions.push(`fl.fueled_at <= $${params.length}::timestamptz`);
  }
  if (vehicle_id) {
    params.push(vehicle_id);
    conditions.push(`v.id = $${params.length}`);
  }

  const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  const res = await query(
    `SELECT
       v.id AS vehicle_id,
       v.reg_number,
       ROUND(COALESCE(SUM(fl.liters), 0)::numeric, 2) AS total_liters,
       ROUND(COALESCE(SUM(fl.total_cost), 0)::numeric, 2) AS total_fuel_cost,
       ROUND(COALESCE(SUM(DISTINCT r.distance_km), 0)::numeric, 2) AS total_km,
       ROUND(
         COALESCE(
           SUM(DISTINCT r.distance_km) / NULLIF(SUM(fl.liters), 0),
           0
         )::numeric,
         2
       ) AS km_per_liter,
       ROUND(
         COALESCE(
           SUM(fl.total_cost) / NULLIF(SUM(DISTINCT r.distance_km), 0),
           0
         )::numeric,
         2
       ) AS cost_per_km,
       CASE
         WHEN COALESCE(SUM(DISTINCT r.distance_km) / NULLIF(SUM(fl.liters), 0), 0) >= 3.0 THEN 'optimal'
         ELSE 'needs_review'
       END AS trend
     FROM vehicles v
     JOIN fuel_logs fl ON fl.vehicle_id = v.id
     LEFT JOIN trips t ON t.id = fl.trip_id
     LEFT JOIN routes r ON r.id = t.route_id
     ${whereClause}
     GROUP BY v.id, v.reg_number
     ORDER BY km_per_liter DESC`,
    params
  );

  return res.rows;
}

async function getMaintenanceCost({ from, to } = {}) {
  const conditions = [];
  const params = [];

  if (from) {
    params.push(from);
    conditions.push(`service_date >= $${params.length}::date`);
  }
  if (to) {
    params.push(to);
    conditions.push(`service_date <= $${params.length}::date`);
  }

  const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  const res = await query(
    `SELECT
       to_char(date_trunc('month', service_date), 'YYYY-MM') AS month,
       ROUND(COALESCE(SUM(cost), 0)::numeric, 2) AS total_cost,
       COUNT(*)::int AS record_count
     FROM maintenance_records
     ${whereClause}
     GROUP BY date_trunc('month', service_date)
     ORDER BY month DESC`,
    params
  );

  return res.rows;
}

async function getRevenue({ from, to } = {}) {
  const conditions = [`status = 'delivered'`];
  const params = [];

  if (from) {
    params.push(from);
    conditions.push(`COALESCE(delivered_at, created_at) >= $${params.length}::timestamptz`);
  }
  if (to) {
    params.push(to);
    conditions.push(`COALESCE(delivered_at, created_at) <= $${params.length}::timestamptz`);
  }

  const whereClause = `WHERE ${conditions.join(' AND ')}`;

  const res = await query(
    `SELECT
       to_char(date_trunc('month', COALESCE(delivered_at, created_at)), 'YYYY-MM') AS month,
       ROUND(COALESCE(SUM(quoted_price), 0)::numeric, 2) AS revenue,
       COUNT(*)::int AS delivered_bookings
     FROM bookings
     ${whereClause}
     GROUP BY date_trunc('month', COALESCE(delivered_at, created_at))
     ORDER BY month DESC`,
    params
  );

  return res.rows;
}

async function getTripVolume({ from, to } = {}) {
  const conditions = [];
  const params = [];

  if (from) {
    params.push(from);
    conditions.push(`scheduled_start >= $${params.length}::timestamptz`);
  }
  if (to) {
    params.push(to);
    conditions.push(`scheduled_start <= $${params.length}::timestamptz`);
  }

  const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  const res = await query(
    `SELECT
       to_char(date_trunc('day', scheduled_start), 'YYYY-MM-DD') AS date,
       COUNT(*)::int AS trip_count,
       COUNT(*) FILTER (WHERE status = 'completed')::int AS completed_count
     FROM trips
     ${whereClause}
     GROUP BY date_trunc('day', scheduled_start)
     ORDER BY date DESC`,
    params
  );

  return res.rows;
}

async function getDriverLeaderboard() {
  const res = await query(`
    SELECT
      dp.id AS driver_id,
      u.full_name AS name,
      dp.license_class,
      dp.rating,
      COUNT(t.id)::int AS completed_trips_30d
    FROM driver_profiles dp
    JOIN users u ON u.id = dp.user_id
    LEFT JOIN trips t
      ON t.driver_id = dp.id
      AND t.status = 'completed'
      AND t.actual_end >= NOW() - INTERVAL '30 days'
    GROUP BY dp.id, u.full_name, dp.license_class, dp.rating
    ORDER BY completed_trips_30d DESC, dp.rating DESC
    LIMIT 5
  `);

  return res.rows;
}

async function exportAllCsv() {
  const [vehicles, drivers, routes, trips, bookings, maintenance, fuelLogs] =
    await Promise.all([
      query(`SELECT * FROM vehicles ORDER BY reg_number`),
      query(
        `SELECT dp.*, u.email, u.full_name, u.phone
         FROM driver_profiles dp JOIN users u ON u.id = dp.user_id
         ORDER BY u.full_name`
      ),
      query(`SELECT * FROM routes ORDER BY code`),
      query(`SELECT * FROM trips ORDER BY scheduled_start DESC`),
      query(`SELECT * FROM bookings ORDER BY created_at DESC`),
      query(`SELECT * FROM maintenance_records ORDER BY service_date DESC`),
      query(`SELECT * FROM fuel_logs ORDER BY fueled_at DESC`),
    ]);

  return {
    generated_at: new Date().toISOString(),
    format: 'zip-ready-json-bundle',
    tables: {
      vehicles: vehicles.rows,
      drivers: drivers.rows,
      routes: routes.rows,
      trips: trips.rows,
      bookings: bookings.rows,
      maintenance_records: maintenance.rows,
      fuel_logs: fuelLogs.rows,
    },
  };
}

module.exports = {
  getKpis,
  getFuelEfficiency,
  getMaintenanceCost,
  getRevenue,
  getTripVolume,
  getDriverLeaderboard,
  exportAllCsv,
};
