import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import send from 'koa-send';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_DIST = path.resolve(__dirname, '../../../web/dist');

/**
 * Serves the React admin SPA under /admin.
 *
 * - /admin and /admin/  → web/dist/index.html
 * - /admin/<asset>      → web/dist/<asset> if file exists, else index.html (SPA routing)
 *
 * `config.webDist` overrides the dist directory (used in tests). Path-traversal
 * is handled by koa-send via the `root` option.
 */
export function createSpaMiddleware(config = {}) {
  const distRoot = config.webDist || DEFAULT_DIST;

  return async function spaMiddleware(ctx, next) {
    if (ctx.method !== 'GET' && ctx.method !== 'HEAD') return next();
    const p = ctx.path;
    if (p !== '/admin' && !p.startsWith('/admin/')) return next();

    if (!fs.existsSync(path.join(distRoot, 'index.html'))) {
      ctx.status = 503;
      ctx.body = 'web/dist/index.html not found. Run `pnpm build:web` first.';
      return;
    }

    const rel =
      p === '/admin' || p === '/admin/'
        ? '/index.html'
        : p.slice('/admin'.length);

    let target;
    try {
      target = decodeURIComponent(rel);
    } catch {
      ctx.status = 400;
      return;
    }

    const abs = path.join(distRoot, target);
    const stat = await fs.promises.stat(abs).catch(() => null);
    const finalRel = stat && stat.isFile() ? target : '/index.html';

    await send(ctx, finalRel, { root: distRoot, hidden: false, index: false });
  };
}
