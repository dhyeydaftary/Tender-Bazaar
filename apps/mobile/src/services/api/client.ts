import axios, {
  AxiosError,
  AxiosInstance,
  AxiosResponse,
  InternalAxiosRequestConfig,
} from 'axios';
import { API_URL } from '@/utils/constants';
import type { ApiResponse } from '@/types/api';

// Try react-native-config first; fall back to our Platform-based constant.
let baseURL = API_URL;
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const Config = require('react-native-config').default;
  if (Config?.API_URL) {
    baseURL = Config.API_URL;
  }
} catch {
  // react-native-config not available — use fallback
}

// ─── Axios Instance ──────────────────────────────────────────────────────────

const apiClient: AxiosInstance = axios.create({
  baseURL,
  timeout: 30_000,
  headers: {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  },
});

// ─── Token accessor — set by authStore at init time ─────────────────────────

type TokenAccessor = () => string | null;
type RefreshHandler = (token: string) => Promise<string | null>;
type LogoutHandler = () => void;

let _getToken: TokenAccessor = () => null;
let _getRefreshToken: TokenAccessor = () => null;
let _onRefreshSuccess: RefreshHandler | null = null;
let _onLogout: LogoutHandler = () => {};

/**
 * Called once during app bootstrap so the API client can read tokens
 * without creating a circular dependency with the auth store.
 */
export function configureAuth(opts: {
  getToken: TokenAccessor;
  getRefreshToken: TokenAccessor;
  onRefreshSuccess: RefreshHandler;
  onLogout: LogoutHandler;
}) {
  _getToken = opts.getToken;
  _getRefreshToken = opts.getRefreshToken;
  _onRefreshSuccess = opts.onRefreshSuccess;
  _onLogout = opts.onLogout;
}

// ─── Request Interceptor ────────────────────────────────────────────────────

apiClient.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const token = _getToken();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error: AxiosError) => Promise.reject(error),
);

// ─── Response Interceptor (401 → refresh → retry OR logout) ────────────────

let isRefreshing = false;
let failedQueue: Array<{
  resolve: (value: unknown) => void;
  reject: (reason?: unknown) => void;
}> = [];

function processQueue(error: unknown, token: string | null = null) {
  failedQueue.forEach(({ resolve, reject }) => {
    if (error) {
      reject(error);
    } else {
      resolve(token);
    }
  });
  failedQueue = [];
}

apiClient.interceptors.response.use(
  (response: AxiosResponse) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & {
      _retry?: boolean;
    };

    // Only attempt refresh on 401 and when we haven't already retried
    if (error.response?.status !== 401 || originalRequest._retry) {
      return Promise.reject(error);
    }

    const refreshToken = _getRefreshToken();
    if (!refreshToken || !_onRefreshSuccess) {
      _onLogout();
      return Promise.reject(error);
    }

    if (isRefreshing) {
      // Queue the request while another refresh is in flight
      return new Promise((resolve, reject) => {
        failedQueue.push({ resolve, reject });
      })
        .then((token) => {
          if (originalRequest.headers) {
            originalRequest.headers.Authorization = `Bearer ${token}`;
          }
          return apiClient(originalRequest);
        })
        .catch((err) => Promise.reject(err));
    }

    originalRequest._retry = true;
    isRefreshing = true;

    try {
      const newToken = await _onRefreshSuccess(refreshToken);
      if (!newToken) {
        throw new Error('Refresh failed');
      }

      processQueue(null, newToken);

      if (originalRequest.headers) {
        originalRequest.headers.Authorization = `Bearer ${newToken}`;
      }
      return apiClient(originalRequest);
    } catch (refreshError) {
      processQueue(refreshError, null);
      _onLogout();
      return Promise.reject(refreshError);
    } finally {
      isRefreshing = false;
    }
  },
);

// ─── Typed Response Wrapper ─────────────────────────────────────────────────

/**
 * Unwrap an Axios response into our standard ApiResponse shape.
 * Throws an error with structured details if the server returns
 * `{ success: false }`.
 */
export async function apiRequest<T>(
  request: Promise<AxiosResponse<ApiResponse<T>>>,
): Promise<ApiResponse<T>> {
  try {
    const response = await request;
    return response.data;
  } catch (err) {
    if (axios.isAxiosError(err) && err.response?.data) {
      const body = err.response.data as ApiResponse<T>;
      if (body && typeof body === 'object' && 'success' in body) {
        return body;
      }
    }

    // Network / timeout / unknown error
    return {
      success: false,
      error: {
        code: 'NETWORK_ERROR',
        message:
          err instanceof Error ? err.message : 'An unexpected error occurred',
      },
    };
  }
}

export default apiClient;
