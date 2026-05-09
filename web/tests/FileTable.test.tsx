import { render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { FileTable } from '../src/components/FileTable';
import type { FsItem } from '../src/api/fs';

const fileItem: FsItem = {
  name: 'a.txt',
  type: 'file',
  size: 12,
  mtime: '2026-05-09T00:00:00Z',
  path: '/a.txt',
};

const dirItem: FsItem = {
  name: 'imgs',
  type: 'dir',
  size: 0,
  mtime: '2026-05-09T00:00:00Z',
  path: '/imgs',
};

function renderTable(items: FsItem[]) {
  return render(
    <FileTable
      items={items}
      loading={false}
      selected={[]}
      onSelect={() => {}}
      onEnter={() => {}}
      onDeleteFile={() => {}}
      onDeleteFolder={() => {}}
    />,
  );
}

describe('FileTable visit link', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('renders an aria-labeled visit link for file rows with target/rel', () => {
    vi.stubEnv('PROD', true);
    renderTable([fileItem]);
    const link = screen.getByRole('link', { name: '访问 a.txt' });
    expect(link).toHaveAttribute('target', '_blank');
    const rel = link.getAttribute('rel') ?? '';
    expect(rel).toContain('noopener');
    expect(rel).toContain('noreferrer');
  });

  it('does not render a visit link for directory rows', () => {
    vi.stubEnv('PROD', true);
    const { container } = renderTable([dirItem]);
    expect(screen.queryByRole('link', { name: /^访问/ })).toBeNull();
    // The Visit cell of the dir row shows '-'
    const dirRow = within(container).getByText('imgs').closest('tr')!;
    const cells = dirRow.querySelectorAll('td');
    // Columns: select, name, size, modified, visit, actions
    expect(cells[4].textContent).toBe('-');
  });

  it('encodes Chinese path segments per slash-separated component', () => {
    vi.stubEnv('PROD', true);
    renderTable([
      {
        name: '说明.txt',
        type: 'file',
        size: 1,
        mtime: '2026-05-09T00:00:00Z',
        path: '/文档/说明.txt',
      },
    ]);
    const link = screen.getByRole('link', { name: '访问 说明.txt' });
    expect(link.getAttribute('href')).toBe(
      '/%E6%96%87%E6%A1%A3/%E8%AF%B4%E6%98%8E.txt',
    );
  });

  it('encodes ?, # and space inside file names', () => {
    vi.stubEnv('PROD', true);
    renderTable([
      {
        name: 'draft?v1#tmp.md',
        type: 'file',
        size: 1,
        mtime: '2026-05-09T00:00:00Z',
        path: '/notes/draft?v1#tmp.md',
      },
      {
        name: 'hello world.png',
        type: 'file',
        size: 1,
        mtime: '2026-05-09T00:00:00Z',
        path: '/imgs/hello world.png',
      },
    ]);
    const hashLink = screen.getByRole('link', { name: '访问 draft?v1#tmp.md' });
    expect(hashLink.getAttribute('href')).toBe(
      '/notes/draft%3Fv1%23tmp.md',
    );
    const spaceLink = screen.getByRole('link', { name: '访问 hello world.png' });
    expect(spaceLink.getAttribute('href')).toBe(
      '/imgs/hello%20world.png',
    );
  });

  it('keeps visit link clickable when disabled prop is true', () => {
    vi.stubEnv('PROD', true);
    render(
      <FileTable
        items={[fileItem]}
        loading={false}
        selected={[]}
        onSelect={() => {}}
        onEnter={() => {}}
        onDeleteFile={() => {}}
        onDeleteFolder={() => {}}
        disabled
      />,
    );
    const link = screen.getByRole('link', { name: '访问 a.txt' });
    expect(link.getAttribute('aria-disabled')).not.toBe('true');
    expect(link).toHaveAttribute('href');
  });

  it('uses relative href in production mode', () => {
    vi.stubEnv('PROD', true);
    renderTable([fileItem]);
    expect(
      screen.getByRole('link', { name: '访问 a.txt' }).getAttribute('href'),
    ).toBe('/a.txt');
  });

  it('uses host:VITE_SERVER_PORT in dev mode', () => {
    vi.stubEnv('PROD', false);
    vi.stubEnv('VITE_SERVER_PORT', '3000');
    renderTable([fileItem]);
    const href = screen
      .getByRole('link', { name: '访问 a.txt' })
      .getAttribute('href');
    expect(href).toBe(`http://${window.location.hostname}:3000/a.txt`);
  });

  it('reflects a different VITE_SERVER_PORT value', () => {
    vi.stubEnv('PROD', false);
    vi.stubEnv('VITE_SERVER_PORT', '4000');
    renderTable([fileItem]);
    const href = screen
      .getByRole('link', { name: '访问 a.txt' })
      .getAttribute('href');
    expect(href).toBe(`http://${window.location.hostname}:4000/a.txt`);
  });
});
