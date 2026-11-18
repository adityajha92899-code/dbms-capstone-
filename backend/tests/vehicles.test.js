process.env.NODE_ENV = 'test';
process.env.JWT_ACCESS_SECRET = 'test-access-secret-key-for-jest-suite';

const request = require('supertest');
const crypto = require('crypto');
const { generateAccessToken } = require('../src/utils/jwt');

const state = { vehicles: [] };

function executeMockQuery(sql, params = []) {
  const s = sql.replace(/\s+/g, ' ').trim();
  if (s.startsWith('SELECT COUNT(*)::int AS total FROM vehicles')) return { rows: [{ total: state.vehicles.length }] };
  if (s.includes('FROM vehicles v LEFT JOIN maintenance_records m')) return { rows: state.vehicles.map((v) => ({ ...v, maintenance_count: 0 })) };
  if (s === 'SELECT * FROM vehicles WHERE id = $1' || s === 'SELECT id FROM vehicles WHERE id = $1') {
    const v = state.vehicles.find((x) => x.id === params[0]);
    return { rows: v ? [{ ...v }] : [] };
  }
  if (s.startsWith('SELECT id FROM vehicles WHERE lower(reg_number)')) {
    const dup = state.vehicles.find((x) => x.reg_number.toLowerCase() === params[0].toLowerCase());
    return { rows: dup ? [{ id: dup.id }] : [] };
  }
  if (s.startsWith('INSERT INTO vehicles')) {
    const v = { id: crypto.randomUUID(), reg_number: params[0], vin: params[1], status: 'available' };
    state.vehicles.push(v);
    return { rows: [v] };
  }
  if (s.startsWith("UPDATE vehicles SET status = 'inactive'")) {
    const v = state.vehicles.find((x) => x.id === params[0]);
    if (v) v.status = 'inactive';
    return { rows: v ? [{ ...v }] : [] };
  }
  return { rows: [] };
}

jest.mock('../src/db', () => ({
  query: jest.fn((sql, params) => Promise.resolve(executeMockQuery(sql, params))),
  pool: { connect: jest.fn(), end: jest.fn(async () => {}), on: jest.fn() },
}));

const app = require('../src/server');
const { pool } = require('../src/db');

const adminToken = generateAccessToken({ id: '11111111-1111-4111-8111-111111111111', email: 'admin@tms.com', user_type: 'admin' });
const driverToken = generateAccessToken({ id: '22222222-2222-4222-8222-222222222222', email: 'driver1@tms.com', user_type: 'driver' }, { id: 'd1' });

describe('Vehicles API (6 tests)', () => {
  afterAll(async () => { await pool.end(); });
  beforeEach(() => { state.vehicles = []; });

  test('1. Unauthenticated request returns 401', async () => {
    const res = await request(app).get('/api/v1/vehicles');
    expect(res.status).toBe(401);
  });

  test('2. Non-admin role returns 403', async () => {
    const res = await request(app).get('/api/v1/vehicles').set('Authorization', `Bearer ${driverToken}`);
    expect(res.status).toBe(403);
  });

  test('3. Admin creates vehicle (201)', async () => {
    const res = await request(app).post('/api/v1/vehicles').set('Authorization', `Bearer ${adminToken}`).send({
      reg_number: 'FF-1001-TX', vin: '1FTFW1ET000010001', make: 'Volvo', model: 'VNL', year: 2024,
      vehicle_type: 'semi_truck', capacity_kg: 20000, insurance_expiry: '2028-12-31',
    });
    expect(res.status).toBe(201);
  });

  test('4. Duplicate reg_number returns 409', async () => {
    state.vehicles.push({ id: 'v1', reg_number: 'FF-1001-TX', vin: '1FTFW1ET000010001' });
    const res = await request(app).post('/api/v1/vehicles').set('Authorization', `Bearer ${adminToken}`).send({
      reg_number: 'FF-1001-TX', vin: '1FTFW1ET000010002', make: 'Volvo', model: 'VNL', year: 2024,
      vehicle_type: 'semi_truck', capacity_kg: 20000, insurance_expiry: '2028-12-31',
    });
    expect(res.status).toBe(409);
  });

  test('5. Soft delete sets status=inactive', async () => {
    const vid = '33333333-3333-4333-8333-333333333333';
    state.vehicles.push({ id: vid, reg_number: 'FF-2001-TX', status: 'available' });
    const res = await request(app).delete(`/api/v1/vehicles/${vid}`).set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('inactive');
  });

  test('6. Unknown vehicle ID returns 404', async () => {
    const res = await request(app).get('/api/v1/vehicles/99999999-9999-4999-8999-999999999999').set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(404);
  });
});
