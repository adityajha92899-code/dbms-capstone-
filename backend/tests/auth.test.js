process.env.NODE_ENV = 'test';
process.env.JWT_ACCESS_SECRET = 'test-access-secret-key-for-jest-suite';
process.env.JWT_REFRESH_SECRET = 'test-refresh-secret-key-for-jest-suite';

const request = require('supertest');
const crypto = require('crypto');

const state = { users: [], refreshTokens: [], auditLogs: [], customerProfiles: [] };

jest.mock('../src/utils/password', () => ({
  hashPassword: jest.fn(async (plain) => `hashed:${plain}`),
  verifyPassword: jest.fn(async (plain, hash) => hash === `hashed:${plain}`),
}));

function executeMockQuery(sql, params = []) {
  const s = sql.replace(/\s+/g, ' ').trim();
  if (s.startsWith('SELECT id, email, password_hash') && s.includes('WHERE lower(email) = $1')) {
    const u = state.users.find((x) => x.email.toLowerCase() === params[0]);
    return { rows: u ? [{ ...u }] : [] };
  }
  if (s.startsWith('SELECT id, email, full_name') && s.includes('WHERE id = $1')) {
    const u = state.users.find((x) => x.id === params[0]);
    return { rows: u ? [{ ...u }] : [] };
  }
  if (s.startsWith('SELECT id FROM users WHERE lower(email) = $1')) {
    const u = state.users.find((x) => x.email.toLowerCase() === params[0]);
    return { rows: u ? [{ id: u.id }] : [] };
  }
  if (s.includes('SET failed_attempts = $1, locked_until =')) {
    const u = state.users.find((x) => x.id === params[2]);
    if (u) {
      u.failed_attempts = params[0];
      u.locked_until = new Date(Date.now() + 15 * 60 * 1000);
    }
    return { rows: [] };
  }
  if (s.startsWith('UPDATE users SET failed_attempts = $1 WHERE id = $2')) {
    const u = state.users.find((x) => x.id === params[1]);
    if (u) u.failed_attempts = params[0];
    return { rows: [] };
  }
  if (s.includes('SET failed_attempts = 0, locked_until = NULL, last_login_at = NOW()')) {
    const u = state.users.find((x) => x.id === params[0]);
    if (u) {
      u.failed_attempts = 0;
      u.locked_until = null;
      u.last_login_at = new Date();
    }
    return { rows: u ? [{ ...u }] : [] };
  }
  if (s.startsWith('INSERT INTO users')) {
    const u = {
      id: crypto.randomUUID(),
      email: params[0],
      password_hash: params[1],
      full_name: params[2],
      phone: params[3],
      user_type: 'customer',
      is_active: true,
    };
    state.users.push(u);
    return { rows: [u] };
  }
  if (s.startsWith('INSERT INTO customer_profiles')) {
    const p = { id: crypto.randomUUID(), user_id: params[0], company_name: params[1] };
    state.customerProfiles.push(p);
    return { rows: [p] };
  }
  if (s.startsWith('INSERT INTO refresh_tokens')) {
    const row = {
      id: crypto.randomUUID(),
      user_id: params[0],
      token_hash: params[1],
      expires_at: new Date(Date.now() + 7 * 86400 * 1000),
      revoked_at: null,
    };
    state.refreshTokens.push(row);
    return { rows: [row] };
  }
  if (s.startsWith('SELECT id, user_id, expires_at, revoked_at FROM refresh_tokens WHERE token_hash = $1')) {
    const row = state.refreshTokens.find((t) => t.token_hash === params[0]);
    return { rows: row ? [{ ...row }] : [] };
  }
  if (s.startsWith('UPDATE refresh_tokens SET revoked_at = NOW() WHERE id = $1')) {
    const row = state.refreshTokens.find((t) => t.id === params[0]);
    if (row) row.revoked_at = new Date();
    return { rows: [] };
  }
  if (s.startsWith('UPDATE refresh_tokens SET revoked_at = NOW() WHERE token_hash = $1 AND user_id = $2')) {
    const row = state.refreshTokens.find((t) => t.token_hash === params[0] && t.user_id === params[1]);
    if (row) row.revoked_at = new Date();
    return { rows: [] };
  }
  if (s.startsWith('UPDATE refresh_tokens SET revoked_at = NOW() WHERE user_id = $1')) {
    state.refreshTokens.filter((t) => t.user_id === params[0]).forEach((t) => { t.revoked_at = new Date(); });
    return { rows: [] };
  }
  if (s.startsWith('INSERT INTO login_audit_log')) {
    state.auditLogs.push({ params });
    return { rows: [] };
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
    end: jest.fn(async () => {}),
    on: jest.fn(),
  },
}));

