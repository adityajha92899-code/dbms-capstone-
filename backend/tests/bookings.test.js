process.env.NODE_ENV = 'test';
process.env.JWT_ACCESS_SECRET = 'test-access-secret-key-for-jest-suite';

const request = require('supertest');
const crypto = require('crypto');
const { generateAccessToken } = require('../src/utils/jwt');

const state = { bookings: [], trips: [], customerProfiles: [] };

function executeMockQuery(sql, params = []) {
  const s = sql.replace(/\s+/g, ' ').trim();
  if (s.startsWith('SELECT id FROM customer_profiles WHERE user_id = $1')) {
    const cp = state.customerProfiles.find((c) => c.user_id === params[0]);
    return { rows: cp ? [{ id: cp.id }] : [] };
  }
  if (s.startsWith('INSERT INTO bookings')) {
    const b = { id: crypto.randomUUID(), booking_reference: params[0], customer_id: params[1], origin: params[2], destination: params[3], quoted_price: params[7], status: 'pending' };
    state.bookings.push(b);
    return { rows: [b] };
  }
  if (s.includes('FROM bookings b JOIN customer_profiles cp') && s.includes('WHERE b.id = $1')) {
    const b = state.bookings.find((x) => x.id === params[0]);
    return { rows: b ? [{ ...b }] : [] };
  }
  if (s.startsWith("UPDATE bookings SET trip_id = $1, status = 'confirmed'")) {
    const b = state.bookings.find((x) => x.id === params[1]);
    if (b) { b.trip_id = params[0]; b.status = 'confirmed'; }
    return { rows: b ? [{ ...b }] : [] };
  }
  if (s === 'SELECT id, status FROM trips WHERE id = $1') {
    const t = state.trips.find((x) => x.id === params[0]);
    return { rows: t ? [{ id: t.id, status: t.status }] : [] };
  }
  if (s === 'SELECT * FROM bookings WHERE id = $1') {
    const b = state.bookings.find((x) => x.id === params[0]);
    return { rows: b ? [{ ...b }] : [] };
  }
  if (s.startsWith('UPDATE bookings SET status = $1')) {
    const b = state.bookings.find((x) => x.id === params[1]);
    if (b) b.status = params[0];
    return { rows: b ? [{ ...b }] : [] };
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
const cust1UserId = '22222222-2222-4222-8222-222222222222';
const cust1Token = generateAccessToken({ id: cust1UserId, email: 'c1@tms.com', user_type: 'customer' });

describe('Bookings API (6 tests)', () => {
  afterAll(async () => { await pool.end(); });
  beforeEach(() => {
    state.bookings = [];
    state.trips = [{ id: '33333333-3333-4333-8333-333333333333', status: 'scheduled' }];
    state.customerProfiles = [{ id: 'cp1', user_id: cust1UserId }];
  });

  test('1. Customer creates booking with quoted_price (201)', async () => {
    const res = await request(app).post('/api/v1/bookings').set('Authorization', `Bearer ${cust1Token}`).send({
      pickup_location: 'Delhi', delivery_location: 'Mumbai', pickup_datetime: '2026-12-05T09:00:00Z',
      cargo_weight_kg: 1000, cargo_description: 'Electronics pallets',
    });
    expect(res.status).toBe(201);
    expect(res.body.quoted_price).toBe(3000);
  });

  test('2. Admin cannot create customer booking (403)', async () => {
    const res = await request(app).post('/api/v1/bookings').set('Authorization', `Bearer ${adminToken}`).send({
      pickup_location: 'Delhi', delivery_location: 'Mumbai', pickup_datetime: '2026-12-05T09:00:00Z',
      cargo_weight_kg: 1000, cargo_description: 'Test',
    });
    expect(res.status).toBe(403);
  });

  test('3. Customer viewing other customer booking returns 403', async () => {
    state.bookings.push({ id: 'b1', customer_user_id: 'other-user', status: 'pending' });
    const res = await request(app).get('/api/v1/bookings/b1').set('Authorization', `Bearer ${cust1Token}`);
    expect(res.status).toBe(403);
  });

  test('4. Admin assigns booking to trip (200)', async () => {
    state.bookings.push({ id: 'b1', booking_reference: 'BK-1', status: 'pending' });
    const res = await request(app).patch('/api/v1/bookings/b1/assign').set('Authorization', `Bearer ${adminToken}`).send({
      trip_id: '33333333-3333-4333-8333-333333333333',
    });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('confirmed');
  });

  test('5. Valid booking status flow confirmed -> in_transit -> delivered', async () => {
    state.bookings.push({ id: 'b1', booking_reference: 'BK-1', status: 'confirmed' });
    const r1 = await request(app).patch('/api/v1/bookings/b1/status').set('Authorization', `Bearer ${adminToken}`).send({ status: 'in_transit' });
    expect(r1.status).toBe(200);
    const r2 = await request(app).patch('/api/v1/bookings/b1/status').set('Authorization', `Bearer ${adminToken}`).send({ status: 'delivered' });
    expect(r2.status).toBe(200);
  });

  test('6. Invalid booking status transition pending -> delivered returns 400', async () => {
    state.bookings.push({ id: 'b1', status: 'pending' });
    const res = await request(app).patch('/api/v1/bookings/b1/status').set('Authorization', `Bearer ${adminToken}`).send({ status: 'delivered' });
    expect(res.status).toBe(400);
  });
});
