import { useCallback, useEffect, useState } from 'react';

export type SetHashPath = (
  next: string,
  opts?: { replace?: boolean },
) => void;

const ROOT = '/';

function isSafeRelPath(p: string): boolean {
  if (p.includes('\0')) return false;
  for (const seg of p.split('/')) {
    if (seg === '..') return false;
    if (/^[A-Za-z]:/.test(seg)) return false;
  }
  return true;
}

function parseHash(raw: string): string {
  if (!raw || raw === '#') return ROOT;
  const stripped = raw.startsWith('#') ? raw.slice(1) : raw;
  let decoded: string;
  try {
    decoded = decodeURIComponent(stripped);
  } catch {
    return ROOT;
  }
  if (!decoded) return ROOT;
  const normalized = decoded.startsWith('/') ? decoded : '/' + decoded;
  if (!isSafeRelPath(normalized)) return ROOT;
  return normalized;
}

function encodeHash(path: string): string {
  if (path === ROOT) return '';
  return '#' + encodeURI(path);
}

function normalizeCurrentHash(raw: string): string {
  return raw === '#' ? '' : raw;
}

function writeHash(path: string, replace: boolean): void {
  const target = encodeHash(path);
  const current = normalizeCurrentHash(window.location.hash);
  if (target === current) return;
  const url = window.location.pathname + window.location.search + target;
  if (replace) {
    window.history.replaceState(window.history.state, '', url);
  } else {
    window.history.pushState(window.history.state, '', url);
  }
}

export function useHashPath(): [string, SetHashPath] {
  const [path, setPathState] = useState<string>(() =>
    typeof window === 'undefined' ? ROOT : parseHash(window.location.hash),
  );

  useEffect(() => {
    const canonical = encodeHash(parseHash(window.location.hash));
    const current = normalizeCurrentHash(window.location.hash);
    if (canonical !== current) {
      const url = window.location.pathname + window.location.search + canonical;
      window.history.replaceState(window.history.state, '', url);
    }
  }, []);

  useEffect(() => {
    const onHashChange = () => {
      const raw = window.location.hash;
      const parsed = parseHash(raw);
      setPathState(parsed);
      const canonical = encodeHash(parsed);
      if (canonical !== normalizeCurrentHash(raw)) {
        const url =
          window.location.pathname + window.location.search + canonical;
        window.history.replaceState(window.history.state, '', url);
      }
    };
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  const setPath = useCallback<SetHashPath>((next, opts) => {
    const candidate = next.startsWith('/') ? next : '/' + next;
    const safe = isSafeRelPath(candidate) ? candidate : ROOT;
    writeHash(safe, opts?.replace ?? false);
    setPathState(safe);
  }, []);

  return [path, setPath];
}
