import axios from 'axios';
import { API_BASE_URL, API_URL_NOT_CONFIGURED_MESSAGE } from './api-url';

const API_URL = API_BASE_URL;

const api = axios.create({
  baseURL: API_URL ?? undefined,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor: attach Bearer token
api.interceptors.request.use((config) => {
  if (!API_URL) {
    // Never send the request anywhere when the build had no API URL.
    return Promise.reject(new Error(API_URL_NOT_CONFIGURED_MESSAGE));
  }
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('accessToken');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  }
  return config;
});

// Response interceptor: handle 401 with token refresh
let refreshPromise: Promise<string> | null = null;

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // Only handle 401 responses for non-auth requests (do NOT refresh on login/register failures)
    const requestUrl = originalRequest?.url || '';
    const isAuthRoute =
      requestUrl.includes('/auth/login') ||
      requestUrl.includes('/auth/register') ||
      requestUrl.includes('/auth/send-otp') ||
      requestUrl.includes('/auth/verify-otp') ||
      requestUrl.includes('/auth/refresh-token') ||
      requestUrl.includes('/auth/forgot-password') ||
      requestUrl.includes('/auth/reset-password');

    if (error.response?.status === 401 && !originalRequest._retry && !isAuthRoute) {
      originalRequest._retry = true;

      try {
        if (!refreshPromise) {
          refreshPromise = (async () => {
            const refreshToken = typeof window !== 'undefined' ? localStorage.getItem('refreshToken') : null;
            if (!refreshToken) {
              throw new Error('No refresh token');
            }

            const response = await axios.post(`${API_URL}/auth/refresh-token`, {
              refreshToken,
            });

            const { accessToken, refreshToken: newRefreshToken } = response.data.data;
            if (typeof window !== 'undefined') {
              localStorage.setItem('accessToken', accessToken);
              localStorage.setItem('refreshToken', newRefreshToken);
            }
            return accessToken;
          })().finally(() => {
            refreshPromise = null;
          });
        }

        const newAccessToken = await refreshPromise;
        originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
        return api(originalRequest);
      } catch {
        if (typeof window !== 'undefined') {
          localStorage.removeItem('accessToken');
          localStorage.removeItem('refreshToken');
          if (!window.location.pathname.startsWith('/login')) {
            const hadToken = originalRequest.headers?.Authorization;
            if (hadToken) {
              window.location.href = '/login';
            }
          }
        }
        return Promise.reject(error);
      }
    }

    return Promise.reject(error);
  }
);

export default api;
