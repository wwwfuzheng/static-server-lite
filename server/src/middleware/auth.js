import jwt from 'jsonwebtoken';
import { UnauthorizedError } from '../utils/errors.js';

export function createAuthMiddleware(config) {
  return async function authMiddleware(ctx, next) {
    const header = ctx.headers.authorization || '';
    const match = /^Bearer\s+(.+)$/i.exec(header);
    if (!match) {
      throw new UnauthorizedError('Missing token', 'NO_TOKEN');
    }
    try {
      const payload = jwt.verify(match[1], config.jwt.secret);
      ctx.state.user = payload;
    } catch {
      throw new UnauthorizedError('Invalid or expired token', 'BAD_TOKEN');
    }
    await next();
  };
}
