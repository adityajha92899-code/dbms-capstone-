process.env.NODE_ENV = 'test';
process.env.JWT_ACCESS_SECRET = 'test-access-secret-key-for-jest-suite';
process.env.JWT_REFRESH_SECRET = 'test-refresh-secret-key-for-jest-suite';

const request = require('supertest');
const crypto = require('crypto');
const { generateAccessToken } = require('../src/utils/jwt');

const state = {
  trips: [],
  bookings: [],
  trackingEvents: [],
  drivers: [],
  txLog: [],
};

function makePgError(message) {
  const err = new Error(message);
  err.code = 'P0001';
  return err;
}

function executeMockQuery(sql, params = [], isClient = false) {
  const s = sql.replace(/\s+/g, ' ').trim();

  if (isClient && (s === 'BEGIN' || s === 'COMMIT' || s === 'ROLLBACK')) {
    state.txLog.push(s);
    return { rows: [] };
  }

  // Insert trip (simulate PG overlap & license validity triggers)
  if (s.startsWith('INSERT INTO trips')) {
    const [tripNumber, vehicleId, driverId, routeId, dispatcherId, start, end, notes] = params;

    const driver = state.drivers.find((d) => d.id === driverId);
    if (driver && new Date(driver.license_expiry) < new Date(start)) {
      throw makePgError(`Driver ${driverId} license expired on ${driver.license_expiry}`);
    }

    const overlap = state.trips.find(
      (t) =>
        t.vehicle_id === vehicleId &&
        t.status !== 'cancelled' &&
        new Date(t.scheduled_start) < new Date(end) &&
        new Date(t.scheduled_end) > new Date(start)
    );
    if (overlap) {
      throw makePgError(`Vehicle ${vehicleId} is already booked on overlapping trip ${overlap.trip_number}`);
    }

    const trip = {
      id: crypto.randomUUID(),
      trip_number: tripNumber,
      vehicle_id: vehicleId,
      driver_id: driverId,
      route_id: routeId,
      dispatcher_id: dispatcherId,
      status: 'scheduled',
      scheduled_start: start,
      scheduled_end: end,
      notes,
    };
    state.trips.push(trip);
    return { rows: [trip] };
  }

  // Select trip detail
  if (s.includes('FROM trips t JOIN vehicles v') && s.includes('WHERE t.id = $1')) {
    const t = state.trips.find((x) => x.id === params[0]);
    return { rows: t ? [{ ...t }] : [] };
  }

  // Select trip for assignBooking
  if (s === 'SELECT id, status FROM trips WHERE id = $1') {
    if (isClient) state.txLog.push('SELECT_TRIP');
    const t = state.trips.find((x) => x.id === params[0]);
    return { rows: t ? [{ id: t.id, status: t.status }] : [] };
  }

  // Select booking detail
  if (s.includes('FROM bookings b JOIN customer_profiles cp') && s.includes('WHERE b.id = $1')) {
    const b = state.bookings.find((x) => x.id === params[0]);
    return { rows: b ? [{ ...b }] : [] };
  }

  // Assign booking to trip
  if (s.startsWith("UPDATE bookings SET trip_id = $1, status = 'confirmed'")) {
    if (isClient) state.txLog.push('UPDATE_BOOKING');
    const [tripId, bookingId] = params;
    const b = state.bookings.find((x) => x.id === bookingId);
    if (b) {
      b.trip_id = tripId;
      b.status = 'confirmed';
    }
    return { rows: b ? [{ ...b }] : [] };
  }

  // Insert tracking event
  if (s.startsWith('INSERT INTO tracking_events')) {
    if (isClient) state.txLog.push('INSERT_TRACKING_EVENT');
    const evt = { id: crypto.randomUUID(), trip_id: params[0], sql: s };
    state.trackingEvents.push(evt);
    return { rows: [evt] };
  }

  return { rows: [] };
}

jest.mock('../src/db', () => ({
  query: jest.fn((sql, params) => Promise.resolve(executeMockQuery(sql, params, false))),
  pool: {
    connect: jest.fn(async () => ({
      query: jest.fn((sql, params) => Promise.resolve(executeMockQuery(sql, params, true))),
      release: jest.fn(),
    })),
    on: jest.fn(),
  },
}));

const app = require('../src/server');

