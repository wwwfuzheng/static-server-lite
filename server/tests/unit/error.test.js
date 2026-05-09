import { describe, it, expect, vi } from 'vitest';
import { createErrorMiddleware } from '../../src/middleware/error.js';
import { AppError } from '../../src/utils/errors.js';

function makeCtx() {
  return { status: 200, body: undefined, path: '/x' };
}

describe('error middleware', () => {
  it('maps AppError to its status and code', async () => {
    const logger = { error: vi.fn() };
    const mw = createErrorMiddleware(logger);
    const ctx = makeCtx();
    await mw(ctx, async () => {
      throw new AppError('no coffee', 418, 'I_AM_TEAPOT');
    });
    expect(ctx.status).toBe(418);
    expect(ctx.body).toMatchObject({ code: 'I_AM_TEAPOT', message: 'no coffee' });
    expect(logger.error).not.toHaveBeenCalled();
  });

  it('falls back to 500 / INTERNAL_ERROR for unknown errors and logs', async () => {
    const logger = { error: vi.fn() };
    const mw = createErrorMiddleware(logger);
    const ctx = makeCtx();
    await mw(ctx, async () => {
      throw new Error('boom');
    });
    expect(ctx.status).toBe(500);
    expect(ctx.body).toMatchObject({ code: 'INTERNAL_ERROR' });
    expect(logger.error).toHaveBeenCalledOnce();
  });

  it('passes through when next() resolves', async () => {
    const logger = { error: vi.fn() };
    const mw = createErrorMiddleware(logger);
    const ctx = makeCtx();
    await mw(ctx, async () => {
      ctx.status = 204;
    });
    expect(ctx.status).toBe(204);
    expect(logger.error).not.toHaveBeenCalled();
  });
});
