import path from 'node:path';
import { BadRequestError } from './errors.js';

/**
 * Resolve a user-supplied relative path against a root, ensuring the result
 * stays within the root. Rejects null bytes and absolute paths.
 *
 * @param {string} root absolute root directory
 * @param {string} relPath user-supplied path (may use '/' or be empty)
 * @returns {string} absolute resolved path
 */
export function resolveSafe(root, relPath) {
  let rel = relPath == null ? '' : String(relPath);
  if (rel.includes('\0')) {
    throw new BadRequestError('Invalid path', 'BAD_PATH');
  }
  // Reject Windows drive letters
  if (/^[A-Za-z]:/.test(rel)) {
    throw new BadRequestError('Path must be relative', 'BAD_PATH');
  }
  // Strip leading slashes — clients use POSIX-style "/foo/bar" but they are
  // semantically relative to STATIC_ROOT, not absolute filesystem paths.
  rel = rel.replace(/^\/+/, '');

  const rootAbs = path.resolve(root);
  const abs = path.resolve(rootAbs, rel);

  if (abs !== rootAbs && !abs.startsWith(rootAbs + path.sep)) {
    throw new BadRequestError('Path out of root', 'PATH_OUT_OF_ROOT');
  }
  return abs;
}

/** Normalize a path for client-facing responses (always POSIX slashes, leading '/'). */
export function toClientPath(root, abs) {
  const rel = path.relative(path.resolve(root), abs);
  if (rel === '') return '/';
  return '/' + rel.split(path.sep).join('/');
}
