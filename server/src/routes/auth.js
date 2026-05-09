import Router from '@koa/router';
import { login } from '../services/auth.service.js';
import { createAuthMiddleware } from '../middleware/auth.js';
import { ok } from '../utils/response.js';

export function createAuthRouter(config) {
  const router = new Router({ prefix: '/api/auth' });
  const auth = createAuthMiddleware(config);

  router.post('/login', async (ctx) => {
    const { username, password } = ctx.request.body || {};
    const result = await login(config, { username, password, ip: ctx.ip });
    ctx.body = ok(result);
  });

  router.post('/verify', auth, async (ctx) => {
    ctx.body = ok({ user: ctx.state.user });
  });

  return router;
}
