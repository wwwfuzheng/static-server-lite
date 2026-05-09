import { describe, it, expect } from 'vitest';
import path from 'node:path';
import os from 'node:os';
import { resolveSafe, toClientPath } from '../../src/utils/safePath.js';

const root = path.join(os.tmpdir(), 'safepath-root');

describe('resolveSafe', () => {
  it('resolves empty path to root', () => {
    expect(resolveSafe(root, '')).toBe(path.resolve(root));
    expect(resolveSafe(root, '/')).toBe(path.resolve(root));
  });

  it('resolves a normal child path', () => {
    expect(resolveSafe(root, 'a/b.png')).toBe(path.resolve(root, 'a/b.png'));
  });

  it('rejects parent traversal', () => {
    expect(() => resolveSafe(root, '../etc/passwd')).toThrow();
    expect(() => resolveSafe(root, 'a/../../etc')).toThrow();
  });

  it('rejects null bytes', () => {
    expect(() => resolveSafe(root, 'a\0b')).toThrow();
  });

  it('treats leading slash as relative to root (client convention)', () => {
    expect(resolveSafe(root, '/foo/bar')).toBe(path.resolve(root, 'foo/bar'));
  });

  it('rejects windows drive letters', () => {
    expect(() => resolveSafe(root, 'C:/foo')).toThrow();
  });
});

describe('toClientPath', () => {
  it('returns / for the root itself', () => {
    expect(toClientPath(root, path.resolve(root))).toBe('/');
  });
  it('returns posix-style relative path', () => {
    expect(toClientPath(root, path.resolve(root, 'a/b'))).toBe('/a/b');
  });
});
