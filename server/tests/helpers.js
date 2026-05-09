import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import { createApp } from '../src/app.js';
import { _resetRateLimit } from '../src/services/auth.service.js';

const SILENT_LOGGER = {
  info: () => {},
  warn: () => {},
  error: () => {},
  debug: () => {},
  fatal: () => {},
  trace: () => {},
};

export function makeTempRoot() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sslite-test-'));
  return dir;
}

export function rmDir(dir) {
  fs.rmSync(dir, { recursive: true, force: true });
}

export function buildTestConfig(overrides = {}) {
  const password = overrides.password || 'pa55word!';
  return {
    port: 0,
    logLevel: 'silent',
    staticRoot: overrides.staticRoot || makeTempRoot(),
    jwt: {
      secret: 'a'.repeat(32),
      expiresIn: '1h',
    },
    admin: {
      username: overrides.username || 'admin',
      passwordHash: bcrypt.hashSync(password, 4),
    },
    upload: { maxSizeBytes: 10 * 1024 * 1024 },
    reservedPrefixes: ['/api', '/admin'],
    webDist: overrides.webDist,
    nodeEnv: 'test',
    _password: password, // exposed to tests
  };
}

export function buildTestApp(overrides = {}) {
  _resetRateLimit();
  const config = buildTestConfig(overrides);
  const app = createApp(config, SILENT_LOGGER);
  return { app, config, callback: app.callback() };
}

export function writeFile(staticRoot, relPath, content = 'hi') {
  const abs = path.join(staticRoot, relPath);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, content);
  return abs;
}

export function makeDir(staticRoot, relPath) {
  const abs = path.join(staticRoot, relPath);
  fs.mkdirSync(abs, { recursive: true });
  return abs;
}

export function randomBytes(n = 16) {
  return crypto.randomBytes(n);
}
