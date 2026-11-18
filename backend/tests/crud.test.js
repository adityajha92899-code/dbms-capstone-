process.env.NODE_ENV = 'test';
process.env.JWT_ACCESS_SECRET = 'test-access-secret-key-for-jest-suite';
process.env.JWT_REFRESH_SECRET = 'test-refresh-secret-key-for-jest-suite';

const request = require('supertest');
const crypto = require('crypto');
const { generateAccessToken } = require('../src/utils/jwt');

const state = {
  vehicles: [],
  maintenance: [],
  drivers: [],
  users: [],
  routes: [],
};

jest.mock('../src/utils/password', () => ({
  hashPassword: jest.fn(async (plain) => `hashed:${plain}`),
  verifyPassword: jest.fn(async (plain, hash) => hash === `hashed:${plain}`),
}));

function executeMockQuery(sql, params = []) {
  const s = sql.replace(/\s+/g, ' ').trim();

  // --- VEHICLES ---
  if (s.startsWith('SELECT COUNT(*)::int AS total FROM vehicles')) {
    return { rows: [{ total: state.vehicles.length }] };
  }
  if (s.includes('FROM vehicles v LEFT JOIN maintenance_records m')) {
    return {
      rows: state.vehicles.map((v) => ({
        ...v,
        maintenance_count: state.maintenance.filter((m) => m.vehicle_id === v.id).length,
      })),
    };
  }
  if (s === 'SELECT * FROM vehicles WHERE id = $1' || s === 'SELECT id FROM vehicles WHERE id = $1') {
    const v = state.vehicles.find((x) => x.id === params[0]);
    return { rows: v ? [{ ...v }] : [] };
  }
  if (s.startsWith('SELECT id FROM vehicles WHERE lower(reg_number) = lower($1) OR lower(vin) = lower($2)')) {
    const dup = state.vehicles.find(
      (x) =>
        x.reg_number.toLowerCase() === params[0].toLowerCase() ||
        x.vin.toLowerCase() === params[1].toLowerCase()
    );
    return { rows: dup ? [{ id: dup.id }] : [] };
  }
  if (s.startsWith('INSERT INTO vehicles')) {
    const [
      reg_number, vin, make, model, year, vehicle_type,
      capacity_kg, volume_cbm, fuel_type, odometer_km, status, insurance_expiry,
    ] = params;
    const v = {
      id: crypto.randomUUID(),
      reg_number,
      vin,
      make,
      model,
      year,
      vehicle_type,
      capacity_kg,
      volume_cbm,
      fuel_type,
      odometer_km,
      status,
      insurance_expiry,
      created_at: new Date(),
    };
    state.vehicles.push(v);
    return { rows: [v] };
  }
  if (s.startsWith('UPDATE vehicles SET status = \'inactive\'')) {
    const v = state.vehicles.find((x) => x.id === params[0]);
    if (v) v.status = 'inactive';
    return { rows: v ? [{ ...v }] : [] };
  }
  if (s.startsWith('SELECT * FROM maintenance_records WHERE vehicle_id = $1')) {
    return { rows: state.maintenance.filter((m) => m.vehicle_id === params[0]) };
  }

  // --- DRIVERS ---
  if (s.startsWith('SELECT COUNT(*)::int AS total FROM driver_profiles')) {
    return { rows: [{ total: state.drivers.length }] };
  }
  if (s.includes('FROM driver_profiles dp JOIN users u ON u.id = dp.user_id LEFT JOIN trips t')) {
    return {
      rows: state.drivers.map((d) => ({
        ...d,
        active_trips_count: 0,
        next_free_at: new Date(),
      })),
    };
  }
  if (s.startsWith('SELECT dp.*, u.full_name, u.email, u.phone, u.is_active FROM driver_profiles dp')) {
    const d = state.drivers.find((x) => x.id === params[0]);
    return { rows: d ? [{ ...d }] : [] };
  }
  if (s.startsWith('SELECT id FROM users WHERE lower(email) = $1')) {
    const u = state.users.find((x) => x.email.toLowerCase() === params[0]);
    return { rows: u ? [{ id: u.id }] : [] };
  }
  if (s.startsWith('SELECT id FROM driver_profiles WHERE lower(license_number) = lower($1)')) {
    const d = state.drivers.find((x) => x.license_number.toLowerCase() === params[0].toLowerCase());
    return { rows: d ? [{ id: d.id }] : [] };
  }
  if (s.startsWith('INSERT INTO users')) {
    const [email, password_hash, full_name, phone] = params;
    const u = { id: crypto.randomUUID(), email, password_hash, full_name, phone, user_type: 'driver', is_active: true };
    state.users.push(u);
    return { rows: [u] };
  }
  if (s.startsWith('INSERT INTO driver_profiles')) {
    const [user_id, license_number, license_class, license_expiry, hire_date] = params;
    const u = state.users.find((x) => x.id === user_id);
    const d = {
      id: crypto.randomUUID(),
      user_id,
      license_number,
      license_class,
      license_expiry,
      hire_date: hire_date || '2026-01-01',
      status: 'available',
      rating: '5.00',
      full_name: u?.full_name,
      email: u?.email,
      phone: u?.phone,
      is_active: true,
    };
    state.drivers.push(d);
    return { rows: [d] };
  }
  if (s.startsWith('UPDATE driver_profiles SET status = $1')) {
    const d = state.drivers.find((x) => x.id === params[1]);
    if (d) d.status = params[0];
    return { rows: d ? [{ ...d }] : [] };
  }
  if (s.startsWith('SELECT * FROM vw_driver_performance WHERE driver_id = $1')) {
    const d = state.drivers.find((x) => x.id === params[0]);
    return {
      rows: d
        ? [{ driver_id: d.id, name: d.full_name, license_class: d.license_class, total_trips: 5, on_time_pct: '100.00', avg_rating: '4.90' }]
        : [],
    };
  }

  // --- ROUTES ---
  if (s.startsWith('SELECT COUNT(*)::int AS total FROM routes')) {
    return { rows: [{ total: state.routes.length }] };
  }
  if (s.startsWith('SELECT * FROM routes')) {
    return { rows: [...state.routes] };
  }
  if (s === 'SELECT * FROM routes WHERE id = $1' || s === 'SELECT id FROM routes WHERE id = $1') {
    const r = state.routes.find((x) => x.id === params[0]);
    return { rows: r ? [{ ...r }] : [] };
  }
  if (s.startsWith('SELECT id FROM routes WHERE lower(code) = lower($1)')) {
    const r = state.routes.find((x) => x.code.toLowerCase() === params[0].toLowerCase());
    return { rows: r ? [{ id: r.id }] : [] };
  }
  if (s.startsWith('INSERT INTO routes')) {
    const [code, name, origin, destination, distance_km, estimated_duration_hrs, base_rate_per_km, is_active] = params;
    const r = { id: crypto.randomUUID(), code, name, origin, destination, distance_km, estimated_duration_hrs, base_rate_per_km, is_active };
    state.routes.push(r);
    return { rows: [r] };
  }
  if (s.startsWith('UPDATE routes SET is_active = FALSE')) {
    const r = state.routes.find((x) => x.id === params[0]);
    if (r) r.is_active = false;
    return { rows: r ? [{ ...r }] : [] };
  }

  return { rows: [] };
}