const adminToken = generateAccessToken({
  id: '11111111-1111-4111-8111-111111111111',
  email: 'admin@tms.com',
  user_type: 'admin',
});

const driver1ProfileId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const driver2ProfileId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

const driver1Token = generateAccessToken(
  { id: '22222222-2222-4222-8222-222222222222', email: 'driver1@tms.com', user_type: 'driver' },
  { id: driver1ProfileId }
);

const customer1Token = generateAccessToken({
  id: '33333333-3333-4333-8333-333333333333',
  email: 'customer1@tms.com',
  user_type: 'customer',
});

const vehicleId = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const routeId = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';

describe('Phase 4 Workflow APIs (Trips, Bookings, Tracking)', () => {
  beforeEach(() => {
    state.trips = [];
    state.bookings = [];
    state.trackingEvents = [];
    state.txLog = [];
    state.drivers = [
      { id: driver1ProfileId, license_expiry: '2030-01-01' },
      { id: driver2ProfileId, license_expiry: '2020-01-01' }, // expired
    ];
  });

  test('Creating trip with overlapping vehicle time returns 409', async () => {
    const basePayload = {
      vehicle_id: vehicleId,
      driver_id: driver1ProfileId,
      route_id: routeId,
      scheduled_start: '2026-12-01T08:00:00Z',
      scheduled_end: '2026-12-01T16:00:00Z',
    };

    const first = await request(app)
      .post('/api/v1/trips')
      .set('Authorization', `Bearer ${adminToken}`)
      .send(basePayload);
    expect(first.status).toBe(201);

    const overlap = await request(app)
      .post('/api/v1/trips')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        ...basePayload,
        scheduled_start: '2026-12-01T12:00:00Z',
        scheduled_end: '2026-12-01T18:00:00Z',
      });
    expect(overlap.status).toBe(409);
  });

  test('Creating trip with expired license returns 409', async () => {
    const res = await request(app)
      .post('/api/v1/trips')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        vehicle_id: vehicleId,
        driver_id: driver2ProfileId,
        route_id: routeId,
        scheduled_start: '2026-12-01T08:00:00Z',
        scheduled_end: '2026-12-01T16:00:00Z',
      });

    expect(res.status).toBe(409);
  });

  test('Driver viewing another driver trip returns 403', async () => {
    const otherTripId = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';
    state.trips.push({
      id: otherTripId,
      trip_number: 'TRP-2026-OTHER',
      vehicle_id: vehicleId,
      driver_id: driver2ProfileId,
      route_id: routeId,
      status: 'scheduled',
    });

    const res = await request(app)
      .get(`/api/v1/trips/${otherTripId}`)
      .set('Authorization', `Bearer ${driver1Token}`);

    expect(res.status).toBe(403);
  });

  test('Customer viewing another customer booking returns 403', async () => {
    const otherBookingId = 'ffffffff-ffff-4fff-8fff-ffffffffffff';
    state.bookings.push({
      id: otherBookingId,
      booking_reference: 'BK-2026-OTHER',
      customer_user_id: '99999999-9999-4999-8999-999999999999',
      status: 'pending',
    });

    const res = await request(app)
      .get(`/api/v1/bookings/${otherBookingId}`)
      .set('Authorization', `Bearer ${customer1Token}`);

    expect(res.status).toBe(403);
  });

  test('Booking assign to trip updates booking and verifies trip inside a transaction', async () => {
    const tripId = '12121212-1212-4121-8121-121212121212';
    const bookingId = '34343434-3434-4343-8343-343434343434';

    state.trips.push({
      id: tripId,
      trip_number: 'TRP-2026-0001',
      vehicle_id: vehicleId,
      driver_id: driver1ProfileId,
      route_id: routeId,
      status: 'scheduled',
    });
    state.bookings.push({
      id: bookingId,
      booking_reference: 'BK-2026-0001',
      trip_id: null,
      status: 'pending',
    });

    const res = await request(app)
      .patch(`/api/v1/bookings/${bookingId}/assign`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ trip_id: tripId });

    expect(res.status).toBe(200);
    expect(res.body.trip_id).toBe(tripId);
    expect(res.body.status).toBe('confirmed');
    expect(state.txLog).toEqual([
      'BEGIN',
      'UPDATE_BOOKING',
      'SELECT_TRIP',
      'INSERT_TRACKING_EVENT',
      'COMMIT',
    ]);
  });
});
