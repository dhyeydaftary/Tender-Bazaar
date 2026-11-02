import { create } from 'zustand';
import api from '@/lib/api';

interface User {
  id: string;
  name: string;
  email: string;
  phone?: string;
  role: string;
  avatarUrl?: string;
  isEmailVerified?: boolean;
  isPhoneVerified?: boolean;
  subscription?: {
    id: string;
    status: string;
    billingCycle?: string;
    endDate?: string;
    plan: {
      id: string;
      name: string;
      slug: string;
    };
  } | null;
}

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (data: { name: string; email: string; password: string; phone?: string }) => Promise<void>;
  googleAuth: (idToken: string) => Promise<void>;
  sendOtp: (phone: string) => Promise<{ message?: string; otp?: string }>;
  verifyOtp: (phone: string, otp: string) => Promise<void>;
  forgotPassword: (email: string) => Promise<{ message: string }>;
  resetPassword: (token: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  fetchUser: () => Promise<void>;
  initAuth: () => void;
  setUser: (user: User | null) => void;
}

function getInitialUser(): User | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem('tb_user');
    if (!raw) return null;
    const user = JSON.parse(raw);
    const storedAvatar = localStorage.getItem('tb_user_avatar');
    if (storedAvatar && !user.avatarUrl) {
      user.avatarUrl = storedAvatar;
    }
    return user;
  } catch {
    return null;
  }
}

export const useAuthStore = create<AuthState>((set) => ({
  user: getInitialUser(),
  isAuthenticated: typeof window !== 'undefined' ? !!localStorage.getItem('accessToken') : false,
  isLoading: false,

  login: async (email, password) => {
    set({ isLoading: true });
    try {
      const res = await api.post('/auth/login', { email, password });
      const { user, accessToken, refreshToken } = res.data.data;
      localStorage.setItem('accessToken', accessToken);
      localStorage.setItem('refreshToken', refreshToken);
      localStorage.setItem('tb_user', JSON.stringify(user));
      set({ user, isAuthenticated: true, isLoading: false });
    } catch (error) {
      set({ isLoading: false });
      throw error;
    }
  },

  register: async (data) => {
    set({ isLoading: true });
    try {
      const res = await api.post('/auth/register', data);
      const { user, accessToken, refreshToken } = res.data.data;
      localStorage.setItem('accessToken', accessToken);
      localStorage.setItem('refreshToken', refreshToken);
      localStorage.setItem('tb_user', JSON.stringify(user));
      set({ user, isAuthenticated: true, isLoading: false });
    } catch (error) {
      set({ isLoading: false });
      throw error;
    }
  },

  googleAuth: async (idToken) => {
    set({ isLoading: true });
    try {
      const res = await api.post('/auth/google', { idToken });
      const { user, accessToken, refreshToken } = res.data.data;
      localStorage.setItem('accessToken', accessToken);
      localStorage.setItem('refreshToken', refreshToken);
      localStorage.setItem('tb_user', JSON.stringify(user));
      set({ user, isAuthenticated: true, isLoading: false });
    } catch (error) {
      set({ isLoading: false });
      throw error;
    }
  },

  sendOtp: async (phone) => {
    const res = await api.post('/auth/send-otp', { phone });
    return res.data?.data;
  },

  verifyOtp: async (phone, otp) => {
    set({ isLoading: true });
    try {
      const res = await api.post('/auth/verify-otp', { phone, otp });
      const { user, accessToken, refreshToken } = res.data.data;
      localStorage.setItem('accessToken', accessToken);
      localStorage.setItem('refreshToken', refreshToken);
      localStorage.setItem('tb_user', JSON.stringify(user));
      set({ user, isAuthenticated: true, isLoading: false });
    } catch (error) {
      set({ isLoading: false });
      throw error;
    }
  },

  forgotPassword: async (email) => {
    const res = await api.post('/auth/forgot-password', { email });
    return res.data.data;
  },

  resetPassword: async (token, password) => {
    await api.post('/auth/reset-password', { token, password });
  },

  logout: async () => {
    try {
      const refreshToken = localStorage.getItem('refreshToken');
      if (refreshToken) {
        await api.delete('/auth/logout', { data: { refreshToken } });
      }
    } catch {
      // Ignore errors during logout
    } finally {
      localStorage.removeItem('accessToken');
      localStorage.removeItem('refreshToken');
      localStorage.removeItem('tb_user');
      localStorage.removeItem('tb_user_avatar');
      set({ user: null, isAuthenticated: false });
    }
  },

  initAuth: () => {
    if (typeof window === 'undefined') return;
    const initialUser = getInitialUser();
    const token = localStorage.getItem('accessToken');
    if (initialUser || token) {
      set({ user: initialUser, isAuthenticated: !!token });
    }
  },

  fetchUser: async () => {
    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null;
      if (!token) {
        const storedAvatar = typeof window !== 'undefined' ? localStorage.getItem('tb_user_avatar') : null;
        if (storedAvatar) {
          set((state) => ({
            user: state.user ? { ...state.user, avatarUrl: storedAvatar } : state.user,
          }));
        }
        return;
      }

      // If user isn't populated in memory yet, immediately use cached user from storage
      const cached = getInitialUser();
      if (cached) {
        set((state) => (state.user ? state : { user: cached, isAuthenticated: true }));
      }

      const res = await api.get('/auth/me');
      const fetchedUser = res.data?.data?.user;
      if (fetchedUser) {
        const storedAvatar = typeof window !== 'undefined' ? localStorage.getItem('tb_user_avatar') : null;
        if (storedAvatar && !fetchedUser.avatarUrl) {
          fetchedUser.avatarUrl = storedAvatar;
        }
        if (typeof window !== 'undefined') {
          localStorage.setItem('tb_user', JSON.stringify(fetchedUser));
        }
        set({ user: fetchedUser, isAuthenticated: true });
      }
    } catch (err: any) {
      // Only clear user credentials if server explicitly rejected auth with 401
      if (err.response?.status === 401) {
        if (typeof window !== 'undefined') {
          localStorage.removeItem('accessToken');
          localStorage.removeItem('refreshToken');
          localStorage.removeItem('tb_user');
        }
        set({ user: null, isAuthenticated: false });
      }
    }
  },

  setUser: (user) => {
    if (typeof window !== 'undefined') {
      if (user) {
        localStorage.setItem('tb_user', JSON.stringify(user));
      } else {
        localStorage.removeItem('tb_user');
      }
    }
    set({ user, isAuthenticated: !!user });
  },
}));
