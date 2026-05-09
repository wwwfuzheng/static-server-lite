import { create } from 'zustand';

const TOKEN_KEY = 'sslite_token';
const USER_KEY = 'sslite_user';

interface AuthState {
  token: string | null;
  username: string | null;
  setSession: (token: string, username: string) => void;
  logout: () => void;
}

export const useAuth = create<AuthState>((set) => ({
  token: typeof localStorage !== 'undefined' ? localStorage.getItem(TOKEN_KEY) : null,
  username: typeof localStorage !== 'undefined' ? localStorage.getItem(USER_KEY) : null,
  setSession: (token, username) => {
    localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem(USER_KEY, username);
    set({ token, username });
  },
  logout: () => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    set({ token: null, username: null });
  },
}));