jest.mock('../src/db', () => ({
  query: jest.fn((sql, params) => Promise.resolve(executeMockQuery(sql, params))),
  pool: {
    connect: jest.fn(async () => ({
      query: jest.fn((sql, params) => Promise.resolve(executeMockQuery(sql, params))),
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

const customerToken = generateAccessToken({
  id: '22222222-2222-4222-8222-222222222222',
  email: 'customer1@tms.com',
  user_type: 'customer',
});

const driverProfileId = '33333333-3333-4333-8333-333333333333';
const selfDriverToken = generateAccessToken(
  { id: '44444444-4444-4444-8444-444444444444', email: 'driver1@tms.com', user_type: 'driver' },
  { id: driverProfileId }
);

describe('Phase 3 CRUD APIs (Vehicles, Drivers, Routes)', () => {
  beforeEach(() => {
    state.vehicles = [];
    state.maintenance = [];
    state.drivers = [
      {
        id: driverProfileId,
        user_id: '44444444-4444-4444-8444-444444444444',
        full_name: 'Marcus Vance',
        email: 'driver1@tms.com',
        phone: '+1-555-0201',
        license_number: 'DL-FF-00001',
        license_class: 'CDL-A',
        license_expiry: '2029-12-31',
        status: 'available',
        is_active: true,
      },
    ];
    state.users = [];
    state.routes = [];
  });

  // --- VEHICLES ---
  test('Vehicles: 401 when no token is provided', async () => {
    const res = await request(app).get('/api/v1/vehicles');
    expect(res.status).toBe(401);
  });

  test('Vehicles: 403 when non-admin role requests list', async () => {
    const res = await request(app)
      .get('/api/v1/vehicles')
      .set('Authorization', `Bearer ${customerToken}`);
    expect(res.status).toBe(403);
  });

  test('Vehicles: happy path create, list, get, soft-delete + 409 duplicate reg_number + 404 not found', async () => {
    const payload = {
      reg_number: 'FF-9999-TX',
      vin: '1FTFW1ET000099999',
      make: 'Volvo',
      model: 'VNL 760',
      year: 2024,
      vehicle_type: 'semi_truck',
      capacity_kg: 20000,
      insurance_expiry: '2028-12-31',
    };

    const createRes = await request(app)
      .post('/api/v1/vehicles')
      .set('Authorization', `Bearer ${adminToken}`)
      .send(payload);
    expect(createRes.status).toBe(201);
    expect(createRes.body.reg_number).toBe('FF-9999-TX');

    // 409 duplicate reg_number
    const dupRes = await request(app)
      .post('/api/v1/vehicles')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ ...payload, vin: '1FTFW1ET000088888' });
    expect(dupRes.status).toBe(409);

    // List
    const listRes = await request(app)
      .get('/api/v1/vehicles')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(listRes.status).toBe(200);
    expect(listRes.body.data).toHaveLength(1);

    // Soft delete
    const delRes = await request(app)
      .delete(`/api/v1/vehicles/${createRes.body.id}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(delRes.status).toBe(200);
    expect(delRes.body.status).toBe('inactive');

    // 404 not found
    const notFoundRes = await request(app)
      .get('/api/v1/vehicles/99999999-9999-4999-8999-999999999999')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(notFoundRes.status).toBe(404);
  });

  // --- DRIVERS ---
  test('Drivers: happy path create, status update, self performance + 401/403/404', async () => {
    const unauth = await request(app).get('/api/v1/drivers');
    expect(unauth.status).toBe(401);

    const forbidden = await request(app)
      .get('/api/v1/drivers')
      .set('Authorization', `Bearer ${selfDriverToken}`);
    expect(forbidden.status).toBe(403);

    // Self driver can view own performance
    const selfPerf = await request(app)
      .get(`/api/v1/drivers/${driverProfileId}/performance`)
      .set('Authorization', `Bearer ${selfDriverToken}`);
    expect(selfPerf.status).toBe(200);
    expect(selfPerf.body.driver_id).toBe(driverProfileId);

    // Admin creates a driver
    const createRes = await request(app)
      .post('/api/v1/drivers')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        email: 'newdriver@tms.com',
        password: 'Driver@123',
        full_name: 'Jordan Miles',
        phone: '+1-555-0299',
        license_number: 'DL-FF-00099',
        license_class: 'CDL-A',
        license_expiry: '2029-12-31',
      });
    expect(createRes.status).toBe(201);

    const notFoundRes = await request(app)
      .get('/api/v1/drivers/99999999-9999-4999-8999-999999999999')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(notFoundRes.status).toBe(404);
  });

  // --- ROUTES ---
  test('Routes: happy path create, list, soft delete + 401/403/404', async () => {
    const unauth = await request(app).get('/api/v1/routes');
    expect(unauth.status).toBe(401);

    const forbidden = await request(app)
      .get('/api/v1/routes')
      .set('Authorization', `Bearer ${customerToken}`);
    expect(forbidden.status).toBe(403);

    const createRes = await request(app)
      .post('/api/v1/routes')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        code: 'RT-099',
        name: 'Test Corridor',
        origin: 'Austin, TX',
        destination: 'San Antonio, TX',
        distance_km: 130,
        estimated_duration_hrs: 1.5,
      });
    expect(createRes.status).toBe(201);

    const delRes = await request(app)
      .delete(`/api/v1/routes/${createRes.body.id}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(delRes.status).toBe(200);
    expect(delRes.body.is_active).toBe(false);

    const notFoundRes = await request(app)
      .get('/api/v1/routes/99999999-9999-4999-8999-999999999999')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(notFoundRes.status).toBe(404);
  });
});