const app = require('../src/server');
const { pool } = require('../src/db');

describe('Auth API (8 tests)', () => {
  beforeAll(async () => {});
  afterAll(async () => {
    await pool.end();
  });

  beforeEach(() => {
    state.users = [
      {
        id: '11111111-1111-4111-8111-111111111111',
        email: 'admin@tms.com',
        password_hash: 'hashed:Admin@123',
        full_name: 'Aarav Mehta',
        user_type: 'admin',
        is_active: true,
        failed_attempts: 0,
        locked_until: null,
      },
      {
        id: '22222222-2222-4222-8222-222222222222',
        email: 'inactive@tms.com',
        password_hash: 'hashed:Inactive@123',
        full_name: 'Inactive User',
        user_type: 'customer',
        is_active: false,
        failed_attempts: 0,
        locked_until: null,
      },
    ];
    state.refreshTokens = [];
    state.auditLogs = [];
  });

  test('1. Admin login returns 200 + accessToken + role=admin', async () => {
    const res = await request(app).post('/api/v1/auth/login').send({ email: 'admin@tms.com', password: 'Admin@123' });
    expect(res.status).toBe(200);
    expect(res.body.accessToken).toBeDefined();
    expect(res.body.user.role).toBe('admin');
  });

  test('2. Unknown email returns 401', async () => {
    const res = await request(app).post('/api/v1/auth/login').send({ email: 'nobody@tms.com', password: 'Admin@123' });
    expect(res.status).toBe(401);
  });

  test('3. Wrong password returns 401', async () => {
    const res = await request(app).post('/api/v1/auth/login').send({ email: 'admin@tms.com', password: 'WrongPassword' });
    expect(res.status).toBe(401);
  });

  test('4. 5 failed attempts locks account (423)', async () => {
    for (let i = 0; i < 5; i += 1) {
      await request(app).post('/api/v1/auth/login').send({ email: 'admin@tms.com', password: 'WrongPassword' });
    }
    const res = await request(app).post('/api/v1/auth/login').send({ email: 'admin@tms.com', password: 'Admin@123' });
    expect(res.status).toBe(423);
  });

  test('5. Inactive user returns 403', async () => {
    const res = await request(app).post('/api/v1/auth/login').send({ email: 'inactive@tms.com', password: 'Inactive@123' });
    expect(res.status).toBe(403);
  });

  test('6. Refresh rotates refresh token and issues new accessToken', async () => {
    const loginRes = await request(app).post('/api/v1/auth/login').send({ email: 'admin@tms.com', password: 'Admin@123' });
    const res = await request(app).post('/api/v1/auth/refresh').set('Cookie', loginRes.headers['set-cookie']).send({});
    expect(res.status).toBe(200);
    expect(res.body.accessToken).toBeDefined();
    expect(state.refreshTokens[0].revoked_at).not.toBeNull();
  });

  test('7. Logout revokes refresh token', async () => {
    const loginRes = await request(app).post('/api/v1/auth/login').send({ email: 'admin@tms.com', password: 'Admin@123' });
    const res = await request(app)
      .post('/api/v1/auth/logout')
      .set('Authorization', `Bearer ${loginRes.body.accessToken}`)
      .set('Cookie', loginRes.headers['set-cookie'])
      .send({});
    expect(res.status).toBe(200);
    expect(state.refreshTokens[0].revoked_at).not.toBeNull();
  });

  test('8. Register creates customer account (201)', async () => {
    const res = await request(app).post('/api/v1/auth/register').send({
      email: 'fresh@tms.com',
      password: 'Password123',
      full_name: 'Fresh Customer',
      phone: '+1-555-0900',
      company_name: 'Fresh Logistics',
    });
    expect(res.status).toBe(201);
    expect(res.body.user.role).toBe('customer');
  });
});
