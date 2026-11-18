const crypto = require('crypto');
const { pool, query } = require('../db');
const { emitToRoom } = require('../socket');
const {
  BadRequest,
  Forbidden,
  NotFound,
} = require('../utils/errors');

const BOOKING_TRANSITIONS = {
  pending: ['confirmed', 'cancelled'],
  confirmed: ['in_transit', 'cancelled'],
  in_transit: ['delivered'],
  delivered: [],
  cancelled: [],
};

async function getCustomerProfileId(userId) {
  const res = await query(`SELECT id FROM customer_profiles WHERE user_id = $1`, [userId]);
  return res.rows[0]?.id || null;
}

async function listBookings(user, { status, search, page = 1, limit = 20 } = {}) {
  const conditions = [];
  const params = [];

  if (user.role === 'customer') {
    const customerId = await getCustomerProfileId(user.id);
    if (!customerId) {
      return { data: [], pagination: { page, limit, total: 0, totalPages: 1 } };
    }
    params.push(customerId);
    conditions.push(`b.customer_id = $${params.length}`);
  }

  if (status) {
    params.push(status);
    conditions.push(`b.status = $${params.length}`);
  }

  if (search) {
    params.push(`%${search}%`);
    conditions.push(
      `(b.booking_reference ILIKE $${params.length} OR b.origin ILIKE $${params.length} OR b.destination ILIKE $${params.length} OR b.cargo_description ILIKE $${params.length})`
    );
  }

  const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const offset = (page - 1) * limit;

  const countRes = await query(
    `SELECT COUNT(*)::int AS total FROM bookings b ${whereClause}`,
    params
  );
  const total = countRes.rows[0]?.total || 0;

  const dataParams = [...params, limit, offset];
  const dataRes = await query(
    `SELECT b.*, cp.company_name
     FROM bookings b
     JOIN customer_profiles cp ON cp.id = b.customer_id
     ${whereClause}
     ORDER BY b.created_at DESC
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

async function getBooking(id, user) {
  const res = await query(
    `SELECT b.*, cp.user_id AS customer_user_id, cp.company_name
     FROM bookings b
     JOIN customer_profiles cp ON cp.id = b.customer_id
     WHERE b.id = $1`,
    [id]
  );

  const booking = res.rows[0];
  if (!booking) {
    throw NotFound('Booking not found', 'BOOKING_NOT_FOUND');
  }

  if (user.role === 'customer' && booking.customer_user_id !== user.id) {
    throw Forbidden('You can only view your own bookings', 'FORBIDDEN_BOOKING_ACCESS');
  }

  return booking;
}

async function createBooking(data, user) {
  const customerId = await getCustomerProfileId(user.id);
  if (!customerId) {
    throw Forbidden('Customer profile not found for user', 'CUSTOMER_PROFILE_MISSING');
  }

  // Derive quoted_price from matching active route if available; otherwise weight * 2.5 + 500
  const routeRes = await query(
    `SELECT distance_km, base_rate_per_km
     FROM routes
     WHERE lower(origin) = lower($1) AND lower(destination) = lower($2) AND is_active = TRUE
     LIMIT 1`,
    [data.pickup_location, data.delivery_location]
  );

  let quotedPrice;
  if (routeRes.rows[0]) {
    const { distance_km, base_rate_per_km } = routeRes.rows[0];
    quotedPrice = Number((Number(distance_km) * Number(base_rate_per_km) + Number(data.cargo_weight_kg) * 0.5).toFixed(2));
  } else {
    quotedPrice = Number((Number(data.cargo_weight_kg) * 2.5 + 500).toFixed(2));
  }

  const ref = `BK-${new Date().getFullYear()}-${crypto
    .randomBytes(3)
    .toString('hex')
    .toUpperCase()}`;

  const res = await query(
    `INSERT INTO bookings (
       booking_reference, customer_id, origin, destination,
       cargo_description, weight_kg, volume_cbm, quoted_price,
       status, pickup_window_start
     ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'pending', $9)
     RETURNING *`,
    [
      ref,
      customerId,
      data.pickup_location,
      data.delivery_location,
      data.cargo_description,
      data.cargo_weight_kg,
      data.volume_cbm ?? null,
      quotedPrice,
      data.pickup_datetime,
    ]
  );

  const booking = res.rows[0];
  emitToRoom('admin', 'booking:new', booking);
  return booking;
}

async function assignBooking(id, tripId, _user) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const bookingRes = await client.query(
      `UPDATE bookings
       SET trip_id = $1, status = 'confirmed', updated_at = NOW()
       WHERE id = $2
       RETURNING *`,
      [tripId, id]
    );
    if (!bookingRes.rows[0]) {
      throw NotFound('Booking not found', 'BOOKING_NOT_FOUND');
    }

    const tripRes = await client.query(
      `SELECT id, status FROM trips WHERE id = $1`,
      [tripId]
    );
    if (!tripRes.rows[0]) {
      throw NotFound('Trip not found', 'TRIP_NOT_FOUND');
    }
    if (tripRes.rows[0].status !== 'scheduled') {
      await client.query(
        `UPDATE trips SET updated_at = NOW() WHERE id = $1`,
        [tripId]
      );
    }

    await client.query(
      `INSERT INTO tracking_events (trip_id, event_type, latitude, longitude, notes)
       VALUES ($1, 'booking_confirmed', 0, 0, $2)`,
      [tripId, `Booking ${bookingRes.rows[0].booking_reference} confirmed and assigned`]
    );

    await client.query('COMMIT');
    emitToRoom('admin', 'booking:assigned', { bookingId: id, tripId });
    return bookingRes.rows[0];
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

async function updateBookingStatus(id, nextStatus, _user) {
  const res = await query(`SELECT * FROM bookings WHERE id = $1`, [id]);
  const booking = res.rows[0];
  if (!booking) {
    throw NotFound('Booking not found', 'BOOKING_NOT_FOUND');
  }

  const allowed = BOOKING_TRANSITIONS[booking.status] || [];
  if (!allowed.includes(nextStatus)) {
    throw BadRequest(
      `Invalid booking status transition from '${booking.status}' to '${nextStatus}'`,
      'INVALID_STATUS_TRANSITION'
    );
  }

  const updatedRes = await query(
    `UPDATE bookings
     SET status = $1,
         delivered_at = CASE WHEN $1 = 'delivered' THEN COALESCE(delivered_at, NOW()) ELSE delivered_at END,
         updated_at = NOW()
     WHERE id = $2
     RETURNING *`,
    [nextStatus, id]
  );

  if (booking.trip_id) {
    await query(
      `INSERT INTO tracking_events (trip_id, event_type, latitude, longitude, notes)
       VALUES ($1, 'status_changed', 0, 0, $2)`,
      [booking.trip_id, `Booking ${booking.booking_reference} updated to ${nextStatus}`]
    );
  }

  emitToRoom('admin', 'status:change', { bookingId: id, status: nextStatus });
  return updatedRes.rows[0];
}

async function generateInvoice(id) {
  const res = await query(`SELECT * FROM bookings WHERE id = $1`, [id]);
  const booking = res.rows[0];
  if (!booking) {
    throw NotFound('Booking not found', 'BOOKING_NOT_FOUND');
  }
  if (booking.status !== 'delivered') {
    throw BadRequest('Invoice can only be generated for delivered bookings', 'BOOKING_NOT_DELIVERED');
  }
  if (booking.invoice_number) {
    return booking;
  }

  const now = new Date();
  const ym = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`;
  const seqRes = await query(`SELECT nextval('seq_invoice_number')::text AS seq`);
  const seqNum = (seqRes.rows[0]?.seq || '1').padStart(5, '0');
  const invoiceNumber = `INV-${ym}-${seqNum}`;

  const updatedRes = await query(
    `UPDATE bookings
     SET invoice_number = $1, updated_at = NOW()
     WHERE id = $2
     RETURNING *`,
    [invoiceNumber, id]
  );
  return updatedRes.rows[0];
}

module.exports = {
  listBookings,
  getBooking,
  createBooking,
  assignBooking,
  updateBookingStatus,
  generateInvoice,
};
