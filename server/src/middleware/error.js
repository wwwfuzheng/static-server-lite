import { AppError } from '../utils/errors.js';
import { fail } from '../utils/response.js';

export function createErrorMiddleware(logger) {
  return async function errorMiddleware(ctx, next) {
    try {
      await next();
    } catch (err) {
      if (err instanceof AppError) {
        ctx.status = err.status;
        ctx.body = fail(err.code, err.message);
        return;
      }
      logger.error({ err, path: ctx.path }, 'unhandled error');
      ctx.status = 500;
      ctx.body = fail('INTERNAL_ERROR', 'Internal Server Error');
    }
  };
}
