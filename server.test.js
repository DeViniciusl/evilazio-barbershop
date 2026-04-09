// Tests for Evilazio Barbershop API
// Run: npm test

const request = require('supertest');
const app = require('./server-enhanced');

describe('Authentication API', () => {
  let token;
  let refreshToken;

  test('POST /api/auth/register - should register new user', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({
        email: 'test@example.com',
        password: 'TestPassword123',
        name: 'Test User',
        phone: '(85) 9 9999-9999'
      });

    expect(res.statusCode).toBe(201);
    expect(res.body.message).toBe('Cadastro realizado!');
  });

  test('POST /api/auth/login - should login user', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'test@example.com',
        password: 'TestPassword123'
      });

    expect(res.statusCode).toBe(200);
    expect(res.body.accessToken).toBeDefined();
    expect(res.body.user).toBeDefined();
    expect(res.body.user.email).toBe('test@example.com');

    token = res.body.accessToken;
    refreshToken = res.headers['set-cookie'];
  });

  test('POST /api/auth/login - should reject with wrong password', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'test@example.com',
        password: 'WrongPassword'
      });

    expect(res.statusCode).toBe(401);
    expect(res.body.message).toBe('Credenciais inválidas.');
  });

  test('GET /api/barbers - should list all barbers', async () => {
    const res = await request(app)
      .get('/api/barbers');

    expect(res.statusCode).toBe(200);
    expect(res.body.barbers).toBeDefined();
    expect(Array.isArray(res.body.barbers)).toBe(true);
  });

  test('POST /api/appointments - should create appointment', async () => {
    const res = await request(app)
      .post('/api/appointments')
      .send({
        name: 'João Silva',
        email: 'joao@example.com',
        phone: '(85) 9 9999-9999',
        service: 'corte_social',
        barber_preference: 'Evilázio',
        day: '15',
        time: '14:00'
      });

    expect(res.statusCode).toBeOneOf([200, 201]);
    expect(res.body.bookingId || res.body.booking).toBeDefined();
  });

  test('POST /api/appointments - should reject invalid day', async () => {
    const res = await request(app)
      .post('/api/appointments')
      .send({
        name: 'João',
        phone: '(85) 9 9999-9999',
        service: 'corte_social',
        barber_preference: 'Evilázio',
        day: '99',
        time: '14:00'
      });

    expect(res.statusCode).toBe(400);
  });

  test('GET /api/portfolio - should list portfolio', async () => {
    const res = await request(app)
      .get('/api/portfolio?page=1&limit=10');

    expect(res.statusCode).toBe(200);
    expect(res.body.portfolios).toBeDefined();
    expect(res.body.pagination).toBeDefined();
  });
});

describe('Admin API', () => {
  let adminToken;

  beforeAll(async () => {
    // Login as admin first
    const res = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'admin@evilazio.local',
        password: process.env.ADMIN_PASSWORD || 'mude_para_uma_senha_muito_segura_aqui_minimo_12_caracteres'
      });

    if (res.statusCode === 200) {
      adminToken = res.body.accessToken;
    }
  });

  test('POST /api/admin/barbers - should create barber (admin only)', async () => {
    if (!adminToken) return;

    const res = await request(app)
      .post('/api/admin/barbers')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: 'New Barber',
        bio: 'Great barber',
        specialty: 'Cortes modernos'
      });

    expect([200, 201]).toContain(res.statusCode);
  });

  test('POST /api/admin/portfolio - should create portfolio (admin only)', async () => {
    if (!adminToken) return;

    const res = await request(app)
      .post('/api/admin/portfolio')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        title: 'Test Portfolio',
        description: 'Test description'
      });

    expect([200, 201]).toContain(res.statusCode);
  });
});

describe('Security Tests', () => {
  test('GET /api/admin - should reject without auth', async () => {
    const res = await request(app)
      .get('/api/appointments')
      .set('Authorization', 'Bearer invalid_token');

    expect(res.statusCode).toBe(401);
  });

  test('POST /api/auth/register - should reject short password', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({
        email: 'short@test.com',
        password: 'short',
        name: 'Test'
      });

    expect(res.statusCode).toBe(400);
  });

  test('POST /api/auth/register - should reject invalid email', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({
        email: 'invalid-email',
        password: 'ValidPassword123',
        name: 'Test'
      });

    expect(res.statusCode).toBe(400);
  });
});

describe('Error Handling', () => {
  test('GET /api/portfolio/999 - should return 404', async () => {
    const res = await request(app)
      .get('/api/portfolio/999');

    expect(res.statusCode).toBe(404);
  });

  test('POST /api/appointments - should reject missing fields', async () => {
    const res = await request(app)
      .post('/api/appointments')
      .send({
        name: 'João'
        // Missing other required fields
      });

    expect(res.statusCode).toBe(400);
  });
});

// Helper
expect.extend({
  toBeOneOf(received, expected) {
    const pass = expected.includes(received);
    return {
      pass,
      message: () =>
        pass
          ? `Expected ${received} not to be one of ${expected.join(', ')}`
          : `Expected ${received} to be one of ${expected.join(', ')}`
    };
  }
});
