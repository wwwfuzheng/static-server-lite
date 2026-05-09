import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useHashPath } from '../src/hooks/useHashPath';

function clearHash() {
  window.history.replaceState(
    null,
    '',
    window.location.pathname + window.location.search,
  );
}

function presetHash(hash: string) {
  window.history.replaceState(
    null,
    '',
    window.location.pathname + window.location.search + hash,
  );
}

describe('useHashPath - initial parse', () => {
  beforeEach(() => clearHash());

  it('returns root for empty hash', () => {
    const { result } = renderHook(() => useHashPath());
    expect(result.current[0]).toBe('/');
  });

  it('returns parsed path for valid hash', () => {
    presetHash('#/foo/bar');
    const { result } = renderHook(() => useHashPath());
    expect(result.current[0]).toBe('/foo/bar');
  });

  it('prepends missing leading slash', () => {
    presetHash('#foo');
    const { result } = renderHook(() => useHashPath());
    expect(result.current[0]).toBe('/foo');
  });

  it('decodes percent-encoded UTF-8 (Chinese folder name)', () => {
    presetHash('#/%E6%96%87%E6%A1%A3');
    const { result } = renderHook(() => useHashPath());
    expect(result.current[0]).toBe('/文档');
  });

  it('rejects path traversal and clears hash', () => {
    presetHash('#/foo/../etc');
    const { result } = renderHook(() => useHashPath());
    expect(result.current[0]).toBe('/');
    expect(window.location.hash).toBe('');
  });

  it('rejects null byte', () => {
    presetHash('#/foo%00bar');
    const { result } = renderHook(() => useHashPath());
    expect(result.current[0]).toBe('/');
    expect(window.location.hash).toBe('');
  });

  it('rejects Windows drive letter', () => {
    presetHash('#C:/secrets');
    const { result } = renderHook(() => useHashPath());
    expect(result.current[0]).toBe('/');
    expect(window.location.hash).toBe('');
  });

  it('falls back to root on malformed percent-encoding', () => {
    presetHash('#/%E4%B8');
    const { result } = renderHook(() => useHashPath());
    expect(result.current[0]).toBe('/');
    expect(window.location.hash).toBe('');
  });
});

describe('useHashPath - setter', () => {
  beforeEach(() => clearHash());

  it('pushes by default', () => {
    const { result } = renderHook(() => useHashPath());
    const pushSpy = vi.spyOn(window.history, 'pushState');
    act(() => result.current[1]('/a'));
    expect(result.current[0]).toBe('/a');
    expect(pushSpy).toHaveBeenCalledTimes(1);
    expect(window.location.hash).toBe('#/a');
    pushSpy.mockRestore();
  });

  it('replaces when opts.replace is true', () => {
    const { result } = renderHook(() => useHashPath());
    const pushSpy = vi.spyOn(window.history, 'pushState');
    const replaceSpy = vi.spyOn(window.history, 'replaceState');
    act(() => result.current[1]('/a', { replace: true }));
    expect(pushSpy).not.toHaveBeenCalled();
    expect(replaceSpy).toHaveBeenCalledTimes(1);
    expect(window.location.hash).toBe('#/a');
    pushSpy.mockRestore();
    replaceSpy.mockRestore();
  });

  it('skips writing when target equals current', () => {
    presetHash('#/x');
    const { result } = renderHook(() => useHashPath());
    const pushSpy = vi.spyOn(window.history, 'pushState');
    const replaceSpy = vi.spyOn(window.history, 'replaceState');
    act(() => result.current[1]('/x'));
    expect(pushSpy).not.toHaveBeenCalled();
    expect(replaceSpy).not.toHaveBeenCalled();
    pushSpy.mockRestore();
    replaceSpy.mockRestore();
  });

  it('writes empty hash for root', () => {
    presetHash('#/x');
    const { result } = renderHook(() => useHashPath());
    act(() => result.current[1]('/'));
    expect(result.current[0]).toBe('/');
    expect(window.location.hash).toBe('');
  });

  it('encodes Chinese folder name', () => {
    const { result } = renderHook(() => useHashPath());
    act(() => result.current[1]('/文档'));
    expect(window.location.hash).toBe('#/%E6%96%87%E6%A1%A3');
    expect(result.current[0]).toBe('/文档');
  });

  it('rejects unsafe path and falls back to root', () => {
    const { result } = renderHook(() => useHashPath());
    act(() => result.current[1]('/foo/../bar'));
    expect(result.current[0]).toBe('/');
  });
});

describe('useHashPath - hashchange listener', () => {
  beforeEach(() => clearHash());

  it('syncs state when external hash changes', () => {
    const { result } = renderHook(() => useHashPath());
    expect(result.current[0]).toBe('/');
    act(() => {
      presetHash('#/bar');
      window.dispatchEvent(new Event('hashchange'));
    });
    expect(result.current[0]).toBe('/bar');
  });

  it('does not pushState in response to external hashchange', () => {
    const { result } = renderHook(() => useHashPath());
    const pushSpy = vi.spyOn(window.history, 'pushState');
    act(() => {
      presetHash('#/bar');
      window.dispatchEvent(new Event('hashchange'));
    });
    expect(result.current[0]).toBe('/bar');
    expect(pushSpy).not.toHaveBeenCalled();
    pushSpy.mockRestore();
  });

  it('canonicalizes invalid external hash to empty without pushing history', () => {
    const { result } = renderHook(() => useHashPath());
    const pushSpy = vi.spyOn(window.history, 'pushState');
    act(() => {
      presetHash('#/a/../b');
      window.dispatchEvent(new Event('hashchange'));
    });
    expect(result.current[0]).toBe('/');
    expect(window.location.hash).toBe('');
    expect(pushSpy).not.toHaveBeenCalled();
    pushSpy.mockRestore();
  });

  it('removes listener on unmount', () => {
    const removeSpy = vi.spyOn(window, 'removeEventListener');
    const { unmount } = renderHook(() => useHashPath());
    unmount();
    expect(
      removeSpy.mock.calls.some(([type]) => type === 'hashchange'),
    ).toBe(true);
    removeSpy.mockRestore();
  });
});
