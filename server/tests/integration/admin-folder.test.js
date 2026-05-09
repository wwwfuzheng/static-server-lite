import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import { buildTestApp, makeDir, rmDir, writeFile } from '../helpers.js';

async function loginToken(callback, password) {
  const r = await request(callback).post('/api/auth/login').send({ username: 'admin', password });
  return r.body.data.token;
}

describe('admin folder/list endpoints', () => {
  let ctx;
  let token;

  beforeEach(async () => {
    ctx = buildTestApp();
    token = await loginToken(ctx.callback, ctx.config._password);
  });

  afterEach(() => rmDir(ctx.config.staticRoot));

  it('lists root directory (empty)', async () => {
    const res = await request(ctx.callback)
      .get('/api/admin/list')
      .query({ path: '/' })
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.data.items).toEqual([]);
  });

  it('lists files and folders sorted dirs-first', async () => {
    makeDir(ctx.config.staticRoot, 'imgs');
    writeFile(ctx.config.staticRoot, 'a.txt', 'hello');
    writeFile(ctx.config.staticRoot, 'z.txt', 'z');
    const res = await request(ctx.callback)
      .get('/api/admin/list')
      .set('Authorization', `Bearer ${token}`);
    const names = res.body.data.items.map((i) => `${i.type}:${i.name}`);
    expect(names).toEqual(['dir:imgs', 'file:a.txt', 'file:z.txt']);
  });

  it('rejects unauthenticated list', async () => {
    const res = await request(ctx.callback).get('/api/admin/list');
    expect(res.status).toBe(401);
  });

  it('rejects path traversal in list', async () => {
    const res = await request(ctx.callback)
      .get('/api/admin/list')
      .query({ path: '../../etc' })
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(400);
  });

  it('creates a new folder', async () => {
    const res = await request(ctx.callback)
      .post('/api/admin/folder')
      .set('Authorization', `Bearer ${token}`)
      .send({ path: '/', name: 'newdir' });
    expect(res.status).toBe(200);
    expect(res.body.data.path).toBe('/newdir');
  });

  it('rejects creating duplicate folder', async () => {
    makeDir(ctx.config.staticRoot, 'dup');
    const res = await request(ctx.callback)
      .post('/api/admin/folder')
      .set('Authorization', `Bearer ${token}`)
      .send({ path: '/', name: 'dup' });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('EXISTS');
  });

  it('rejects bad folder name', async () => {
    const res = await request(ctx.callback)
      .post('/api/admin/folder')
      .set('Authorization', `Bearer ${token}`)
      .send({ path: '/', name: '../escape' });
    expect(res.status).toBe(400);
  });

  it('deletes empty folder', async () => {
    makeDir(ctx.config.staticRoot, 'empty');
    const res = await request(ctx.callback)
      .delete('/api/admin/folder')
      .set('Authorization', `Bearer ${token}`)
      .send({ path: '/empty' });
    expect(res.status).toBe(200);
  });

  it('refuses to delete non-empty folder', async () => {
    makeDir(ctx.config.staticRoot, 'full');
    writeFile(ctx.config.staticRoot, 'full/a.txt');
    const res = await request(ctx.callback)
      .delete('/api/admin/folder')
      .set('Authorization', `Bearer ${token}`)
      .send({ path: '/full' });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('DIR_NOT_EMPTY');
  });

  it('refuses to delete root', async () => {
    const res = await request(ctx.callback)
      .delete('/api/admin/folder')
      .set('Authorization', `Bearer ${token}`)
      .send({ path: '/' });
    expect(res.status).toBe(400);
  });
});

describe('admin delete files', () => {
  let ctx;
  let token;

  beforeEach(async () => {
    ctx = buildTestApp();
    token = await loginToken(ctx.callback, ctx.config._password);
  });
  afterEach(() => rmDir(ctx.config.staticRoot));

  it('deletes a single file', async () => {
    writeFile(ctx.config.staticRoot, 'a.txt');
    const res = await request(ctx.callback)
      .delete('/api/admin/file')
      .set('Authorization', `Bearer ${token}`)
      .send({ path: '/a.txt' });
    expect(res.status).toBe(200);
  });

  it('returns 404 for missing file', async () => {
    const res = await request(ctx.callback)
      .delete('/api/admin/file')
      .set('Authorization', `Bearer ${token}`)
      .send({ path: '/missing.txt' });
    expect(res.status).toBe(404);
  });

  it('batch deletes with per-file results', async () => {
    writeFile(ctx.config.staticRoot, 'a.txt');
    writeFile(ctx.config.staticRoot, 'b.txt');
    const res = await request(ctx.callback)
      .post('/api/admin/files/batch-delete')
      .set('Authorization', `Bearer ${token}`)
      .send({ paths: ['/a.txt', '/b.txt', '/missing.txt'] });
    expect(res.status).toBe(200);
    const r = res.body.data.results;
    expect(r.find((x) => x.path === '/a.txt').success).toBe(true);
    expect(r.find((x) => x.path === '/b.txt').success).toBe(true);
    expect(r.find((x) => x.path === '/missing.txt').success).toBe(false);
  });
});
