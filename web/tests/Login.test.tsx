import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { LoginPage } from '../src/pages/Login';
import { useAuth } from '../src/store/auth';

function renderLogin() {
  return render(
    <MemoryRouter initialEntries={['/login']}>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/" element={<div data-testid="home">home</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('LoginPage', () => {
  it('logs in with correct credentials and navigates home', async () => {
    const user = userEvent.setup();
    renderLogin();
    await user.type(screen.getByLabelText(/username/i), 'admin');
    await user.type(screen.getByLabelText(/password/i), 'pa55word!');
    await user.click(screen.getByRole('button', { name: /sign in/i }));
    expect(await screen.findByTestId('home')).toBeInTheDocument();
    expect(useAuth.getState().token).toBe('fake-token');
  });

  it('shows error on bad credentials', async () => {
    const user = userEvent.setup();
    renderLogin();
    await user.type(screen.getByLabelText(/username/i), 'admin');
    await user.type(screen.getByLabelText(/password/i), 'wrong');
    await user.click(screen.getByRole('button', { name: /sign in/i }));
    expect(await screen.findByText(/Invalid credentials/i)).toBeInTheDocument();
    expect(useAuth.getState().token).toBeNull();
  });

  it('validates required fields', async () => {
    const user = userEvent.setup();
    renderLogin();
    await user.click(screen.getByRole('button', { name: /sign in/i }));
    expect(await screen.findByText(/Please enter username/i)).toBeInTheDocument();
  });
});
