import { useCallback, useState } from 'react';
import { useAuthStore } from '@/stores/authStore';
import * as authApi from '@/services/api/auth';
import type { RegisterRequest } from '@/services/api/auth';

/**
 * High-level auth hook that combines the auth store with API calls.
 * Components should use this instead of calling authApi directly.
 */
export function useAuth() {
  const store = useAuthStore();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const clearError = useCallback(() => setError(null), []);

  const login = useCallback(
    async (email: string, password: string) => {
      setIsSubmitting(true);
      setError(null);
      try {
        const res = await authApi.login(email, password);
        if (res.success && res.data) {
          await store.login(
            res.data.user,
            res.data.accessToken,
            res.data.refreshToken,
          );
          return true;
        }
        setError(res.error?.message ?? 'Login failed');
        return false;
      } catch {
        setError('An unexpected error occurred');
        return false;
      } finally {
        setIsSubmitting(false);
      }
    },
    [store],
  );

  const register = useCallback(
    async (data: RegisterRequest) => {
      setIsSubmitting(true);
      setError(null);
      try {
        const res = await authApi.register(data);
        // Account is created but not signed in: the user verifies their phone on the
        // OTP screen first, and verifyOtp signs them in. Signing in here would switch
        // RootNavigator to the Main stack and unmount the Auth stack (and OTP) mid-flow.
        if (res.success && res.data) {
          return true;
        }
        setError(res.error?.message ?? 'Registration failed');
        return false;
      } catch {
        setError('An unexpected error occurred');
        return false;
      } finally {
        setIsSubmitting(false);
      }
    },
    [],
  );

  const logout = useCallback(async () => {
    try {
      // Fire-and-forget server logout; always clear local state
      if (store.token && store.refreshToken) {
        authApi.logout(store.refreshToken, store.token).catch(() => {});
      }
    } finally {
      await store.logout();
    }
  }, [store]);

  const sendOtp = useCallback(async (phone: string) => {
    setIsSubmitting(true);
    setError(null);
    try {
      const res = await authApi.sendOtp(phone);
      if (res.success) return true;
      setError(res.error?.message ?? 'Failed to send OTP');
      return false;
    } catch {
      setError('An unexpected error occurred');
      return false;
    } finally {
      setIsSubmitting(false);
    }
  }, []);

  const verifyOtp = useCallback(
    async (phone: string, otp: string) => {
      setIsSubmitting(true);
      setError(null);
      try {
        const res = await authApi.verifyOtp(phone, otp);
        if (res.success && res.data) {
          await store.login(
            res.data.user,
            res.data.accessToken,
            res.data.refreshToken,
          );
          return true;
        }
        setError(res.error?.message ?? 'OTP verification failed');
        return false;
      } catch {
        setError('An unexpected error occurred');
        return false;
      } finally {
        setIsSubmitting(false);
      }
    },
    [store],
  );

  return {
    user: store.user,
    isAuthenticated: store.isAuthenticated,
    isLoading: store.isLoading,
    isSubmitting,
    error,
    clearError,
    login,
    register,
    logout,
    sendOtp,
    verifyOtp,
  };
}
