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
    async (email: string, _password: string) => {
      setIsSubmitting(true);
      setError(null);
      try {
        // ── Mock login (no backend needed) ──────────────────────────
        // Use any email/password — e.g. demo@tenderbazaar.in / password123
        await new Promise<void>((resolve) => setTimeout(() => resolve(), 1000));
        const mockUser = {
          id: 'usr_mock_001',
          name: email.split('@')[0].replace(/[._]/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
          email,
          phone: '+919876543210',
          avatarUrl: undefined,
          role: 'USER' as const,
          isEmailVerified: true,
          isPhoneVerified: true,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        await store.login(mockUser, 'mock_token_abc123', 'mock_refresh_xyz789');
        return true;
        // ────────────────────────────────────────────────────────────
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
        if (res.success && res.data) {
          await store.login(
            res.data.user,
            res.data.tokens.token,
            res.data.tokens.refreshToken,
          );
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
    [store],
  );

  const logout = useCallback(async () => {
    try {
      // Fire-and-forget server logout; always clear local state
      authApi.logout().catch(() => {});
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
            res.data.tokens.token,
            res.data.tokens.refreshToken,
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
