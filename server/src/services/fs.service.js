import fs from 'node:fs/promises';
import path from 'node:path';
import { BadRequestError, NotFoundError } from '../utils/errors.js';
import { resolveSafe, toClientPath } from '../utils/safePath.js';

async function ensureDir(abs) {
  const stat = await fs.stat(abs).catch(() => null);
  if (!stat) throw new NotFoundError('Directory not found', 'DIR_NOT_FOUND');
  if (!stat.isDirectory()) throw new BadRequestError('Not a directory', 'NOT_A_DIR');
}

export async function listDir(root, relPath) {
  const abs = resolveSafe(root, relPath || '/');
  await ensureDir(abs);
  const entries = await fs.readdir(abs, { withFileTypes: true });
  const result = await Promise.all(
    entries.map(async (e) => {
      const childAbs = path.join(abs, e.name);
      const stat = await fs.stat(childAbs);
      return {
        name: e.name,
        type: e.isDirectory() ? 'dir' : 'file',
        size: e.isDirectory() ? 0 : stat.size,
        mtime: stat.mtime.toISOString(),
        path: toClientPath(root, childAbs),
      };
    }),
  );
  result.sort((a, b) => {
    if (a.type !== b.type) return a.type === 'dir' ? -1 : 1;
    return a.name.localeCompare(b.name);
  });
  return result;
}

const NAME_RE = /^[^\0/\\]+$/;
function validateName(name) {
  if (!name || !NAME_RE.test(name) || name === '.' || name === '..') {
    throw new BadRequestError('Invalid name', 'BAD_NAME');
  }
}

export async function createDir(root, relPath, name) {
  validateName(name);
  const parentAbs = resolveSafe(root, relPath || '/');
  await ensureDir(parentAbs);
  const targetAbs = resolveSafe(root, path.posix.join(relPath || '/', name));
  const exists = await fs.stat(targetAbs).catch(() => null);
  if (exists) throw new BadRequestError('Already exists', 'EXISTS');
  await fs.mkdir(targetAbs);
  return { path: toClientPath(root, targetAbs) };
}

export async function deleteDir(root, relPath) {
  const abs = resolveSafe(root, relPath || '/');
  if (path.resolve(root) === abs) {
    throw new BadRequestError('Cannot delete root', 'BAD_PATH');
  }
  const stat = await fs.stat(abs).catch(() => null);
  if (!stat) throw new NotFoundError('Not found', 'NOT_FOUND');
  if (!stat.isDirectory()) throw new BadRequestError('Not a directory', 'NOT_A_DIR');
  const entries = await fs.readdir(abs);
  if (entries.length > 0) throw new BadRequestError('Directory not empty', 'DIR_NOT_EMPTY');
  await fs.rmdir(abs);
}

export async function deleteFile(root, relPath) {
  const abs = resolveSafe(root, relPath || '/');
  const stat = await fs.stat(abs).catch(() => null);
  if (!stat) throw new NotFoundError('Not found', 'NOT_FOUND');
  if (!stat.isFile()) throw new BadRequestError('Not a file', 'NOT_A_FILE');
  await fs.unlink(abs);
}

export async function batchDeleteFiles(root, relPaths) {
  if (!Array.isArray(relPaths) || relPaths.length === 0) {
    throw new BadRequestError('paths is required', 'BAD_INPUT');
  }
  const results = [];
  for (const p of relPaths) {
    try {
      await deleteFile(root, p);
      results.push({ path: p, success: true });
    } catch (err) {
      results.push({ path: p, success: false, error: err.code || 'ERROR' });
    }
  }
  return results;
}

/**
 * Move uploaded temp files into a target directory under root.
 * Resolves filename collisions by appending _1, _2, ...
 */
export async function placeUploads(root, relTargetDir, files) {
  const targetAbs = resolveSafe(root, relTargetDir || '/');
  await ensureDir(targetAbs);

  const results = [];
  for (const f of files) {
    try {
      const finalName = await uniqueName(targetAbs, f.originalname);
      const finalAbs = path.join(targetAbs, finalName);
      await fs.rename(f.path, finalAbs);
      results.push({
        name: finalName,
        originalName: f.originalname,
        size: f.size,
        success: true,
        path: toClientPath(root, finalAbs),
      });
    } catch (err) {
      await fs.unlink(f.path).catch(() => {});
      results.push({ name: f.originalname, success: false, error: err.message });
    }
  }
  return results;
}

async function uniqueName(dirAbs, name) {
  const ext = path.extname(name);
  const base = path.basename(name, ext);
  let candidate = name;
  let i = 1;
  while (await fs.stat(path.join(dirAbs, candidate)).catch(() => null)) {
    candidate = `${base}_${i}${ext}`;
    i += 1;
  }
  return candidate;
}
