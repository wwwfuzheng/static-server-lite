import fs from 'node:fs/promises';
import send from 'koa-send';
import { resolveSafe } from '../utils/safePath.js';

/**
 * Fallback middleware that serves files directly from STATIC_ROOT at the URL root.
 * Reserved prefixes (e.g. /api, /admin) are skipped so earlier routes handle them.
 * Directories and missing files return 404 (no directory listing leaked).
 */
export function createStaticMiddleware(config) {
  const reserved = config.reservedPrefixes;
  return async function staticMiddleware(ctx, next) {
    if (ctx.method !== 'GET' && ctx.method !== 'HEAD') return next();
    const urlPath = ctx.path;
    if (reserved.some((p) => urlPath === p || urlPath.startsWith(p + '/'))) {
      return next();
    }

    let rel;
    try {
      rel = decodeURIComponent(urlPath);
    } catch {
      ctx.status = 400;
      return;
    }

    let abs;
    try {
      abs = resolveSafe(config.staticRoot, rel.replace(/^\/+/, ''));
    } catch {
      ctx.status = 400;
      return;
    }

    const stat = await fs.stat(abs).catch(() => null);
    if (!stat || !stat.isFile()) {
      ctx.status = 404;
      return;
    }

    await send(ctx, rel, {
      root: config.staticRoot,
      hidden: false,
      index: false,
    });
  };
}
