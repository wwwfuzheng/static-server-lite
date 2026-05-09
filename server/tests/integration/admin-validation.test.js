import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import { buildTestApp, rmDir, writeFile } from '../helpers.js';

async function loginToken(callback, password) {
  const r = await request(callback)
    .post('/api/auth/login')
    .send({ username: 'admin', password });
  return r.body.data.token;
}

describe('admin route input validation', () => {
  let ctx;
  let token;

  beforeEach(async () => {
    ctx = buildTestApp();
    token = await loginToken(ctx.callback, ctx.config._password);
  });

  afterEach(() => rmDir(ctx.config.staticRoot));

  it('DELETE /api/admin/file without path returns 400', async () => {
    const res = await request(ctx.callback)
      .delete('/api/admin/file')
      .set('Authorization', `Bearer ${token}`)
      .send({});
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('BAD_INPUT');
  });

  it('DELETE /api/admin/folder without path returns 400', async () => {
    const res = await request(ctx.callback)
      .delete('/api/admin/folder')
      .set('Authorization', `Bearer ${token}`)
      .send({});
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('BAD_INPUT');
  });

  it('POST /api/admin/files/batch-delete without paths returns 400', async () => {
    const res = await request(ctx.callback)
      .post('/api/admin/files/batch-delete')
      .set('Authorization', `Bearer ${token}`)
      .send({});
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('BAD_INPUT');
  });

  it('POST /api/admin/files/batch-delete with empty array returns 400', async () => {
    const res = await request(ctx.callback)
      .post('/api/admin/files/batch-delete')
      .set('Authorization', `Bearer ${token}`)
      .send({ paths: [] });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('BAD_INPUT');
  });

  it('POST /api/admin/upload without path field defaults to root', async () => {
    const res = await request(ctx.callback)
      .post('/api/admin/upload')
      .set('Authorization', `Bearer ${token}`)
      .attach('files', Buffer.from('hi'), 'a.txt');
    expect(res.status).toBe(200);
    expect(res.body.data.results[0].path).toBe('/a.txt');
  });

  it('POST /api/admin/upload without files returns 400', async () => {
    const res = await request(ctx.callback)
      .post('/api/admin/upload')
      .set('Authorization', `Bearer ${token}`)
      .field('path', '/');
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('NO_FILES');
  });

  it('POST /api/admin/folder without body returns 400 (BAD_NAME)', async () => {
    const res = await request(ctx.callback)
      .post('/api/admin/folder')
      .set('Authorization', `Bearer ${token}`)
      .send({});
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('BAD_NAME');
  });

  it('POST /api/auth/login without body is rejected', async () => {
    const res = await request(ctx.callback).post('/api/auth/login').send();
    expect([400, 401]).toContain(res.status);
  });
});
