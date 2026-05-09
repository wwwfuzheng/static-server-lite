import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import request from 'supertest';
import { buildTestApp, makeDir, rmDir } from '../helpers.js';

async function loginToken(callback, password) {
  const r = await request(callback).post('/api/auth/login').send({ username: 'admin', password });
  return r.body.data.token;
}

describe('POST /api/admin/upload', () => {
  let ctx;
  let token;

  beforeEach(async () => {
    ctx = buildTestApp();
    token = await loginToken(ctx.callback, ctx.config._password);
  });
  afterEach(() => rmDir(ctx.config.staticRoot));

  it('uploads multiple files into root', async () => {
    const res = await request(ctx.callback)
      .post('/api/admin/upload')
      .set('Authorization', `Bearer ${token}`)
      .field('path', '/')
      .attach('files', Buffer.from('first'), 'one.txt')
      .attach('files', Buffer.from('second'), 'two.txt');
    expect(res.status).toBe(200);
    const results = res.body.data.results;
    expect(results).toHaveLength(2);
    expect(results.every((r) => r.success)).toBe(true);
    expect(fs.existsSync(path.join(ctx.config.staticRoot, 'one.txt'))).toBe(true);
    expect(fs.existsSync(path.join(ctx.config.staticRoot, 'two.txt'))).toBe(true);
  });

  it('uploads into subfolder', async () => {
    makeDir(ctx.config.staticRoot, 'imgs');
    const res = await request(ctx.callback)
      .post('/api/admin/upload')
      .set('Authorization', `Bearer ${token}`)
      .field('path', '/imgs')
      .attach('files', Buffer.from('pixel'), 'pic.txt');
    expect(res.status).toBe(200);
    expect(fs.existsSync(path.join(ctx.config.staticRoot, 'imgs', 'pic.txt'))).toBe(true);
  });

  it('appends suffix on filename collision', async () => {
    fs.writeFileSync(path.join(ctx.config.staticRoot, 'dup.txt'), 'orig');
    const res = await request(ctx.callback)
      .post('/api/admin/upload')
      .set('Authorization', `Bearer ${token}`)
      .field('path', '/')
      .attach('files', Buffer.from('new'), 'dup.txt');
    expect(res.status).toBe(200);
    expect(res.body.data.results[0].name).toBe('dup_1.txt');
  });

  it('rejects upload without auth', async () => {
    const res = await request(ctx.callback)
      .post('/api/admin/upload')
      .field('path', '/')
      .attach('files', Buffer.from('x'), 'x.txt');
    expect(res.status).toBe(401);
  });

  it('rejects upload to non-existent target dir', async () => {
    const res = await request(ctx.callback)
      .post('/api/admin/upload')
      .set('Authorization', `Bearer ${token}`)
      .field('path', '/nope')
      .attach('files', Buffer.from('x'), 'x.txt');
    expect(res.status).toBe(404);
  });

  it('rejects when no files attached', async () => {
    const res = await request(ctx.callback)
      .post('/api/admin/upload')
      .set('Authorization', `Bearer ${token}`)
      .field('path', '/');
    expect(res.status).toBe(400);
  });
});
