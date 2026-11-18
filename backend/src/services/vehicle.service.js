const { query } = require('../db');
const { NotFound, Conflict, BadRequest } = require('../utils/errors');

async function listVehicles({ status, type, search, page = 1, limit = 20 }) {
  const conditions = [];
  const params = [];

  if (status) {
    params.push(status);
    conditions.push(`v.status = $${params.length}`);
  }
  if (type) {
    params.push(type);
    conditions.push(`v.vehicle_type = $${params.length}`);
  }
  if (search) {
    params.push(`%${search}%`);
    conditions.push(
      `(v.reg_number ILIKE $${params.length} OR v.make ILIKE $${params.length} OR v.model ILIKE $${params.length} OR v.vin ILIKE $${params.length})`
    );
  }

  const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const offset = (page - 1) * limit;

  const countRes = await query(
    `SELECT COUNT(*)::int AS total FROM vehicles v ${whereClause}`,
    params
  );
  const total = countRes.rows[0]?.total || 0;

  const dataParams = [...params, limit, offset];
  const dataRes = await query(
    `SELECT v.*,
            COUNT(m.id)::int AS maintenance_count
     FROM vehicles v
     LEFT JOIN maintenance_records m ON m.vehicle_id = v.id
     ${whereClause}
     GROUP BY v.id
     ORDER BY v.created_at DESC
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

async function getVehicle(id) {
  const vehicleRes = await query(`SELECT * FROM vehicles WHERE id = $1`, [id]);
  const vehicle = vehicleRes.rows[0];
  if (!vehicle) {
    throw NotFound('Vehicle not found', 'VEHICLE_NOT_FOUND');
  }

  const [maintRes, tripsRes] = await Promise.all([
    query(
      `SELECT * FROM maintenance_records
       WHERE vehicle_id = $1
       ORDER BY service_date DESC, created_at DESC
       LIMIT 5`,
      [id]
    ),
    query(
      `SELECT t.*, r.code AS route_code, r.origin, r.destination
       FROM trips t
       LEFT JOIN routes r ON r.id = t.route_id
       WHERE t.vehicle_id = $1
       ORDER BY t.scheduled_start DESC
       LIMIT 10`,
      [id]
    ),
  ]);

  return {
    ...vehicle,
    recent_maintenance: maintRes.rows,
    recent_trips: tripsRes.rows,
  };
}

async function createVehicle(data) {
  const dupRes = await query(
    `SELECT id FROM vehicles WHERE lower(reg_number) = lower($1) OR lower(vin) = lower($2)`,
    [data.reg_number, data.vin]
  );
  if (dupRes.rows.length > 0) {
    throw Conflict('Vehicle with this registration number or VIN already exists', 'DUPLICATE_VEHICLE');
  }

  const res = await query(
    `INSERT INTO vehicles (
       reg_number, vin, make, model, year, vehicle_type,
       capacity_kg, volume_cbm, fuel_type, odometer_km, status, insurance_expiry
     ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
     RETURNING *`,
    [
      data.reg_number,
      data.vin,
      data.make,
      data.model,
      data.year,
      data.vehicle_type,
      data.capacity_kg,
      data.volume_cbm ?? null,
      data.fuel_type ?? 'diesel',
      data.odometer_km ?? 0,
      data.status ?? 'available',
      data.insurance_expiry,
    ]
  );
  return res.rows[0];
}

async function updateVehicle(id, data) {
  const existing = await query(`SELECT * FROM vehicles WHERE id = $1`, [id]);
  if (!existing.rows[0]) {
    throw NotFound('Vehicle not found', 'VEHICLE_NOT_FOUND');
  }

  if (data.reg_number) {
    const dup = await query(
      `SELECT id FROM vehicles WHERE lower(reg_number) = lower($1) AND id <> $2`,
      [data.reg_number, id]
    );
    if (dup.rows.length > 0) {
      throw Conflict('Registration number already in use', 'DUPLICATE_REG_NUMBER');
    }
  }

  const fields = [];
  const params = [];
  const allowed = [
    'reg_number',
    'vin',
    'make',
    'model',
    'year',
    'vehicle_type',
    'capacity_kg',
    'volume_cbm',
    'fuel_type',
    'odometer_km',
    'status',
    'insurance_expiry',
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
    `UPDATE vehicles
     SET ${fields.join(', ')}, updated_at = NOW()
     WHERE id = $${params.length}
     RETURNING *`,
    params
  );
  return res.rows[0];
}

async function softDeleteVehicle(id) {
  const res = await query(
    `UPDATE vehicles
     SET status = 'inactive', updated_at = NOW()
     WHERE id = $1
     RETURNING *`,
    [id]
  );
  if (!res.rows[0]) {
    throw NotFound('Vehicle not found', 'VEHICLE_NOT_FOUND');
  }
  return res.rows[0];
}

async function getMaintenanceHistory(id) {
  const exists = await query(`SELECT id FROM vehicles WHERE id = $1`, [id]);
  if (!exists.rows[0]) {
    throw NotFound('Vehicle not found', 'VEHICLE_NOT_FOUND');
  }

  const res = await query(
    `SELECT * FROM maintenance_records
     WHERE vehicle_id = $1
     ORDER BY service_date DESC, created_at DESC`,
    [id]
  );
  return res.rows;
}

async function addMaintenance(id, data) {
  const exists = await query(`SELECT id FROM vehicles WHERE id = $1`, [id]);
  if (!exists.rows[0]) {
    throw NotFound('Vehicle not found', 'VEHICLE_NOT_FOUND');
  }

  const res = await query(
    `INSERT INTO maintenance_records (
       vehicle_id, maintenance_type, description, cost,
       odometer_at_service, service_date, next_service_date, performed_by, status
     ) VALUES ($1, $2, $3, $4, $5, COALESCE($6::date, CURRENT_DATE), $7::date, $8, $9)
     RETURNING *`,
    [
      id,
      data.maintenance_type,
      data.description,
      data.cost ?? 0,
      data.odometer_at_service ?? null,
      data.service_date ?? null,
      data.next_service_date ?? null,
      data.performed_by ?? null,
      data.status ?? 'in_progress',
    ]
  );
  return res.rows[0];
}

async function getVehicleStats(id) {
  const exists = await query(`SELECT id, reg_number FROM vehicles WHERE id = $1`, [id]);
  if (!exists.rows[0]) {
    throw NotFound('Vehicle not found', 'VEHICLE_NOT_FOUND');
  }

  const res = await query(
    `SELECT
       v.id AS vehicle_id,
       v.reg_number,
       COUNT(DISTINCT t.id) FILTER (WHERE t.status <> 'cancelled')::int AS total_trips,
       ROUND(COALESCE(SUM(r.distance_km) FILTER (WHERE t.status = 'completed'), 0)::numeric, 2) AS total_km,
       ROUND(COALESCE((SELECT SUM(fl.total_cost) FROM fuel_logs fl WHERE fl.vehicle_id = v.id), 0)::numeric, 2) AS total_fuel_cost,
       ROUND(COALESCE((SELECT SUM(mr.cost) FROM maintenance_records mr WHERE mr.vehicle_id = v.id), 0)::numeric, 2) AS total_maintenance_cost
     FROM vehicles v
     LEFT JOIN trips t ON t.vehicle_id = v.id
     LEFT JOIN routes r ON r.id = t.route_id
     WHERE v.id = $1
     GROUP BY v.id, v.reg_number`,
    [id]
  );
  return res.rows[0];
}

module.exports = {
  listVehicles,
  getVehicle,
  createVehicle,
  updateVehicle,
  softDeleteVehicle,
  getMaintenanceHistory,
  addMaintenance,
  getVehicleStats,
};
