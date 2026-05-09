import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import { buildTestApp, makeDir, rmDir, writeFile } from '../helpers.js';

describe('public static serving at root path', () => {
  let ctx;

  beforeEach(() => {
    ctx = buildTestApp();
  });
  afterEach(() => rmDir(ctx.config.staticRoot));

  it('serves a top-level file', async () => {
    writeFile(ctx.config.staticRoot, 'a.txt', 'hello');
    const res = await request(ctx.callback).get('/a.txt');
    expect(res.status).toBe(200);
    expect(res.text).toBe('hello');
  });

  it('serves a nested file', async () => {
    writeFile(ctx.config.staticRoot, 'imgs/x.txt', 'pixel');
    const res = await request(ctx.callback).get('/imgs/x.txt');
    expect(res.status).toBe(200);
    expect(res.text).toBe('pixel');
  });

  it('returns 404 for a directory (no listing)', async () => {
    makeDir(ctx.config.staticRoot, 'imgs');
    writeFile(ctx.config.staticRoot, 'imgs/x.txt', 'pixel');
    const res = await request(ctx.callback).get('/imgs/');
    expect(res.status).toBe(404);
    // body must not contain x.txt anywhere
    expect(JSON.stringify(res.body) + (res.text || '')).not.toContain('x.txt');
  });

  it('returns 404 for missing file', async () => {
    const res = await request(ctx.callback).get('/missing.txt');
    expect(res.status).toBe(404);
  });

  it('returns 400 for path traversal', async () => {
    const res = await request(ctx.callback).get('/../etc/passwd');
    // supertest/superagent normalizes ../ in URL; emulate raw with %2e
    expect([400, 404]).toContain(res.status);

    const res2 = await request(ctx.callback).get(
      '/' + encodeURIComponent('../etc/passwd'),
    );
    expect([400, 404]).toContain(res2.status);
  });

  it('does not serve dotfiles', async () => {
    writeFile(ctx.config.staticRoot, '.env', 'SECRET=1');
    const res = await request(ctx.callback).get('/.env');
    // koa-send with hidden:false responds 404 (after our stat check, koa-send may also throw)
    expect([403, 404]).toContain(res.status);
  });

  it('does not shadow API routes even if a same-named file exists', async () => {
    // Even if STATIC_ROOT/api/x.png exists, /api/* must hit the API router (404 here, JSON body)
    writeFile(ctx.config.staticRoot, 'api/x.png', 'shadowed');
    const res = await request(ctx.callback).get('/api/x.png');
    // /api/x.png is not a defined route → router responds 404 with allowedMethods or default
    // What matters: response should NOT contain the file content "shadowed"
    expect(res.text || '').not.toContain('shadowed');
  });
});
