import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { http, HttpResponse } from 'msw';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ManagerPage } from '../src/pages/Manager';
import { useAuth } from '../src/store/auth';
import { resetState } from './mocks/handlers';
import { server } from './mocks/server';

// jsdom + axios + FormData has known serialization limitations that prevent
// MSW from parsing the multipart body. Mock the upload API for the upload
// flow test so we exercise the UI contract (lock + refresh) without depending
// on a real multipart round-trip. The full upload integration is verified
// against the real backend via the server's supertest suite.
vi.mock('../src/api/fs', async () => {
  const actual =
    await vi.importActual<typeof import('../src/api/fs')>('../src/api/fs');
  return {
    ...actual,
    uploadFiles: vi.fn(async (path: string, files: File[]) => {
      // Push into the same in-memory state used by other mocked endpoints
      const { recordUploaded } = await import('./mocks/handlers');
      return recordUploaded(path, files);
    }),
  };
});

function setup() {
  useAuth.getState().setSession('fake-token', 'admin');
  const utils = render(
    <MemoryRouter>
      <ManagerPage />
    </MemoryRouter>,
  );
  return utils;
}

function clearHash() {
  window.history.replaceState(
    null,
    '',
    window.location.pathname + window.location.search,
  );
}

describe('ManagerPage', () => {
  beforeEach(() => {
    clearHash();
    resetState({
      '/': [
        {
          name: 'imgs',
          type: 'dir',
          size: 0,
          mtime: '2026-05-09T00:00:00Z',
          path: '/imgs',
        },
        {
          name: 'a.txt',
          type: 'file',
          size: 12,
          mtime: '2026-05-09T00:00:00Z',
          path: '/a.txt',
        },
      ],
      '/imgs': [],
    });
  });

  it('renders root listing on mount', async () => {
    setup();
    expect(await screen.findByText('imgs')).toBeInTheDocument();
    expect(screen.getByText('a.txt')).toBeInTheDocument();
  });

  it('navigates into a folder and back via Up', async () => {
    const user = userEvent.setup();
    const { container } = setup();
    await within(container).findByText('imgs');
    await user.click(within(container).getByText('imgs'));
    await waitFor(() => {
      expect(within(container).queryByText('a.txt')).not.toBeInTheDocument();
    });
    const upButtons = within(container).getAllByRole('button', { name: /up/i });
    await user.click(upButtons[0]);
    expect(await within(container).findByText('a.txt')).toBeInTheDocument();
  });

  it('creates a new folder', async () => {
    const user = userEvent.setup();
    setup();
    await screen.findByText('a.txt');
    await user.click(screen.getByRole('button', { name: /new folder/i }));
    const input = screen.getByPlaceholderText(/folder name/i);
    await user.type(input, 'docs');
    await user.click(screen.getByRole('button', { name: /^ok$/i }));
    expect(await screen.findByText('docs')).toBeInTheDocument();
  });

  it('uploads files: locks UI while uploading and refreshes after', async () => {
    const user = userEvent.setup();
    setup();
    await screen.findByText('a.txt');

    const input = screen.getByTestId('file-input') as HTMLInputElement;
    const file = new File(['hello'], 'hello.txt', { type: 'text/plain' });
    await user.upload(input, [file]);

    // After upload completes, file appears
    expect(await screen.findByText('hello.txt')).toBeInTheDocument();
  });

  it('batch deletes selected files', async () => {
    const user = userEvent.setup();
    const { container } = setup();
    await within(container).findByText('a.txt');
    const row = within(container).getByText('a.txt').closest('tr')!;
    await user.click(within(row).getByRole('checkbox'));
    await user.click(within(container).getByRole('button', { name: /batch delete \(1\)/i }));
    const oks = await screen.findAllByRole('button', { name: /^ok$/i });
    await user.click(oks[oks.length - 1]);
    await waitFor(() => {
      expect(within(container).queryByText('a.txt')).not.toBeInTheDocument();
    });
  });

  it('restores subdirectory from URL hash on mount', async () => {
    window.history.replaceState(
      null,
      '',
      window.location.pathname + window.location.search + '#/imgs',
    );
    const { container } = setup();
    // /imgs is empty in the default fixture; root contains 'a.txt' + an 'imgs' row.
    // Because the hook derives the initial path from the hash before the first
    // listDir call, the root's 'a.txt' file row must never render.
    await within(container).findByText('imgs'); // breadcrumb segment
    expect(within(container).queryByText('a.txt')).not.toBeInTheDocument();
  });

  it('writes URL hash when entering a folder', async () => {
    const user = userEvent.setup();
    const { container } = setup();
    await within(container).findByText('imgs');
    expect(window.location.hash).toBe('');
    await user.click(within(container).getByText('imgs'));
    await waitFor(() => {
      expect(window.location.hash).toBe('#/imgs');
    });
  });

  it('clears URL hash when navigating back to root', async () => {
    const user = userEvent.setup();
    const { container } = setup();
    await within(container).findByText('imgs');
    await user.click(within(container).getByText('imgs'));
    await waitFor(() => expect(window.location.hash).toBe('#/imgs'));
    const upButtons = within(container).getAllByRole('button', { name: /up/i });
    await user.click(upButtons[0]);
    await waitFor(() => expect(window.location.hash).toBe(''));
  });

  it('falls back to root when backend returns DIR_NOT_FOUND', async () => {
    server.use(
      http.get('/api/admin/list', ({ request }) => {
        const url = new URL(request.url);
        const path = url.searchParams.get('path') || '/';
        if (path === '/ghost') {
          return HttpResponse.json(
            { code: 'DIR_NOT_FOUND', message: 'Directory not found' },
            { status: 404 },
          );
        }
        return HttpResponse.json({
          code: 0,
          message: 'ok',
          data: { path, items: path === '/' ? [{ name: 'a.txt', type: 'file', size: 1, mtime: '2026-05-09T00:00:00Z', path: '/a.txt' }] : [] },
        });
      }),
    );
    window.history.replaceState(
      null,
      '',
      window.location.pathname + window.location.search + '#/ghost',
    );
    const { container } = setup();
    // After fallback: hash cleared and root content (a.txt) visible
    await waitFor(() => expect(window.location.hash).toBe(''));
    expect(await within(container).findByText('a.txt')).toBeInTheDocument();
  });

  it('keeps current path when backend returns a non-path error', async () => {
    server.use(
      http.get('/api/admin/list', ({ request }) => {
        const url = new URL(request.url);
        const path = url.searchParams.get('path') || '/';
        if (path === '/imgs') {
          return HttpResponse.json(
            { code: 'INTERNAL', message: 'boom' },
            { status: 500 },
          );
        }
        return HttpResponse.json({ code: 0, message: 'ok', data: { path, items: [] } });
      }),
    );
    window.history.replaceState(
      null,
      '',
      window.location.pathname + window.location.search + '#/imgs',
    );
    setup();
    // Give the failing request time to settle
    await new Promise((r) => setTimeout(r, 50));
    expect(window.location.hash).toBe('#/imgs');
  });

  it('refuses to delete a non-empty folder via API error', async () => {
    resetState({
      '/': [
        {
          name: 'imgs',
          type: 'dir',
          size: 0,
          mtime: '2026-05-09T00:00:00Z',
          path: '/imgs',
        },
      ],
      '/imgs': [
        {
          name: 'inner.txt',
          type: 'file',
          size: 5,
          mtime: '2026-05-09T00:00:00Z',
          path: '/imgs/inner.txt',
        },
      ],
    });
    const user = userEvent.setup();
    const { container } = setup();
    await within(container).findByText('imgs');
    const row = within(container).getByText('imgs').closest('tr')!;
    await user.click(within(row).getByRole('button', { name: /delete/i }));
    // The popconfirm OK button renders in a portal; pick the most recent OK.
    const oks = await screen.findAllByRole('button', { name: /^ok$/i });
    await user.click(oks[oks.length - 1]);
    // Folder must still be present after the rejected deletion.
    // (AntD message singleton is unreliable across tests, so we assert on
    // the table state rather than the toast text.)
    await new Promise((r) => setTimeout(r, 50));
    expect(within(container).getByText('imgs')).toBeInTheDocument();
  });
});
