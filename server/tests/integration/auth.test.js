import { describe, it, expect, afterEach } from 'vitest';
import request from 'supertest';
import { buildTestApp, rmDir } from '../helpers.js';

describe('POST /api/auth/login', () => {
  let ctx;
  afterEach(() => ctx && rmDir(ctx.config.staticRoot));

  it('issues a token on correct credentials', async () => {
    ctx = buildTestApp();
    const res = await request(ctx.callback)
      .post('/api/auth/login')
      .send({ username: 'admin', password: ctx.config._password });
    expect(res.status).toBe(200);
    expect(res.body.code).toBe(0);
    expect(res.body.data.token).toBeTypeOf('string');
    expect(res.body.data.expiresAt).toBeGreaterThan(Date.now());
  });

  it('rejects wrong password with 401', async () => {
    ctx = buildTestApp();
    const res = await request(ctx.callback)
      .post('/api/auth/login')
      .send({ username: 'admin', password: 'wrong' });
    expect(res.status).toBe(401);
    expect(res.body.code).toBe('BAD_CREDENTIALS');
  });

  it('rejects missing fields with 400', async () => {
    ctx = buildTestApp();
    const res = await request(ctx.callback).post('/api/auth/login').send({});
    expect(res.status).toBe(400);
  });

  it('rate-limits after 5 failures from same IP', async () => {
    ctx = buildTestApp();
    for (let i = 0; i < 5; i += 1) {
      await request(ctx.callback)
        .post('/api/auth/login')
        .send({ username: 'admin', password: 'wrong' });
    }
    const res = await request(ctx.callback)
      .post('/api/auth/login')
      .send({ username: 'admin', password: ctx.config._password });
    expect(res.status).toBe(429);
  });
});

describe('POST /api/auth/verify', () => {
  let ctx;
  afterEach(() => ctx && rmDir(ctx.config.staticRoot));

  it('returns user with valid token', async () => {
    ctx = buildTestApp();
    const login = await request(ctx.callback)
      .post('/api/auth/login')
      .send({ username: 'admin', password: ctx.config._password });
    const token = login.body.data.token;
    const res = await request(ctx.callback)
      .post('/api/auth/verify')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.data.user.sub).toBe('admin');
  });

  it('rejects without token', async () => {
    ctx = buildTestApp();
    const res = await request(ctx.callback).post('/api/auth/verify');
    expect(res.status).toBe(401);
  });

  it('rejects with bogus token', async () => {
    ctx = buildTestApp();
    const res = await request(ctx.callback)
      .post('/api/auth/verify')
      .set('Authorization', 'Bearer not.a.real.jwt');
    expect(res.status).toBe(401);
  });
});
