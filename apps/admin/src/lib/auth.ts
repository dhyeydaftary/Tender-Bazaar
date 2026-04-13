import { create } from "zustand";
import { persist } from "zustand/middleware";
import axios from "axios";

// ---------- Types ----------

export type AdminRole = "SUPER_ADMIN" | "ADMIN";

export interface AdminUser {
  id: string;
  name: string;
  email: string;
  role: AdminRole;
  avatar: string | null;
}

interface AuthState {
  user: AdminUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  token: string | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  checkAuth: () => void;
}

// ---------- Constants ----------

const STORAGE_KEY = "tb-admin-auth";
const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000/api/v1";

// ---------- Store ----------

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      isAuthenticated: false,
      isLoading: true,
      token: null,

      login: async (email: string, password: string) => {
        set({ isLoading: true });

        try {
          const res = await axios.post(`${API_BASE_URL}/auth/login`, {
            email,
            password,
          });

          if (!res.data.success || !res.data.data) {
            throw new Error(
              res.data.error?.message || "Invalid credentials"
            );
          }

          const { user, accessToken } = res.data.data;

          // Only allow ADMIN and SUPER_ADMIN roles
          if (user.role !== "ADMIN" && user.role !== "SUPER_ADMIN") {
            throw new Error(
              "Access denied. Admin privileges required."
            );
          }

          set({
            user: {
              id: user.id,
              name: user.name,
              email: user.email,
              role: user.role as AdminRole,
              avatar: user.avatarUrl || null,
            },
            token: accessToken,
            isAuthenticated: true,
            isLoading: false,
          });
        } catch (err: unknown) {
          set({ isLoading: false });
          if (axios.isAxiosError(err)) {
            throw new Error(
              err.response?.data?.error?.message ||
                "Invalid email or password"
            );
          }
          throw err;
        }
      },

      logout: () => {
        set({
          user: null,
          token: null,
          isAuthenticated: false,
          isLoading: false,
        });
        localStorage.removeItem(STORAGE_KEY);
      },

      checkAuth: () => {
        const stored = localStorage.getItem(STORAGE_KEY);

        if (!stored) {
          set({ isAuthenticated: false, isLoading: false });
          return;
        }

        try {
          const parsed = JSON.parse(stored);
          const { user, token } = parsed?.state ?? {};

          if (user && token) {
            set({
              user,
              token,
              isAuthenticated: true,
              isLoading: false,
            });
          } else {
            set({ isAuthenticated: false, isLoading: false });
          }
        } catch {
          set({ isAuthenticated: false, isLoading: false });
          localStorage.removeItem(STORAGE_KEY);
        }
      },
    }),
    {
      name: STORAGE_KEY,
      partialize: (state) => ({
        user: state.user,
        token: state.token,
        isAuthenticated: state.isAuthenticated,
      }),
      onRehydrateStorage: () => (state) => {
        if (state) {
          state.isLoading = false;
        }
      },
    }
  )
);
