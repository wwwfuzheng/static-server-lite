import axios, { AxiosError } from 'axios';
import { useAuth } from '../store/auth';

export const http = axios.create({
  baseURL: '/api',
  timeout: 30_000,
});

http.interceptors.request.use((config) => {
  const token = useAuth.getState().token;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

http.interceptors.response.use(
  (res) => {
    if (res.data && typeof res.data === 'object' && 'code' in res.data) {
      if (res.data.code !== 0) {
        return Promise.reject(new ApiError(res.data.code, res.data.message));
      }
    }
    return res;
  },
  (err: AxiosError<{ code?: string | number; message?: string }>) => {
    if (err.response?.status === 401) {
      useAuth.getState().logout();
    }
    const code = err.response?.data?.code ?? 'NETWORK_ERROR';
    const message = err.response?.data?.message ?? err.message;
    return Promise.reject(new ApiError(String(code), String(message)));
  },
);

export class ApiError extends Error {
  code: string;
  constructor(code: string, message: string) {
    super(message);
    this.code = code;
  }
}
