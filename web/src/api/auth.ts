import { http } from './client';

export interface LoginResult {
  token: string;
  expiresAt: number;
  username: string;
}

export async function login(username: string, password: string): Promise<LoginResult> {
  const res = await http.post('/auth/login', { username, password });
  return res.data.data;
}

export async function verify(): Promise<{ user: { sub: string } }> {
  const res = await http.post('/auth/verify');
  return res.data.data;
}
