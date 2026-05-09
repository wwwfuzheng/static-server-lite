import Koa from 'koa';
import bodyParser from 'koa-bodyparser';
import { createErrorMiddleware } from './middleware/error.js';
import { createAuthRouter } from './routes/auth.js';
import { createAdminRouter } from './routes/admin.js';
import { createSpaMiddleware } from './routes/spa.js';
import { createStaticMiddleware } from './routes/static.js';

export function createApp(config, logger) {
  const app = new Koa();
  app.context.config = config;
  app.context.logger = logger;

  app.use(createErrorMiddleware(logger));
  app.use(bodyParser({ jsonLimit: '1mb' }));

  const authRouter = createAuthRouter(config);
  const adminRouter = createAdminRouter(config);

  app.use(authRouter.routes()).use(authRouter.allowedMethods());
  app.use(adminRouter.routes()).use(adminRouter.allowedMethods());

  app.use(createSpaMiddleware(config));
  app.use(createStaticMiddleware(config));

  return app;
}
