import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import { buildTestApp, makeTempRoot, rmDir } from '../helpers.js';

function makeFakeDist() {
  const dist = makeTempRoot();
  fs.writeFileSync(
    path.join(dist, 'index.html'),
    '<!doctype html><html><body><div id="root"></div></body></html>',
  );
  fs.mkdirSync(path.join(dist, 'assets'));
  fs.writeFileSync(
    path.join(dist, 'assets', 'app.js'),
    'console.log("hi");',
  );
  return dist;
}

describe('SPA middleware (/admin)', () => {
  let dist;

  beforeEach(() => {
    dist = makeFakeDist();
  });

  afterEach(() => {
    rmDir(dist);
  });

  it('serves index.html for /admin', async () => {
    const { callback } = buildTestApp({ webDist: dist });
    const res = await request(callback).get('/admin');
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/text\/html/);
    expect(res.text).toContain('<div id="root">');
  });

  it('serves index.html for /admin/', async () => {
    const { callback } = buildTestApp({ webDist: dist });
    const res = await request(callback).get('/admin/');
    expect(res.status).toBe(200);
    expect(res.text).toContain('<div id="root">');
  });

  it('falls back to index.html for SPA deep paths', async () => {
    const { callback } = buildTestApp({ webDist: dist });
    const res = await request(callback).get('/admin/some/nested/route');
    expect(res.status).toBe(200);
    expect(res.text).toContain('<div id="root">');
  });

  it('serves real asset under /admin/assets', async () => {
    const { callback } = buildTestApp({ webDist: dist });
    const res = await request(callback).get('/admin/assets/app.js');
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/javascript/);
    expect(res.text).toContain('console.log("hi")');
  });

  it('does not intercept /api routes', async () => {
    const { callback } = buildTestApp({ webDist: dist });
    const res = await request(callback)
      .post('/api/auth/login')
      .send({ username: 'wrong', password: 'wrong' });
    expect(res.status).toBe(401);
  });

  it('does not intercept paths that merely contain "admin"', async () => {
    const { callback, config } = buildTestApp({ webDist: dist });
    fs.writeFileSync(path.join(config.staticRoot, 'admin-other.txt'), 'hello');
    const res = await request(callback).get('/admin-other.txt');
    expect(res.status).toBe(200);
    expect(res.text).toBe('hello');
  });

  it('returns 503 with helpful message when web/dist is missing', async () => {
    const empty = makeTempRoot();
    const { callback } = buildTestApp({ webDist: empty });
    const res = await request(callback).get('/admin');
    expect(res.status).toBe(503);
    expect(res.text).toMatch(/pnpm build:web/);
    rmDir(empty);
  });

  it('rejects POST /admin (not GET/HEAD)', async () => {
    const { callback } = buildTestApp({ webDist: dist });
    const res = await request(callback).post('/admin');
    // SPA middleware passes through; static fallback only handles GET/HEAD too,
    // so it falls all the way through → 404
    expect(res.status).toBe(404);
  });
});
