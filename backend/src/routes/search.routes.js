const express = require('express');
const { authenticate } = require('../middleware/auth');
const { query } = require('../db');

const router = express.Router();

router.use(authenticate);

// GET /api/v1/search?q=...
router.get('/', async (req, res, next) => {
  try {
    const q = String(req.query.q || '').trim();
    if (!q) {
      return res.status(200).json({ trips: [], vehicles: [], drivers: [], bookings: [] });
    }

    const pattern = `%${q}%`;

    const [trips, vehicles, drivers, bookings] = await Promise.all([
      query(
        `SELECT id, trip_number, status FROM trips
         WHERE trip_number ILIKE $1 OR id::text ILIKE $1
         LIMIT 5`,
        [pattern]
      ),
      query(
        `SELECT id, reg_number, make, model, status FROM vehicles
         WHERE reg_number ILIKE $1 OR make ILIKE $1 OR model ILIKE $1
         LIMIT 5`,
        [pattern]
      ),
      query(
        `SELECT dp.id, u.full_name, dp.license_number, dp.status
         FROM driver_profiles dp
         JOIN users u ON u.id = dp.user_id
         WHERE u.full_name ILIKE $1 OR dp.license_number ILIKE $1
         LIMIT 5`,
        [pattern]
      ),
      query(
        `SELECT id, booking_reference, origin, destination, status
         FROM bookings
         WHERE booking_reference ILIKE $1 OR id::text ILIKE $1
         LIMIT 5`,
        [pattern]
      ),
    ]);

    return res.status(200).json({
      trips: trips.rows,
      vehicles: vehicles.rows,
      drivers: drivers.rows,
      bookings: bookings.rows,
    });
  } catch (err) {
    return next(err);
  }
});

module.exports = router;
