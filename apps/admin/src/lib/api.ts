import axios from 'axios';
import { useAuthStore } from './auth';

// ---------------------------------------------------------------------------
// Axios Client — points to the API server admin routes
// ---------------------------------------------------------------------------

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api/v1';

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 15000,
  headers: { 'Content-Type': 'application/json' },
});

// Attach the Bearer token on every request
api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().token;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Handle 401s — log the admin out automatically
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      useAuthStore.getState().logout();
      if (typeof window !== 'undefined') {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  },
);

export default api;

// ---------------------------------------------------------------------------
// Generic response unwrapper
// ---------------------------------------------------------------------------

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: { code: string; message: string };
  meta?: { page: number; limit: number; total: number };
}

/**
 * Unwrap an API response — throws on failure so callers can just `await`.
 */
export async function unwrap<T>(promise: Promise<{ data: ApiResponse<T> }>): Promise<T> {
  const res = await promise;
  if (!res.data.success || !res.data.data) {
    throw new Error(res.data.error?.message || 'API request failed');
  }
  return res.data.data;
}

/**
 * Unwrap with meta (for paginated endpoints).
 */
export async function unwrapWithMeta<T>(
  promise: Promise<{ data: ApiResponse<T> }>,
): Promise<{ data: T; meta?: { page: number; limit: number; total: number } }> {
  const res = await promise;
  if (!res.data.success || !res.data.data) {
    throw new Error(res.data.error?.message || 'API request failed');
  }
  return { data: res.data.data, meta: res.data.meta };
}
