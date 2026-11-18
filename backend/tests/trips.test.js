process.env.NODE_ENV = 'test';
process.env.JWT_ACCESS_SECRET = 'test-access-secret-key-for-jest-suite';

const request = require('supertest');
const crypto = require('crypto');
const { generateAccessToken } = require('../src/utils/jwt');

const state = { trips: [], drivers: [], tracking: [] };

function makePgError(message) {
  const err = new Error(message);
  err.code = 'P0001';
  return err;
}

function executeMockQuery(sql, params = []) {
  const s = sql.replace(/\s+/g, ' ').trim();
  if (s.startsWith('SELECT COUNT(*)::int AS total FROM trips')) return { rows: [{ total: state.trips.length }] };
  if (s.includes('FROM trips t JOIN vehicles v') && s.includes('GROUP BY')) return { rows: state.trips };
  if (s.includes('FROM trips t JOIN vehicles v') && s.includes('WHERE t.id = $1')) {
    const t = state.trips.find((x) => x.id === params[0]);
    return { rows: t ? [{ ...t }] : [] };
  }
  if (s === 'SELECT * FROM trips WHERE id = $1') {
    const t = state.trips.find((x) => x.id === params[0]);
    return { rows: t ? [{ ...t }] : [] };
  }
  if (s.startsWith('INSERT INTO trips')) {
    const [, vehicleId, driverId, , , start, end] = params;
    const drv = state.drivers.find((d) => d.id === driverId);
    if (drv && new Date(drv.license_expiry) < new Date(start)) throw makePgError('License expired');
    const overlap = state.trips.find((t) => t.vehicle_id === vehicleId && t.status !== 'cancelled' && new Date(t.scheduled_start) < new Date(end) && new Date(t.scheduled_end) > new Date(start));
    if (overlap) throw makePgError('Vehicle overlap');
    const t = { id: crypto.randomUUID(), trip_number: params[0], vehicle_id: vehicleId, driver_id: driverId, status: 'scheduled', scheduled_start: start, scheduled_end: end };
    state.trips.push(t);
    return { rows: [t] };
  }
  if (s.startsWith('UPDATE trips SET status = $1')) {
    const t = state.trips.find((x) => x.id === params[1]);
    if (t) t.status = params[0];
    return { rows: t ? [{ ...t }] : [] };
  }
  if (s.startsWith('UPDATE trips SET current_lat = $1')) {
    const t = state.trips.find((x) => x.id === params[2]);
    if (t) { t.current_lat = params[0]; t.current_lng = params[1]; }
    return { rows: t ? [{ ...t }] : [] };
  }
  if (s.startsWith('INSERT INTO tracking_events')) {
    state.tracking.push({ trip_id: params[0] });
    return { rows: [{ id: crypto.randomUUID() }] };
  }
  return { rows: [] };
}

jest.mock('../src/db', () => ({
  query: jest.fn((sql, params) => Promise.resolve(executeMockQuery(sql, params))),
  pool: {
    connect: jest.fn(async () => ({ query: jest.fn((sql, params) => Promise.resolve(executeMockQuery(sql, params))), release: jest.fn() })),
    end: jest.fn(async () => {}),
    on: jest.fn(),
  },
}));

const app = require('../src/server');
const { pool } = require('../src/db');

const adminToken = generateAccessToken({ id: '11111111-1111-4111-8111-111111111111', email: 'admin@tms.com', user_type: 'admin' });
const d1Id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const d2Id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const d1Token = generateAccessToken({ id: '22222222-2222-4222-8222-222222222222', email: 'd1@tms.com', user_type: 'driver' }, { id: d1Id });
const custToken = generateAccessToken({ id: '33333333-3333-4333-8333-333333333333', email: 'c1@tms.com', user_type: 'customer' });
const vId = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const rId = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';

describe('Trips API (8 tests)', () => {
  afterAll(async () => { await pool.end(); });
  beforeEach(() => {
    state.trips = [];
    state.tracking = [];
    state.drivers = [{ id: d1Id, license_expiry: '2030-01-01' }, { id: d2Id, license_expiry: '2020-01-01' }];
  });

  test('1. Admin schedules trip (201)', async () => {
    const res = await request(app).post('/api/v1/trips').set('Authorization', `Bearer ${adminToken}`).send({
      vehicle_id: vId, driver_id: d1Id, route_id: rId, scheduled_start: '2026-12-01T08:00:00Z', scheduled_end: '2026-12-01T16:00:00Z',
    });
    expect(res.status).toBe(201);
  });

  test('2. Overlapping vehicle time returns 409', async () => {
    state.trips.push({ id: 't1', vehicle_id: vId, driver_id: d1Id, status: 'scheduled', scheduled_start: '2026-12-01T08:00:00Z', scheduled_end: '2026-12-01T16:00:00Z' });
    const res = await request(app).post('/api/v1/trips').set('Authorization', `Bearer ${adminToken}`).send({
      vehicle_id: vId, driver_id: d1Id, route_id: rId, scheduled_start: '2026-12-01T10:00:00Z', scheduled_end: '2026-12-01T18:00:00Z',
    });
    expect(res.status).toBe(409);
  });

  test('3. Expired driver license returns 409', async () => {
    const res = await request(app).post('/api/v1/trips').set('Authorization', `Bearer ${adminToken}`).send({
      vehicle_id: vId, driver_id: d2Id, route_id: rId, scheduled_start: '2026-12-01T08:00:00Z', scheduled_end: '2026-12-01T16:00:00Z',
    });
    expect(res.status).toBe(409);
  });

  test('4. Valid transition scheduled -> in_progress succeeds', async () => {
    const tid = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';
    state.trips.push({ id: tid, driver_id: d1Id, status: 'scheduled' });
    const res = await request(app).patch(`/api/v1/trips/${tid}/status`).set('Authorization', `Bearer ${d1Token}`).send({ status: 'in_progress' });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('in_progress');
  });

  test('5. Invalid transition scheduled -> completed returns 400', async () => {
    const tid = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';
    state.trips.push({ id: tid, driver_id: d1Id, status: 'scheduled' });
    const res = await request(app).patch(`/api/v1/trips/${tid}/status`).set('Authorization', `Bearer ${adminToken}`).send({ status: 'completed' });
    expect(res.status).toBe(400);
  });

  test('6. Driver viewing another driver trip returns 403', async () => {
    const tid = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';
    state.trips.push({ id: tid, driver_id: d2Id, status: 'scheduled' });
    const res = await request(app).get(`/api/v1/trips/${tid}`).set('Authorization', `Bearer ${d1Token}`);
    expect(res.status).toBe(403);
  });

  test('7. Customer sees empty trip list', async () => {
    const res = await request(app).get('/api/v1/trips').set('Authorization', `Bearer ${custToken}`);
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([]);
  });

  test('8. Driver pushes GPS location ping', async () => {
    const tid = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';
    state.trips.push({ id: tid, driver_id: d1Id, status: 'in_progress' });
    const res = await request(app).post(`/api/v1/trips/${tid}/location`).set('Authorization', `Bearer ${d1Token}`).send({ lat: 28.61, lng: 77.2 });
    expect(res.status).toBe(200);
    expect(res.body.current_lat).toBe(28.61);
  });
});
