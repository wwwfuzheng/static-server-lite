import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { PathBreadcrumb } from '../src/components/Breadcrumb';

describe('PathBreadcrumb', () => {
  it('disables Up button at root', () => {
    render(<PathBreadcrumb path="/" onNavigate={() => {}} />);
    expect(screen.getByRole('button', { name: /up/i })).toBeDisabled();
  });

  it('navigates up one level', async () => {
    const user = userEvent.setup();
    const onNavigate = vi.fn();
    render(<PathBreadcrumb path="/a/b/c" onNavigate={onNavigate} />);
    await user.click(screen.getByRole('button', { name: /up/i }));
    expect(onNavigate).toHaveBeenCalledWith('/a/b');
  });

  it('clicking root in breadcrumb navigates to /', async () => {
    const user = userEvent.setup();
    const onNavigate = vi.fn();
    render(<PathBreadcrumb path="/a/b" onNavigate={onNavigate} />);
    // Two '/' nodes (root link + separator). First is the clickable anchor.
    const rootLinks = screen.getAllByText('/');
    await user.click(rootLinks[0]);
    expect(onNavigate).toHaveBeenCalledWith('/');
  });
});
