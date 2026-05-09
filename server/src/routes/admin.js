import Router from '@koa/router';
import os from 'node:os';
import path from 'node:path';
import multer from '@koa/multer';
import { createAuthMiddleware } from '../middleware/auth.js';
import {
  batchDeleteFiles,
  createDir,
  deleteDir,
  deleteFile,
  listDir,
  placeUploads,
} from '../services/fs.service.js';
import { ok } from '../utils/response.js';
import { BadRequestError } from '../utils/errors.js';

export function createAdminRouter(config) {
  const router = new Router({ prefix: '/api/admin' });
  const auth = createAuthMiddleware(config);
  router.use(auth);

  router.get('/list', async (ctx) => {
    const target = ctx.query.path || '/';
    const items = await listDir(config.staticRoot, target);
    ctx.body = ok({ path: target, items });
  });

  router.post('/folder', async (ctx) => {
    const { path: parent, name } = ctx.request.body || {};
    const result = await createDir(config.staticRoot, parent || '/', name);
    ctx.body = ok(result);
  });

  router.delete('/folder', async (ctx) => {
    const { path: target } = ctx.request.body || {};
    if (!target) throw new BadRequestError('path is required', 'BAD_INPUT');
    await deleteDir(config.staticRoot, target);
    ctx.body = ok();
  });

  router.delete('/file', async (ctx) => {
    const { path: target } = ctx.request.body || {};
    if (!target) throw new BadRequestError('path is required', 'BAD_INPUT');
    await deleteFile(config.staticRoot, target);
    ctx.body = ok();
  });

  router.post('/files/batch-delete', async (ctx) => {
    const { paths } = ctx.request.body || {};
    const results = await batchDeleteFiles(config.staticRoot, paths);
    ctx.body = ok({ results });
  });

  const upload = multer({
    dest: path.join(os.tmpdir(), 'static-server-uploads'),
    limits: { fileSize: config.upload.maxSizeBytes },
  });

  router.post('/upload', upload.array('files', 50), async (ctx) => {
    const target = ctx.request.body?.path || '/';
    const files = ctx.request.files || [];
    if (files.length === 0) throw new BadRequestError('No files', 'NO_FILES');
    for (const f of files) {
      f.originalname = Buffer.from(f.originalname, 'latin1').toString('utf8');
    }
    const results = await placeUploads(config.staticRoot, target, files);
    ctx.body = ok({ results });
  });

  return router;
}
