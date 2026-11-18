process.env.NODE_ENV = 'test';
process.env.JWT_ACCESS_SECRET = 'test-access-secret-key-for-jest-suite';

const request = require('supertest');
const { generateAccessToken } = require('../src/utils/jwt');

jest.mock('../src/db', () => ({
  query: jest.fn(async (sql) => {
    if (sql.includes('WITH vehicle_stats AS')) {
      return {
        rows: [{
          active_vehicles: 17, total_vehicles: 20, active_trips: 7, trips_today: 3,
          on_time_rate_30d: '96.50', revenue_30d: '125000.00', pending_bookings: 4, maintenance_due_7d: 2,
        }],
      };
    }
    if (sql.includes('FROM bookings')) return { rows: [{ month: '2026-11', revenue: '85000.00', delivered_bookings: 12 }] };
    if (sql.includes('FROM trips')) return { rows: [{ date: '2026-11-18', trip_count: 5, completed_count: 4 }] };
    return { rows: [] };
  }),
  pool: { end: jest.fn(async () => {}), on: jest.fn() },
}));

const app = require('../src/server');
const { pool } = require('../src/db');

const adminToken = generateAccessToken({ id: '11111111-1111-4111-8111-111111111111', email: 'admin@tms.com', user_type: 'admin' });
const custToken = generateAccessToken({ id: '22222222-2222-4222-8222-222222222222', email: 'c1@tms.com', user_type: 'customer' });

describe('Reports API (4 tests)', () => {
  afterAll(async () => { await pool.end(); });

  test('1. Admin fetches KPIs (200)', async () => {
    const res = await request(app).get('/api/v1/reports/kpis').set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body.active_vehicles).toBe(17);
  });

  test('2. Non-admin cannot access KPIs (403)', async () => {
    const res = await request(app).get('/api/v1/reports/kpis').set('Authorization', `Bearer ${custToken}`);
    expect(res.status).toBe(403);
  });

  test('3. Revenue report accepts date filters', async () => {
    const res = await request(app).get('/api/v1/reports/revenue?from=2026-10-01&to=2026-11-30').set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
  });

  test('4. Trip volume report accepts date filters', async () => {
    const res = await request(app).get('/api/v1/reports/trip-volume?from=2026-11-01&to=2026-11-18').set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
  });
});
