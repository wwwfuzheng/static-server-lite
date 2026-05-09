import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { BadRequestError, TooManyRequestsError, UnauthorizedError } from '../utils/errors.js';

const WINDOW_MS = 60 * 1000;
const MAX_FAILS = 5;
const failures = new Map(); // ip -> { count, firstAt }

function recordFailure(ip) {
  const now = Date.now();
  const entry = failures.get(ip);
  if (!entry || now - entry.firstAt > WINDOW_MS) {
    failures.set(ip, { count: 1, firstAt: now });
    return 1;
  }
  entry.count += 1;
  return entry.count;
}

function clearFailures(ip) {
  failures.delete(ip);
}

export function _resetRateLimit() {
  failures.clear();
}

export async function login(config, { username, password, ip }) {
  if (!username || !password) {
    throw new BadRequestError('username and password are required', 'BAD_INPUT');
  }
  const entry = failures.get(ip);
  if (entry && entry.count >= MAX_FAILS && Date.now() - entry.firstAt <= WINDOW_MS) {
    throw new TooManyRequestsError('Too many failed attempts. Try again later.');
  }

  const userOk = username === config.admin.username;
  const passOk = userOk && (await bcrypt.compare(password, config.admin.passwordHash));
  if (!userOk || !passOk) {
    recordFailure(ip);
    throw new UnauthorizedError('Invalid credentials', 'BAD_CREDENTIALS');
  }
  clearFailures(ip);

  const token = jwt.sign({ sub: username }, config.jwt.secret, {
    expiresIn: config.jwt.expiresIn,
  });
  const decoded = jwt.decode(token);
  return { token, expiresAt: decoded.exp * 1000, username };
}
