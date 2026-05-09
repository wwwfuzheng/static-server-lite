import { describe, it, expect, afterEach } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { loadConfig } from '../../src/config/index.js';

const baseEnv = {
  JWT_SECRET: 'a'.repeat(40),
  ADMIN_USERNAME: 'admin',
  ADMIN_PASSWORD_HASH: '$2a$04$abcdefghijklmnopqrstuvwxyz012345678901234567890123',
  STATIC_ROOT: './public',
  NODE_ENV: 'test',
};

const cleanup = [];
afterEach(() => {
  while (cleanup.length) {
    const dir = cleanup.pop();
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

describe('loadConfig', () => {
  it('parses defaults', () => {
    const cfg = loadConfig({ ...baseEnv });
    expect(cfg.port).toBe(3000);
    expect(cfg.reservedPrefixes).toEqual(['/api', '/admin']);
    expect(cfg.upload.maxSizeBytes).toBe(50 * 1024 * 1024);
  });

  it('throws when JWT_SECRET missing', () => {
    const env = { ...baseEnv };
    delete env.JWT_SECRET;
    expect(() => loadConfig(env)).toThrow(/JWT_SECRET/);
  });

  it('throws when admin password hash missing', () => {
    const env = { ...baseEnv };
    delete env.ADMIN_PASSWORD_HASH;
    expect(() => loadConfig(env)).toThrow(/ADMIN_PASSWORD_HASH/);
  });

  it('parses custom reserved prefixes', () => {
    const cfg = loadConfig({ ...baseEnv, RESERVED_PREFIXES: '/api,/admin,/health' });
    expect(cfg.reservedPrefixes).toContain('/health');
  });

  it('auto-creates STATIC_ROOT when it does not exist', () => {
    const ghost = path.join(os.tmpdir(), `sslite-ghost-${Date.now()}-${Math.random()}`);
    cleanup.push(ghost);
    expect(fs.existsSync(ghost)).toBe(false);
    loadConfig({ ...baseEnv, STATIC_ROOT: ghost });
    expect(fs.existsSync(ghost)).toBe(true);
  });

  it('rejects short JWT_SECRET in non-test environments', () => {
    expect(() =>
      loadConfig({ ...baseEnv, NODE_ENV: 'production', JWT_SECRET: 'short' }),
    ).toThrow(/JWT_SECRET must be at least 32 characters/);
  });
});
