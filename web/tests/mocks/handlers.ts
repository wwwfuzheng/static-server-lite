import { http, HttpResponse } from 'msw';

interface FsItem {
  name: string;
  type: 'dir' | 'file';
  size: number;
  mtime: string;
  path: string;
}

// In-memory state used by mock handlers; reset per test via resetState()
const state = {
  items: new Map<string, FsItem[]>([['/', []]]),
  password: 'pa55word!',
};

export function resetState(items?: Record<string, FsItem[]>) {
  state.items = new Map(Object.entries(items ?? { '/': [] }));
}

export function recordUploaded(path: string, files: File[]) {
  const parent = state.items.get(path) ?? [];
  const results = files.map((f) => {
    const item: FsItem = {
      name: f.name,
      type: 'file',
      size: f.size,
      mtime: new Date().toISOString(),
      path: path === '/' ? `/${f.name}` : `${path}/${f.name}`,
    };
    parent.push(item);
    return { name: f.name, success: true, path: item.path };
  });
  state.items.set(path, parent);
  return results;
}

function ok<T>(data: T) {
  return HttpResponse.json({ code: 0, data, message: 'ok' });
}
function fail(status: number, code: string, message: string) {
  return HttpResponse.json({ code, message }, { status });
}

export const handlers = [
  http.post('/api/auth/login', async ({ request }) => {
    const body = (await request.json()) as { username?: string; password?: string };
    if (body.username === 'admin' && body.password === state.password) {
      return ok({ token: 'fake-token', expiresAt: Date.now() + 3600_000, username: 'admin' });
    }
    return fail(401, 'BAD_CREDENTIALS', 'Invalid credentials');
  }),

  http.post('/api/auth/verify', ({ request }) => {
    const auth = request.headers.get('authorization');
    if (auth?.startsWith('Bearer ')) return ok({ user: { sub: 'admin' } });
    return fail(401, 'NO_TOKEN', 'Missing token');
  }),

  http.get('/api/admin/list', ({ request }) => {
    const url = new URL(request.url);
    const path = url.searchParams.get('path') || '/';
    const items = state.items.get(path) ?? [];
    return ok({ path, items });
  }),

  http.post('/api/admin/folder', async ({ request }) => {
    const body = (await request.json()) as { path: string; name: string };
    const parent = state.items.get(body.path) ?? [];
    if (parent.find((i) => i.name === body.name)) {
      return fail(400, 'EXISTS', 'Already exists');
    }
    const newPath = body.path === '/' ? `/${body.name}` : `${body.path}/${body.name}`;
    parent.push({
      name: body.name,
      type: 'dir',
      size: 0,
      mtime: new Date().toISOString(),
      path: newPath,
    });
    state.items.set(body.path, parent);
    state.items.set(newPath, []);
    return ok({ path: newPath });
  }),

  http.delete('/api/admin/file', async ({ request }) => {
    const body = (await request.json()) as { path: string };
    for (const [parent, list] of state.items) {
      const idx = list.findIndex((i) => i.path === body.path && i.type === 'file');
      if (idx >= 0) {
        list.splice(idx, 1);
        state.items.set(parent, list);
        return ok(null);
      }
    }
    return fail(404, 'NOT_FOUND', 'Not found');
  }),

  http.delete('/api/admin/folder', async ({ request }) => {
    const body = (await request.json()) as { path: string };
    const children = state.items.get(body.path);
    if (children && children.length > 0) {
      return fail(400, 'DIR_NOT_EMPTY', 'Directory not empty');
    }
    for (const [parent, list] of state.items) {
      const idx = list.findIndex((i) => i.path === body.path && i.type === 'dir');
      if (idx >= 0) {
        list.splice(idx, 1);
        state.items.set(parent, list);
        state.items.delete(body.path);
        return ok(null);
      }
    }
    return fail(404, 'NOT_FOUND', 'Not found');
  }),

  http.post('/api/admin/files/batch-delete', async ({ request }) => {
    const body = (await request.json()) as { paths: string[] };
    const results = body.paths.map((p) => {
      for (const [parent, list] of state.items) {
        const idx = list.findIndex((i) => i.path === p && i.type === 'file');
        if (idx >= 0) {
          list.splice(idx, 1);
          state.items.set(parent, list);
          return { path: p, success: true };
        }
      }
      return { path: p, success: false, error: 'NOT_FOUND' };
    });
    return ok({ results });
  }),

  // axios in jsdom doesn't always set the multipart Content-Type with boundary
  // that MSW's request.formData() expects. Parse the raw body manually.
  http.post('/api/admin/upload', async ({ request }) => {
    const text = await request.text();
    const filenames = [...text.matchAll(/filename="([^"]+)"/g)].map((m) => m[1]);
    const pathMatch = text.match(/name="path"\r?\n\r?\n([^\r\n]*)/);
    const path = pathMatch ? pathMatch[1] : '/';
    const parent = state.items.get(path) ?? [];
    const results = filenames.map((name) => {
      const item: FsItem = {
        name,
        type: 'file',
        size: 0,
        mtime: new Date().toISOString(),
        path: path === '/' ? `/${name}` : `${path}/${name}`,
      };
      parent.push(item);
      return { name, success: true, path: item.path };
    });
    state.items.set(path, parent);
    return ok({ results });
  }),
];
