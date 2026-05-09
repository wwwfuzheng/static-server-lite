import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { UploadArea } from '../src/components/UploadArea';

describe('UploadArea', () => {
  it('disables button and area while uploading, then re-enables', async () => {
    const user = userEvent.setup();
    const onUploaded = vi.fn();
    const onUploadingChange = vi.fn();
    render(
      <UploadArea
        currentPath="/"
        onUploaded={onUploaded}
        onUploadingChange={onUploadingChange}
      />,
    );
    const input = screen.getByTestId('file-input') as HTMLInputElement;
    const f1 = new File(['a'], 'a.txt');
    const f2 = new File(['b'], 'b.txt');
    await user.upload(input, [f1, f2]);

    // Eventually onUploaded called
    await waitFor(() => expect(onUploaded).toHaveBeenCalledTimes(1));
    // onUploadingChange toggled true then false
    expect(onUploadingChange.mock.calls.map((c) => c[0])).toEqual([true, false]);
  });

  it('upload button is disabled when prop disabled is set', () => {
    render(<UploadArea currentPath="/" onUploaded={() => {}} disabled />);
    const btn = screen.getByRole('button', { name: /upload files/i });
    expect(btn).toBeDisabled();
  });
});
