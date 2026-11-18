const crypto = require('crypto');
const { pool, query } = require('../db');
const { emitToRoom } = require('../socket');
const {
  AppError,
  BadRequest,
  Forbidden,
  NotFound,
  Conflict,
} = require('../utils/errors');

const VALID_TRANSITIONS = {
  scheduled: ['in_progress', 'cancelled'],
  in_progress: ['completed', 'cancelled'],
  completed: [],
  cancelled: [],
};

async function listTrips(user, { status, from, to, driver_id, vehicle_id, page = 1, limit = 20 } = {}) {
  if (user.role === 'customer') {
    return {
      data: [],
      pagination: { page, limit, total: 0, totalPages: 1 },
    };
  }

  const conditions = [];
  const params = [];

  if (user.role === 'driver') {
    params.push(user.driverId);
    conditions.push(`t.driver_id = $${params.length}`);
  } else if (driver_id) {
    params.push(driver_id);
    conditions.push(`t.driver_id = $${params.length}`);
  }

  if (status) {
    params.push(status);
    conditions.push(`t.status = $${params.length}`);
  }
  if (vehicle_id) {
    params.push(vehicle_id);
    conditions.push(`t.vehicle_id = $${params.length}`);
  }
  if (from) {
    params.push(from);
    conditions.push(`t.scheduled_start >= $${params.length}::timestamptz`);
  }
  if (to) {
    params.push(to);
    conditions.push(`t.scheduled_end <= $${params.length}::timestamptz`);
  }

  const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const offset = (page - 1) * limit;

  const countRes = await query(
    `SELECT COUNT(*)::int AS total FROM trips t ${whereClause}`,
    params
  );
  const total = countRes.rows[0]?.total || 0;

  const dataParams = [...params, limit, offset];
  const dataRes = await query(
    `SELECT t.*,
            v.reg_number AS vehicle_reg,
            u.full_name AS driver_name,
            r.origin,
            r.destination,
            COUNT(b.id)::int AS booking_count
     FROM trips t
     JOIN vehicles v ON v.id = t.vehicle_id
     JOIN driver_profiles dp ON dp.id = t.driver_id
     JOIN users u ON u.id = dp.user_id
     JOIN routes r ON r.id = t.route_id
     LEFT JOIN bookings b ON b.trip_id = t.id
     ${whereClause}
     GROUP BY t.id, v.reg_number, u.full_name, r.origin, r.destination
     ORDER BY t.scheduled_start DESC
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

async function getTrip(id, user) {
  if (user.role === 'customer') {
    throw Forbidden('Customers cannot access trip records directly', 'INSUFFICIENT_ROLE');
  }

  const tripRes = await query(
    `SELECT t.*,
            v.reg_number AS vehicle_reg, v.make AS vehicle_make, v.model AS vehicle_model,
            u.full_name AS driver_name, u.phone AS driver_phone, dp.license_number,
            r.code AS route_code, r.name AS route_name, r.origin, r.destination, r.distance_km
     FROM trips t
     JOIN vehicles v ON v.id = t.vehicle_id
     JOIN driver_profiles dp ON dp.id = t.driver_id
     JOIN users u ON u.id = dp.user_id
     JOIN routes r ON r.id = t.route_id
     WHERE t.id = $1`,
    [id]
  );

  const trip = tripRes.rows[0];
  if (!trip) {
    throw NotFound('Trip not found', 'TRIP_NOT_FOUND');
  }

  if (user.role === 'driver' && trip.driver_id !== user.driverId) {
    throw Forbidden('You can only view your own assigned trips', 'FORBIDDEN_TRIP_ACCESS');
  }

  const [eventsRes, bookingsRes] = await Promise.all([
    query(
      `SELECT * FROM tracking_events
       WHERE trip_id = $1
       ORDER BY occurred_at ASC, created_at ASC`,
      [id]
    ),
    query(
      `SELECT id, booking_reference, origin, destination, cargo_description, weight_kg, status
       FROM bookings
       WHERE trip_id = $1
       ORDER BY created_at ASC`,
      [id]
    ),
  ]);

  return {
    ...trip,
    tracking_events: eventsRes.rows,
    bookings: bookingsRes.rows,
  };
}

async function createTrip(data, user) {
  const tripNumber = `TRP-${new Date().getFullYear()}-${crypto
    .randomBytes(3)
    .toString('hex')
    .toUpperCase()}`;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const tripRes = await client.query(
      `INSERT INTO trips (
         trip_number, vehicle_id, driver_id, route_id, dispatcher_id,
         status, scheduled_start, scheduled_end, notes
       ) VALUES ($1, $2, $3, $4, $5, 'scheduled', $6, $7, $8)
       RETURNING *`,
      [
        tripNumber,
        data.vehicle_id,
        data.driver_id,
        data.route_id,
        user.id,
        data.scheduled_start,
        data.scheduled_end,
        data.notes ?? null,
      ]
    );
    const trip = tripRes.rows[0];

    if (data.booking_ids && data.booking_ids.length > 0) {
      await client.query(
        `UPDATE bookings
         SET trip_id = $1, status = 'confirmed', updated_at = NOW()
         WHERE id = ANY($2::uuid[]) AND status = 'pending'`,
        [trip.id, data.booking_ids]
      );
    }

    await client.query(
      `INSERT INTO tracking_events (trip_id, event_type, latitude, longitude, notes)
       VALUES ($1, 'trip_created', 0, 0, 'Trip created and scheduled')`,
      [trip.id]
    );

    await client.query('COMMIT');
    emitToRoom('admin', 'trip:created', trip);
    return trip;
  } catch (err) {
    await client.query('ROLLBACK');
    if (err instanceof AppError) {
      throw err;
    }
    // PostgreSQL PL/pgSQL RAISE EXCEPTION from overlap or license validity triggers
    if (err.code === 'P0001') {
      throw Conflict(err.message, 'TRIP_CONSTRAINT_VIOLATION');
    }
    throw err;
  } finally {
    client.release();
  }
}

async function updateStatus(id, nextStatus, user) {
  if (user.role === 'customer') {
    throw Forbidden('Customers cannot update trip status', 'INSUFFICIENT_ROLE');
  }

  const tripRes = await query(`SELECT * FROM trips WHERE id = $1`, [id]);
  const trip = tripRes.rows[0];
  if (!trip) {
    throw NotFound('Trip not found', 'TRIP_NOT_FOUND');
  }

  if (user.role === 'driver' && trip.driver_id !== user.driverId) {
    throw Forbidden('You can only update status for your own trips', 'FORBIDDEN_TRIP_ACCESS');
  }

  const allowedNext = VALID_TRANSITIONS[trip.status] || [];
  if (!allowedNext.includes(nextStatus)) {
    throw BadRequest(
      `Invalid status transition from '${trip.status}' to '${nextStatus}'`,
      'INVALID_STATUS_TRANSITION'
    );
  }

  const updatedRes = await query(
    `UPDATE trips SET status = $1, updated_at = NOW() WHERE id = $2 RETURNING *`,
    [nextStatus, id]
  );

  const eventType =
    nextStatus === 'in_progress'
      ? 'departure'
      : nextStatus === 'completed'
        ? 'arrival'
        : 'status_changed';

  await query(
    `INSERT INTO tracking_events (trip_id, event_type, latitude, longitude, notes)
     VALUES ($1, $2, COALESCE($3, 0), COALESCE($4, 0), $5)`,
    [id, eventType, trip.current_lat, trip.current_lng, `Trip status changed to ${nextStatus}`]
  );

  const updatedTrip = updatedRes.rows[0];
  emitToRoom(`trip:${id}`, 'status:change', { tripId: id, status: nextStatus });
  emitToRoom('admin', 'trip:update', updatedTrip);
  return updatedTrip;
}

async function updateLocation(id, { lat, lng }, user) {
  const tripRes = await query(`SELECT * FROM trips WHERE id = $1`, [id]);
  const trip = tripRes.rows[0];
  if (!trip) {
    throw NotFound('Trip not found', 'TRIP_NOT_FOUND');
  }

  if (user.role !== 'driver' || trip.driver_id !== user.driverId) {
    throw Forbidden('Only the assigned driver can update trip location', 'FORBIDDEN_TRIP_ACCESS');
  }

  const updatedRes = await query(
    `UPDATE trips
     SET current_lat = $1,
         current_lng = $2,
         last_location_update = NOW(),
         updated_at = NOW()
     WHERE id = $3
     RETURNING *`,
    [lat, lng, id]
  );

  await query(
    `INSERT INTO tracking_events (trip_id, event_type, latitude, longitude, notes)
     VALUES ($1, 'location_ping', $2, $3, 'Live GPS ping')`,
    [id, lat, lng]
  );

  const payload = {
    tripId: id,
    lat,
    lng,
    last_location_update: updatedRes.rows[0].last_location_update,
  };
  emitToRoom(`trip:${id}`, 'location:update', payload);
  emitToRoom('admin', 'location:update', payload);

  return updatedRes.rows[0];
}

async function getTracking(id, user) {
  if (user.role === 'customer') {
    throw Forbidden('Customers cannot access raw trip tracking', 'INSUFFICIENT_ROLE');
  }

  const tripRes = await query(`SELECT id, driver_id FROM trips WHERE id = $1`, [id]);
  const trip = tripRes.rows[0];
  if (!trip) {
    throw NotFound('Trip not found', 'TRIP_NOT_FOUND');
  }

  if (user.role === 'driver' && trip.driver_id !== user.driverId) {
    throw Forbidden('You can only view tracking for your own trips', 'FORBIDDEN_TRIP_ACCESS');
  }

  const eventsRes = await query(
    `SELECT * FROM tracking_events
     WHERE trip_id = $1
     ORDER BY occurred_at ASC, created_at ASC`,
    [id]
  );

  return eventsRes.rows;
}

module.exports = {
  listTrips,
  getTrip,
  createTrip,
  updateStatus,
  updateLocation,
  getTracking,
};
