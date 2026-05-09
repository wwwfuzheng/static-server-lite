import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

function required(name, value) {
  if (!value || String(value).trim() === '') {
    throw new Error(`Missing required env: ${name}`);
  }
  return value;
}

export function loadConfig(env = process.env) {
  const staticRootRaw = env.STATIC_ROOT || './public';
  const staticRoot = path.resolve(process.cwd(), staticRootRaw);

  if (!fs.existsSync(staticRoot)) {
    fs.mkdirSync(staticRoot, { recursive: true });
  }

  const jwtSecret = required('JWT_SECRET', env.JWT_SECRET);
  if (env.NODE_ENV !== 'test' && jwtSecret.length < 32) {
    throw new Error('JWT_SECRET must be at least 32 characters');
  }

  const reservedPrefixesRaw = env.RESERVED_PREFIXES || '/api,/admin';
  const reservedPrefixes = reservedPrefixesRaw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  return {
    port: Number(env.PORT) || 3000,
    logLevel: env.LOG_LEVEL || 'info',
    staticRoot,
    jwt: {
      secret: jwtSecret,
      expiresIn: env.JWT_EXPIRES_IN || '2h',
    },
    admin: {
      username: required('ADMIN_USERNAME', env.ADMIN_USERNAME),
      passwordHash: required('ADMIN_PASSWORD_HASH', env.ADMIN_PASSWORD_HASH),
    },
    upload: {
      maxSizeBytes: (Number(env.MAX_UPLOAD_SIZE_MB) || 50) * 1024 * 1024,
    },
    reservedPrefixes,
    nodeEnv: env.NODE_ENV || 'development',
  };
}
